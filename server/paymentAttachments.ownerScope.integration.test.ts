import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConnection, type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

vi.mock("./storage", () => ({ storagePut: vi.fn(async (relKey: string) => ({ key: `private/${relKey}`, url: `/manus-storage/private/${relKey}` })) }));

import { __setDbForTests, getPaymentAttachmentForView, getReceivableDetails, listPaymentAttachments, softDeletePaymentAttachment, uploadPaymentAttachment } from "./db";
import { storagePut } from "./storage";

const databaseUrl = process.env.DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let connection: Connection | null = null;
let fixtureOpenIds: string[] = [];

integration("payment attachment owner scope and soft deletion", () => {
  beforeEach(async () => {
    fixtureOpenIds = [];
    connection = await createConnection(databaseUrl!);
    await connection.beginTransaction();
    __setDbForTests(drizzle(connection));
    vi.mocked(storagePut).mockClear();
  });

  afterEach(async () => {
    __setDbForTests(null);
    if (connection) {
      await connection.rollback();
      if (fixtureOpenIds.length) await connection.execute(`DELETE FROM users WHERE openId IN (${fixtureOpenIds.map(() => "?").join(",")})`, fixtureOpenIds);
      await connection.end();
    }
    connection = null;
  });

  it("stores only S3 metadata for an owned payment, blocks other owners, and revokes application access through soft delete", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    fixtureOpenIds = [`attachment-owner-${suffix}`, `attachment-other-${suffix}`];
    const [owners] = await connection!.execute<ResultSetHeader>("INSERT INTO users (`openId`, `role`) VALUES (?, 'user'), (?, 'user')", fixtureOpenIds);
    const ownerId = Number(owners.insertId);
    const otherId = ownerId + 1;
    const [invoice] = await connection!.execute<ResultSetHeader>("INSERT INTO saved_documents (`userId`, `kind`, `documentNumber`, `customerName`, `payload`, `status`) VALUES (?, 'invoice', ?, 'ลูกค้าทดสอบ', '{}', 'sent')", [ownerId, `IV-ATTACH-${suffix}`]);
    const [receivable] = await connection!.execute<ResultSetHeader>("INSERT INTO receivables (`userId`, `invoiceId`, `documentNumber`, `customerName`, `issueDate`, `dueDate`, `totalAmount`, `paidAmount`, `status`) VALUES (?, ?, ?, 'ลูกค้าทดสอบ', '2026-08-20 00:00:00', '2026-08-30 23:59:59', '1000.00', '1000.00', 'paid')", [ownerId, invoice.insertId, `IV-ATTACH-${suffix}`]);
    const [payment] = await connection!.execute<ResultSetHeader>("INSERT INTO payments (`userId`, `receivableId`, `amount`, `paidAt`, `method`) VALUES (?, ?, '1000.00', '2026-08-27 00:00:00', 'transfer')", [ownerId, receivable.insertId]);
    const attachment = await uploadPaymentAttachment(ownerId, { paymentId: Number(payment.insertId), originalFilename: "สลิปโอนเงิน.png", caption: "หลักฐานเดือนสิงหาคม", dataUrl: "data:image/png;base64,cHJvb2Y=" });
    expect(attachment).toMatchObject({ paymentId: Number(payment.insertId), originalFilename: "สลิปโอนเงิน.png", mimeType: "image/png", sizeBytes: 5, caption: "หลักฐานเดือนสิงหาคม" });
    expect(attachment).not.toHaveProperty("storageKey");
    expect(storagePut).toHaveBeenCalledWith(expect.stringContaining(`payment-proofs/${ownerId}/${payment.insertId}/`), expect.any(Buffer), "image/png");
    await expect(listPaymentAttachments(otherId, Number(payment.insertId))).rejects.toThrow("ไม่พบรายการรับชำระของผู้ใช้รายนี้");
    const ownerList = await listPaymentAttachments(ownerId, Number(payment.insertId));
    expect(ownerList).toMatchObject([{ id: attachment.id, originalFilename: "สลิปโอนเงิน.png", mimeType: "image/png" }]);
    expect(ownerList[0]).not.toHaveProperty("storageKey");
    await expect(getPaymentAttachmentForView(otherId, attachment.id)).rejects.toThrow("ไม่พบหลักฐานการรับชำระของผู้ใช้รายนี้");
    await expect(softDeletePaymentAttachment(otherId, attachment.id)).rejects.toThrow("ไม่พบหลักฐานการรับชำระของผู้ใช้รายนี้");
    const internalView = await getPaymentAttachmentForView(ownerId, attachment.id);
    expect(internalView.storageKey).toContain(`payment-proofs/${ownerId}/${payment.insertId}/`);
    await expect(softDeletePaymentAttachment(ownerId, attachment.id)).resolves.toEqual({ deleted: true });
    await expect(listPaymentAttachments(ownerId, Number(payment.insertId))).resolves.toEqual([]);
    await expect(getPaymentAttachmentForView(ownerId, attachment.id)).rejects.toThrow("ไม่พบหลักฐานการรับชำระของผู้ใช้รายนี้");
    const [metadataRows] = await connection!.execute<RowDataPacket[]>("SELECT storageKey, deletedAt FROM payment_attachments WHERE id = ? AND userId = ?", [attachment.id, ownerId]);
    expect(metadataRows[0]?.storageKey).toContain(`payment-proofs/${ownerId}/${payment.insertId}/`);
    expect(metadataRows[0]?.deletedAt).toBeTruthy();
    const detail = await getReceivableDetails(ownerId, Number(receivable.insertId));
    expect(detail?.payments[0]?.attachments).toEqual([]);
    expect(detail?.events.map((event) => ({ type: event.type, note: event.note }))).toEqual(expect.arrayContaining([{ type: "payment-attachment-added", note: "เพิ่มหลักฐานการรับชำระ" }, { type: "payment-attachment-removed", note: "ลบหลักฐานการรับชำระ" }]));
  });
});

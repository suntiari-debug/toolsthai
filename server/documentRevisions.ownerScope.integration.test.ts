import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConnection, type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { __setDbForTests, getDocumentRevisionPreview, getSavedDocument, listDocumentExports, listDocumentRevisions, restoreDocumentRevision, saveDocument } from "./db";

const databaseUrl = process.env.DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let connection: Connection | null = null;
let fixtureOpenIds: string[] = [];

integration("document revisions immutable owner scope", () => {
  beforeEach(async () => {
    fixtureOpenIds = [];
    connection = await createConnection(databaseUrl!);
    await connection.beginTransaction();
    __setDbForTests(drizzle(connection));
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

  it("bootstraps a legacy document, preserves revisions/export/receipt source, and restores as a new immutable revision", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    fixtureOpenIds = [`revision-owner-${suffix}`, `revision-other-${suffix}`];
    const [owners] = await connection!.execute<ResultSetHeader>("INSERT INTO users (`openId`, `role`) VALUES (?, 'user'), (?, 'user')", fixtureOpenIds);
    const ownerId = Number(owners.insertId);
    const otherId = ownerId + 1;
    const invoicePayload = JSON.stringify({ kind: "invoice", documentNumber: `IV-SOURCE-${suffix}`, customer: { name: "ลูกค้าต้นทาง" }, items: [] });
    const [invoice] = await connection!.execute<ResultSetHeader>("INSERT INTO saved_documents (`userId`, `kind`, `documentNumber`, `customerName`, `payload`, `status`) VALUES (?, 'invoice', ?, 'ลูกค้าต้นทาง', ?, 'sent')", [ownerId, `IV-SOURCE-${suffix}`, invoicePayload]);
    const [receivable] = await connection!.execute<ResultSetHeader>("INSERT INTO receivables (`userId`, `invoiceId`, `documentNumber`, `customerName`, `issueDate`, `dueDate`, `totalAmount`, `paidAmount`, `status`) VALUES (?, ?, ?, 'ลูกค้าต้นทาง', '2026-08-20 00:00:00', '2026-08-30 00:00:00', '1000.00', '1000.00', 'paid')", [ownerId, invoice.insertId, `IV-SOURCE-${suffix}`]);
    const [payment] = await connection!.execute<ResultSetHeader>("INSERT INTO payments (`userId`, `receivableId`, `amount`, `paidAt`, `method`) VALUES (?, ?, '1000.00', '2026-08-27 00:00:00', 'transfer')", [ownerId, receivable.insertId]);
    const legacyPayload = JSON.stringify({ kind: "receipt", documentNumber: `RC-${suffix}`, customer: { name: "ลูกค้าเดิม", address: "ที่อยู่เดิม" }, items: [{ name: "บริการ", quantity: 1, unitPrice: 1000 }], receiptSource: { sourceInvoiceId: Number(invoice.insertId), sourceReceivableId: Number(receivable.insertId), activePaymentIds: [Number(payment.insertId)], paymentTotalAtCreation: "1000.00" } });
    const [receipt] = await connection!.execute<ResultSetHeader>("INSERT INTO saved_documents (`userId`, `kind`, `documentNumber`, `customerName`, `payload`, `status`) VALUES (?, 'receipt', ?, 'ลูกค้าเดิม', ?, 'draft')", [ownerId, `RC-${suffix}`, legacyPayload]);
    await connection!.execute("INSERT INTO receipt_sources (`userId`, `receivableId`, `invoiceId`, `receiptDocumentId`, `activePaymentIds`, `paymentTotalAtCreation`, `createdFrom`) VALUES (?, ?, ?, ?, ?, '1000.00', 'receivable-paid')", [ownerId, receivable.insertId, invoice.insertId, receipt.insertId, JSON.stringify([Number(payment.insertId)])]);
    await connection!.execute("INSERT INTO document_exports (`userId`, `documentId`, `filename`) VALUES (?, ?, 'legacy-receipt.pdf')", [ownerId, receipt.insertId]);

    const changedPayload = JSON.stringify({ ...JSON.parse(legacyPayload), customer: { name: "ลูกค้าใหม่", address: "ที่อยู่ใหม่" } });
    const saved = await saveDocument({ userId: ownerId, actorId: ownerId, documentId: Number(receipt.insertId), kind: "receipt", documentNumber: `RC-${suffix}`, customerName: "ลูกค้าใหม่", payload: changedPayload });
    expect(saved).toMatchObject({ documentId: Number(receipt.insertId), revisionNumber: 2 });
    const revisions = await listDocumentRevisions(ownerId, Number(receipt.insertId), { page: 1, pageSize: 1 });
    expect(revisions).toMatchObject({ total: 2, page: 1, pageSize: 1, items: [{ revisionNumber: 2 }] });
    expect(revisions.items[0]).not.toHaveProperty("payload");
    await expect(listDocumentRevisions(otherId, Number(receipt.insertId))).rejects.toThrow("ไม่พบเอกสารของผู้ใช้รายนี้");
    const revisionOne = await getDocumentRevisionPreview(ownerId, Number(receipt.insertId), (await listDocumentRevisions(ownerId, Number(receipt.insertId), { page: 2, pageSize: 1 })).items[0]!.id);
    expect(revisionOne?.payload).toBe(legacyPayload);
    await expect(restoreDocumentRevision(otherId, otherId, Number(receipt.insertId), revisionOne!.id)).rejects.toThrow("ไม่พบเอกสารของผู้ใช้รายนี้");
    const restored = await restoreDocumentRevision(ownerId, ownerId, Number(receipt.insertId), revisionOne!.id);
    expect(restored).toMatchObject({ documentId: Number(receipt.insertId), revisionNumber: 3, payload: legacyPayload });
    expect((await getSavedDocument(ownerId, Number(receipt.insertId)))?.payload).toBe(legacyPayload);
    expect((await getDocumentRevisionPreview(ownerId, Number(receipt.insertId), revisions.items[0]!.id))?.payload).toBe(changedPayload);
    expect((await listDocumentExports(ownerId, Number(receipt.insertId))).map((entry) => entry.filename)).toEqual(["legacy-receipt.pdf"]);
    const [sourceRows] = await connection!.execute<RowDataPacket[]>("SELECT invoiceId, receivableId, receiptDocumentId, activePaymentIds, paymentTotalAtCreation FROM receipt_sources WHERE receiptDocumentId = ? AND userId = ?", [receipt.insertId, ownerId]);
    expect(sourceRows[0]).toMatchObject({ invoiceId: Number(invoice.insertId), receivableId: Number(receivable.insertId), receiptDocumentId: Number(receipt.insertId), activePaymentIds: JSON.stringify([Number(payment.insertId)]), paymentTotalAtCreation: "1000.00" });
    expect((await listDocumentRevisions(ownerId, Number(receipt.insertId))).total).toBe(3);
  });
});

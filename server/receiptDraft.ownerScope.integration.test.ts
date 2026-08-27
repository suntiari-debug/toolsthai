import { createConnection, type Connection, type ResultSetHeader } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setDbForTests, createReceiptDraft, getReceiptEligibility } from "./db";

const databaseUrl = process.env.DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let connection: Connection | null = null;
let fixtureOpenIds: string[] = [];

integration("receipt draft owner scope with a transaction fixture", () => {
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
      connection = null;
    }
  });

  it("creates only for the owner, reopens the same draft, and rejects a different owner", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    fixtureOpenIds = [`receipt-owner-${suffix}`, `receipt-other-${suffix}`];
    const [owners] = await connection!.execute<ResultSetHeader>("INSERT INTO users (`openId`, `role`) VALUES (?, 'user'), (?, 'user')", fixtureOpenIds);
    const ownerId = Number(owners.insertId);
    const otherId = ownerId + 1;
    const invoicePayload = JSON.stringify({ kind: "invoice", documentNumber: `IV-TEST-${suffix}`, issueDate: "2026-08-27", dueDate: "2026-09-03", company: { name: "Test Co." }, customer: { name: "Owner Customer" }, items: [{ quantity: 1, unitPrice: 1000 }], discount: 0, vatRate: 0, vatMode: "none" });
    const [invoice] = await connection!.execute<ResultSetHeader>("INSERT INTO saved_documents (`userId`, `kind`, `documentNumber`, `customerName`, `payload`, `status`) VALUES (?, 'invoice', ?, 'Owner Customer', ?, 'sent')", [ownerId, `IV-TEST-${suffix}`, invoicePayload]);
    const [receivable] = await connection!.execute<ResultSetHeader>("INSERT INTO receivables (`userId`, `invoiceId`, `documentNumber`, `customerName`, `issueDate`, `dueDate`, `totalAmount`, `paidAmount`, `status`) VALUES (?, ?, ?, 'Owner Customer', '2026-08-27 00:00:00', '2026-09-03 23:59:59', '1000.00', '1000.00', 'paid')", [ownerId, invoice.insertId, `IV-TEST-${suffix}`]);
    await connection!.execute("INSERT INTO payments (`userId`, `receivableId`, `amount`, `paidAt`, `method`) VALUES (?, ?, '1000.00', '2026-08-27 12:00:00', 'transfer')", [ownerId, receivable.insertId]);

    await expect(getReceiptEligibility(ownerId, Number(receivable.insertId))).resolves.toMatchObject({ eligible: true, receivable: { id: Number(receivable.insertId) } });
    const created = await createReceiptDraft(ownerId, Number(receivable.insertId));
    expect(created).toMatchObject({ created: true, documentNumber: expect.stringMatching(/^RC-/) });
    const reopened = await createReceiptDraft(ownerId, Number(receivable.insertId));
    expect(reopened).toMatchObject({ id: created.id, created: false, payload: created.payload });
    await expect(getReceiptEligibility(otherId, Number(receivable.insertId))).rejects.toThrow("ไม่พบรายการลูกหนี้ของผู้ใช้รายนี้");
    await expect(createReceiptDraft(otherId, Number(receivable.insertId))).rejects.toThrow("ไม่พบรายการลูกหนี้ของผู้ใช้รายนี้");
  });
});

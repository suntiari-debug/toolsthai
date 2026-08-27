import { createConnection, type Connection, type ResultSetHeader } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setDbForTests, evaluateReceivableReminders, evaluateReceivableRemindersByTaskUid, getReceivableReminderInbox, markReceivableReminderRead, recordPayment, saveReceivableReminderSettings, voidPayment } from "./db";

const databaseUrl = process.env.DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
let connection: Connection | null = null;
let fixtureOpenIds: string[] = [];

integration("receivable reminder evaluation owner scope and dedupe", () => {
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

  it("creates one reminder under the owner only, deduplicates a retry, and blocks another owner from reading or marking it", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    fixtureOpenIds = [`reminder-owner-${suffix}`, `reminder-other-${suffix}`];
    const [owners] = await connection!.execute<ResultSetHeader>("INSERT INTO users (`openId`, `role`) VALUES (?, 'user'), (?, 'user')", fixtureOpenIds);
    const ownerId = Number(owners.insertId);
    const otherId = ownerId + 1;
    const [invoice] = await connection!.execute<ResultSetHeader>("INSERT INTO saved_documents (`userId`, `kind`, `documentNumber`, `customerName`, `payload`, `status`) VALUES (?, 'invoice', ?, 'ลูกค้าทดสอบ', '{}', 'sent')", [ownerId, `IV-REM-${suffix}`]);
    const [receivable] = await connection!.execute<ResultSetHeader>("INSERT INTO receivables (`userId`, `invoiceId`, `documentNumber`, `customerName`, `issueDate`, `dueDate`, `totalAmount`, `paidAmount`, `status`) VALUES (?, ?, ?, 'ลูกค้าทดสอบ', '2026-08-20 00:00:00', '2026-08-30 23:59:59', '1000.00', '0.00', 'open')", [ownerId, invoice.insertId, `IV-REM-${suffix}`]);
    await saveReceivableReminderSettings(ownerId, { enabled: true, daysBeforeDue: [3], timezone: "Asia/Bangkok", scheduleCronTaskUid: null });

    await expect(evaluateReceivableReminders(ownerId, new Date("2026-08-27T01:00:00.000Z"))).resolves.toMatchObject({ created: 1, deduplicated: 0, considered: 1 });
    await expect(evaluateReceivableReminders(ownerId, new Date("2026-08-27T10:00:00.000Z"))).resolves.toMatchObject({ created: 0, deduplicated: 1, considered: 1 });
    const ownerInbox = await getReceivableReminderInbox(ownerId);
    expect(ownerInbox).toMatchObject({ counts: { unread: 1, dueSoon: 1, overdue: 0 }, items: [{ receivableId: Number(receivable.insertId), invoiceId: Number(invoice.insertId), reminderType: "due-soon", outstandingAmount: "1000.00" }] });
    expect((await getReceivableReminderInbox(otherId)).items).toEqual([]);
    await expect(markReceivableReminderRead(otherId, ownerInbox.items[0]!.id)).resolves.toEqual({ updated: false });
    await expect(markReceivableReminderRead(ownerId, ownerInbox.items[0]!.id)).resolves.toEqual({ updated: true });
  });

  it("does not remind a paid balance, reconsiders it after an audit-safe void, and resolves cron work from task UID only", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    fixtureOpenIds = [`reminder-schedule-owner-${suffix}`];
    const [owner] = await connection!.execute<ResultSetHeader>("INSERT INTO users (`openId`, `role`) VALUES (?, 'user')", fixtureOpenIds);
    const ownerId = Number(owner.insertId);
    const [invoice] = await connection!.execute<ResultSetHeader>("INSERT INTO saved_documents (`userId`, `kind`, `documentNumber`, `customerName`, `payload`, `status`) VALUES (?, 'invoice', ?, 'ลูกค้าทดสอบ', '{}', 'sent')", [ownerId, `IV-SCHEDULE-${suffix}`]);
    const [receivable] = await connection!.execute<ResultSetHeader>("INSERT INTO receivables (`userId`, `invoiceId`, `documentNumber`, `customerName`, `issueDate`, `dueDate`, `totalAmount`, `paidAmount`, `status`) VALUES (?, ?, ?, 'ลูกค้าทดสอบ', '2026-08-20 00:00:00', '2026-08-30 23:59:59', '1000.00', '0.00', 'open')", [ownerId, invoice.insertId, `IV-SCHEDULE-${suffix}`]);
    const taskUid = `reminder-task-${suffix}`;
    await saveReceivableReminderSettings(ownerId, { enabled: true, daysBeforeDue: [3], timezone: "Asia/Bangkok", scheduleCronTaskUid: taskUid });
    const paid = await recordPayment(ownerId, { receivableId: Number(receivable.insertId), amount: 1000, paidAt: new Date("2026-08-27T01:00:00.000Z"), method: "transfer" });
    await expect(evaluateReceivableRemindersByTaskUid("unknown-task", new Date("2026-08-27T01:00:00.000Z"))).resolves.toMatchObject({ skipped: "orphan", created: 0 });
    await expect(evaluateReceivableRemindersByTaskUid(taskUid, new Date("2026-08-27T01:00:00.000Z"))).resolves.toMatchObject({ created: 0, considered: 0 });
    await voidPayment(ownerId, { paymentId: paid.paymentId, reason: "ทดสอบคืนยอดคงเหลือ" });
    await expect(evaluateReceivableRemindersByTaskUid(taskUid, new Date("2026-08-27T01:00:00.000Z"))).resolves.toMatchObject({ created: 1, considered: 1, skipped: null });
    await expect(evaluateReceivableRemindersByTaskUid(taskUid, new Date("2026-08-27T10:00:00.000Z"))).resolves.toMatchObject({ created: 0, deduplicated: 1 });
    await saveReceivableReminderSettings(ownerId, { enabled: false, daysBeforeDue: [3], timezone: "Asia/Bangkok", scheduleCronTaskUid: taskUid });
    await expect(evaluateReceivableRemindersByTaskUid(taskUid, new Date("2026-08-27T10:00:00.000Z"))).resolves.toMatchObject({ skipped: "disabled", created: 0 });
  });
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { daysBetweenDateKeys, getLocalDateKey, getReminderCandidate, getScheduleAction, normalizeReminderDays } from "./receivableReminders";

const baseReceivable = {
  id: 19,
  invoiceId: 9,
  documentNumber: "IV-202608-019",
  customerName: "ลูกค้าทดสอบ",
  dueDate: new Date("2026-08-30T23:59:59.000Z"),
  totalAmount: "1000.00",
  paidAmount: "0.00",
  status: "open" as const,
};

describe("receivable reminder business rules", () => {
  it("uses Asia/Bangkok calendar-day boundaries rather than the browser timezone", () => {
    expect(getLocalDateKey(new Date("2026-08-27T16:59:59.000Z"))).toBe("2026-08-27");
    expect(getLocalDateKey(new Date("2026-08-27T17:00:00.000Z"))).toBe("2026-08-28");
    expect(daysBetweenDateKeys("2026-08-27", "2026-08-30")).toBe(3);
  });

  it("creates a due-soon candidate only at an opted-in day-before-due boundary", () => {
    const atThreeDays = getReminderCandidate(baseReceivable, [1, 3, 7], new Date("2026-08-27T01:00:00.000Z"));
    const atTwoDays = getReminderCandidate(baseReceivable, [1, 3, 7], new Date("2026-08-28T01:00:00.000Z"));
    expect(atThreeDays).toMatchObject({ reminderType: "due-soon", evaluationDate: "2026-08-27", dueDateBasis: "2026-08-30", outstandingAmount: "1000.00" });
    expect(atTwoDays).toBeNull();
  });

  it("prioritizes overdue reminders after the due-date calendar day", () => {
    expect(getReminderCandidate(baseReceivable, [1, 3, 7], new Date("2026-08-31T01:00:00.000Z"))).toMatchObject({ reminderType: "overdue", evaluationDate: "2026-08-31" });
  });

  it("excludes paid and cancelled balances but becomes eligible again after an audit-safe payment void restores balance", () => {
    expect(getReminderCandidate({ ...baseReceivable, paidAmount: "1000.00", status: "paid" }, [3], new Date("2026-08-27T01:00:00.000Z"))).toBeNull();
    expect(getReminderCandidate({ ...baseReceivable, status: "cancelled" }, [3], new Date("2026-08-27T01:00:00.000Z"))).toBeNull();
    expect(getReminderCandidate({ ...baseReceivable, paidAmount: "0.00", status: "open" }, [3], new Date("2026-08-27T01:00:00.000Z"))).toMatchObject({ reminderType: "due-soon" });
  });

  it("normalizes selected lead days and gives one schedule lifecycle action for each state", () => {
    expect(normalizeReminderDays([7, 1, 3, 3])).toEqual([1, 3, 7]);
    expect(getScheduleAction({ enabled: true, existingTaskUid: null })).toBe("create");
    expect(getScheduleAction({ enabled: true, existingTaskUid: "task-1" })).toBe("resume");
    expect(getScheduleAction({ enabled: false, existingTaskUid: "task-1" })).toBe("pause");
    expect(getScheduleAction({ enabled: false, existingTaskUid: null })).toBe("none");
  });
});

describe("receivable reminder idempotency strategy", () => {
  it("enforces one owner/receivable/type/local-day reminder at the database boundary", async () => {
    const migration = await readFile(new URL("../drizzle/0010_majestic_roland_deschain.sql", import.meta.url), "utf8");
    expect(migration).toContain("CONSTRAINT `reminder_user_receivable_type_day_unique` UNIQUE(`userId`,`receivableId`,`reminderType`,`evaluationDate`)");
  });

  it("uses one transaction and duplicate-key recovery for retry-safe scheduled evaluation", async () => {
    const implementation = await readFile(new URL("./db.ts", import.meta.url), "utf8");
    const evaluation = implementation.slice(implementation.indexOf("export async function evaluateReceivableReminders"), implementation.indexOf("export async function evaluateReceivableRemindersByTaskUid"));
    expect(evaluation).toContain("await db.transaction");
    expect(evaluation).toContain("isDuplicateKeyError(error)");
    expect(evaluation).toContain("lastEvaluatedAt");
  });
});

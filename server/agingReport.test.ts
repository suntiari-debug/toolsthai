import { describe, expect, it } from "vitest";
import { buildReceivableAgingReport, getAgingBucket, getDaysPastDue, getMonthBounds } from "./agingReport";

describe("receivable aging report", () => {
  it("assigns calendar-day aging buckets without time-of-day drift", () => {
    const asOf = new Date("2026-08-31T00:00:00.000Z");
    expect(getDaysPastDue(new Date("2026-08-31T23:59:59.000Z"), asOf)).toBe(0);
    expect(getAgingBucket(0)).toBe("current");
    expect(getAgingBucket(30)).toBe("1-30");
    expect(getAgingBucket(31)).toBe("31-60");
    expect(getAgingBucket(61)).toBe("61-90");
    expect(getAgingBucket(91)).toBe("90-plus");
  });

  it("totals outstanding balances by aging bucket and excludes paid/cancelled invoices", () => {
    const report = buildReceivableAgingReport({ asOf: new Date("2026-08-31T00:00:00.000Z"), month: "2026-08", rows: [
      { id: 1, invoiceId: 1, documentNumber: "IV-CURRENT", customerName: "A", issueDate: new Date("2026-08-01"), dueDate: new Date("2026-09-04"), totalAmount: "100.00", paidAmount: "0.00", status: "open" },
      { id: 2, invoiceId: 2, documentNumber: "IV-1-30", customerName: "B", issueDate: new Date("2026-08-01"), dueDate: new Date("2026-08-30"), totalAmount: "100.00", paidAmount: "20.00", status: "partial" },
      { id: 3, invoiceId: 3, documentNumber: "IV-31-60", customerName: "C", issueDate: new Date("2026-07-01"), dueDate: new Date("2026-07-31"), totalAmount: "200.00", paidAmount: "0.00", status: "overdue" },
      { id: 4, invoiceId: 4, documentNumber: "IV-61-90", customerName: "D", issueDate: new Date("2026-06-01"), dueDate: new Date("2026-06-30"), totalAmount: "300.00", paidAmount: "0.00", status: "overdue" },
      { id: 5, invoiceId: 5, documentNumber: "IV-90", customerName: "E", issueDate: new Date("2026-05-01"), dueDate: new Date("2026-05-01"), totalAmount: "400.00", paidAmount: "0.00", status: "overdue" },
      { id: 6, invoiceId: 6, documentNumber: "IV-PAID", customerName: "F", issueDate: new Date("2026-08-01"), dueDate: new Date("2026-08-03"), totalAmount: "100.00", paidAmount: "100.00", status: "paid" },
      { id: 7, invoiceId: 7, documentNumber: "IV-CANCEL", customerName: "G", issueDate: new Date("2026-08-01"), dueDate: new Date("2026-08-03"), totalAmount: "100.00", paidAmount: "0.00", status: "cancelled" },
    ], payments: [{ amount: "25.00", method: "transfer" }, { amount: "5.00", method: "cash" }] });
    expect(report.summary).toMatchObject({ outstanding: "1080.00", invoiceCount: 5, collectedThisMonth: "30.00", paymentCount: 2, collectedByMethod: { transfer: "25.00", cash: "5.00" } });
    expect(report.buckets.map(({ key, count, outstanding }) => ({ key, count, outstanding }))).toEqual([{ key: "current", count: 1, outstanding: "100.00" }, { key: "1-30", count: 1, outstanding: "80.00" }, { key: "31-60", count: 1, outstanding: "200.00" }, { key: "61-90", count: 1, outstanding: "300.00" }, { key: "90-plus", count: 1, outstanding: "400.00" }]);
  });

  it("returns exact UTC month boundaries", () => {
    expect(getMonthBounds("2026-08")).toEqual({ start: new Date("2026-08-01T00:00:00.000Z"), end: new Date("2026-09-01T00:00:00.000Z") });
  });
});

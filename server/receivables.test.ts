import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { buildReceivableActivityEvent, calculateInvoiceTotal, deriveReceivableStatus, validatePaymentAmount } from "./receivables";
import { afterEach, vi } from "vitest";

const invoice = {
  kind: "invoice",
  documentNumber: "IV-202608-001",
  items: [{ quantity: 2, unitPrice: 1000 }, { quantity: 1, unitPrice: 500 }],
  discount: 100,
  vatRate: 7,
  vatMode: "excluded" as const,
};

describe("receivables business rules", () => {
  it("calculates invoice totals in cents-safe money values", () => {
    expect(calculateInvoiceTotal(invoice)).toMatchObject({ subtotal: "2500.00", discount: "100.00", beforeVat: "2400.00", vat: "168.00", total: "2568.00", totalCents: 256800 });
  });

  it("supports included and no VAT totals", () => {
    expect(calculateInvoiceTotal({ ...invoice, vatMode: "included" })).toMatchObject({ total: "2400.00", vat: "157.01" });
    expect(calculateInvoiceTotal({ ...invoice, vatMode: "none" })).toMatchObject({ total: "2400.00", vat: "0.00" });
  });

  it("derives lifecycle status from total, paid, and due date", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    expect(deriveReceivableStatus("1000.00", "0.00", new Date("2026-08-28T00:00:00.000Z"), now)).toBe("open");
    expect(deriveReceivableStatus("1000.00", "300.00", new Date("2026-08-28T00:00:00.000Z"), now)).toBe("partial");
    expect(deriveReceivableStatus("1000.00", "0.00", new Date("2026-08-26T00:00:00.000Z"), now)).toBe("overdue");
    expect(deriveReceivableStatus("1000.00", "1000.00", new Date("2026-08-26T00:00:00.000Z"), now)).toBe("paid");
  });

  it("rejects overpayment and accepts payment up to the balance", () => {
    expect(validatePaymentAmount("1000.00", "250.00", "800.01")).toMatchObject({ valid: false });
    expect(validatePaymentAmount("1000.00", "250.00", "750.00")).toMatchObject({ valid: true, amountCents: 75000, outstandingCents: 75000 });
  });

  it("preserves the authenticated owner and normalized money in activity events", () => {
    expect(buildReceivableActivityEvent({ userId: 321, receivableId: 19, type: "payment-recorded", amount: "400", note: "  โอนแล้ว  " })).toEqual({ userId: 321, receivableId: 19, type: "payment-recorded", amount: "400.00", note: "โอนแล้ว" });
    expect(buildReceivableActivityEvent({ userId: 321, receivableId: 19, type: "created" })).toMatchObject({ userId: 321, receivableId: 19, type: "created", amount: null, note: null });
  });
});

describe("receivables router access", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires an authenticated owner context", async () => {
    const ctx = { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.receivables.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("passes the authenticated user ID to an owner-scoped receivables list", async () => {
    const listReceivables = vi.spyOn(db, "listReceivables").mockResolvedValue({ items: [], summary: { total: "0.00", outstanding: "0.00", overdue: "0.00", dueSoon: "0.00", collectedThisMonth: "0.00" } });
    const ctx = { user: { id: 321, openId: "owner-321", name: "Owner", email: "owner@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.receivables.list()).resolves.toMatchObject({ items: [], summary: { outstanding: "0.00" } });
    expect(listReceivables).toHaveBeenCalledWith(321);
  });

  it("passes the authenticated user ID to a partial payment mutation", async () => {
    const recordPayment = vi.spyOn(db, "recordPayment").mockResolvedValue({ paidAmount: "400.00", status: "partial" });
    const ctx = { user: { id: 321, openId: "owner-321", name: "Owner", email: "owner@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    await appRouter.createCaller(ctx).receivables.recordPayment({ receivableId: 19, amount: 400, paidAt: "2026-08-27", method: "transfer", note: "โอนแล้ว" });
    expect(recordPayment).toHaveBeenCalledWith(321, expect.objectContaining({ receivableId: 19, amount: 400, method: "transfer", note: "โอนแล้ว" }));
  });

  it("returns newest activity events through an owner-scoped receivable detail query", async () => {
    const events = [
      { id: 82, type: "payment-recorded", amount: "400.00", note: null, createdAt: new Date("2026-08-27T10:00:00.000Z") },
      { id: 81, type: "created", amount: "1000.00", note: "เพิ่มจากใบแจ้งหนี้", createdAt: new Date("2026-08-26T10:00:00.000Z") },
    ];
    const getReceivableDetails = vi.spyOn(db, "getReceivableDetails").mockResolvedValue({ id: 19, userId: 321, events } as never);
    const ctx = { user: { id: 321, openId: "owner-321", name: "Owner", email: "owner@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    await expect(appRouter.createCaller(ctx).receivables.get({ id: 19 })).resolves.toMatchObject({ id: 19, events });
    expect(getReceivableDetails).toHaveBeenCalledWith(321, 19);
  });
});

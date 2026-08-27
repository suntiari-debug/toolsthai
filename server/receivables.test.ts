import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { calculateInvoiceTotal, deriveReceivableStatus, validatePaymentAmount } from "./receivables";

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
});

describe("receivables router access", () => {
  it("requires an authenticated owner context", async () => {
    const ctx = { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.receivables.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns an empty owner-scoped list when database is unavailable", async () => {
    const ctx = { user: { id: 321, openId: "owner-321", name: "Owner", email: "owner@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.receivables.list()).resolves.toMatchObject({ items: [], summary: { outstanding: "0.00" } });
  });
});

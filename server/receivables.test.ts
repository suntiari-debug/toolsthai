import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { buildReceivableActivityEvent, calculateInvoiceTotal, deriveReceivableStatus, getReceiptDraftEligibility, hasReceiptSourcePaymentChanged, validatePaymentAmount } from "./receivables";
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

  it("allows receipt drafts only when active payments settle a non-cancelled receivable", () => {
    expect(getReceiptDraftEligibility("paid", "1000.00", "1000.00")).toEqual({ eligible: true, reason: null });
    expect(getReceiptDraftEligibility("partial", "1000.00", "400.00")).toEqual({ eligible: false, reason: "ออกใบเสร็จได้เมื่อยอดคงเหลือเป็น ฿0.00" });
    expect(getReceiptDraftEligibility("cancelled", "1000.00", "1000.00")).toEqual({ eligible: false, reason: "รายการลูกหนี้นี้ถูกยกเลิกแล้ว" });
  });

  it("flags a receipt source warning when active payment identities or the settled total change", () => {
    expect(hasReceiptSourcePaymentChanged([71, 72], [72, 71], "1000.00", "1000.00")).toBe(false);
    expect(hasReceiptSourcePaymentChanged([71, 72], [73], "1000.00", "1000.00")).toBe(true);
    expect(hasReceiptSourcePaymentChanged([71, 72], [71, 72], "1000.00", "900.00")).toBe(true);
  });

  it("preserves the authenticated owner and normalized money in activity events", () => {
    expect(buildReceivableActivityEvent({ userId: 321, receivableId: 19, type: "payment-recorded", amount: "400", note: "  โอนแล้ว  " })).toEqual({ userId: 321, receivableId: 19, type: "payment-recorded", paymentId: null, amount: "400.00", note: "โอนแล้ว" });
    expect(buildReceivableActivityEvent({ userId: 321, receivableId: 19, type: "created" })).toMatchObject({ userId: 321, receivableId: 19, type: "created", paymentId: null, amount: null, note: null });
  });

  it("records payment linkage for audit-safe void and replacement activity events", () => {
    expect(buildReceivableActivityEvent({ userId: 321, receivableId: 19, type: "payment-voided", paymentId: 71, amount: "400", note: "เลขอ้างอิงผิด" })).toMatchObject({ userId: 321, receivableId: 19, type: "payment-voided", paymentId: 71, amount: "400.00" });
    expect(buildReceivableActivityEvent({ userId: 321, receivableId: 19, type: "payment-replaced", paymentId: 71, amount: "400" })).toMatchObject({ type: "payment-replaced", paymentId: 71, amount: "400.00" });
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

  it("passes audit-safe void and replacement requests through the authenticated owner", async () => {
    const voidPayment = vi.spyOn(db, "voidPayment").mockResolvedValue({ receivableId: 19, paidAmount: "0.00", status: "open" } as never);
    const replacePayment = vi.spyOn(db, "replacePayment").mockResolvedValue({ receivableId: 19, paidAmount: "350.00", status: "partial", replacementId: 72 } as never);
    const caller = appRouter.createCaller({ user: { id: 321, openId: "owner-321", name: "Owner", email: "owner@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext);
    await caller.receivables.voidPayment({ paymentId: 71, reason: "เลขอ้างอิงผิด" });
    await caller.receivables.replacePayment({ paymentId: 71, receivableId: 19, amount: 350, paidAt: "2026-08-27", method: "transfer", reason: "แก้ไขยอดตามสลิป", reference: "TRX-072" });
    expect(voidPayment).toHaveBeenCalledWith(321, { paymentId: 71, reason: "เลขอ้างอิงผิด" });
    expect(replacePayment).toHaveBeenCalledWith(321, expect.objectContaining({ paymentId: 71, receivableId: 19, amount: 350, method: "transfer", reference: "TRX-072" }));
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

  it("looks up a document-center receivable by invoice through the authenticated owner", async () => {
    const getReceivableByInvoice = vi.spyOn(db, "getReceivableByInvoice").mockResolvedValue({ id: 19, invoiceId: 8, userId: 321, events: [] } as never);
    const ctx = { user: { id: 321, openId: "owner-321", name: "Owner", email: "owner@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    await expect(appRouter.createCaller(ctx).receivables.getByInvoice({ invoiceId: 8 })).resolves.toMatchObject({ id: 19, invoiceId: 8 });
    expect(getReceivableByInvoice).toHaveBeenCalledWith(321, 8);
  });

  it("creates the aging report only with the authenticated owner and validated report period", async () => {
    const getReceivableAgingReport = vi.spyOn(db, "getReceivableAgingReport").mockResolvedValue({ asOf: new Date("2026-08-31T00:00:00.000Z"), month: "2026-08", buckets: [], items: [], summary: { outstanding: "0.00", invoiceCount: 0, collectedThisMonth: "0.00", paymentCount: 0, collectedByMethod: {} } } as never);
    const ctx = { user: { id: 321, openId: "owner-321", name: "Owner", email: "owner@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    await expect(appRouter.createCaller(ctx).receivables.agingReport({ asOf: "2026-08-31", month: "2026-08" })).resolves.toMatchObject({ month: "2026-08" });
    expect(getReceivableAgingReport).toHaveBeenCalledWith(321, { asOf: new Date("2026-08-31T00:00:00.000Z"), month: "2026-08" });
  });

  it("uses the authenticated owner for receipt eligibility and receipt draft creation", async () => {
    const getReceiptEligibility = vi.spyOn(db, "getReceiptEligibility").mockResolvedValue({ eligible: true, reason: null, receivable: { id: 19 }, invoice: { id: 8 }, payments: [], receiptDraft: null, sourceChanged: false } as never);
    const createReceiptDraft = vi.spyOn(db, "createReceiptDraft").mockResolvedValue({ id: 77, documentNumber: "RC-202608-0019", payload: "{}", createdAt: new Date(), created: true });
    const ctx = { user: { id: 321, openId: "owner-321", name: "Owner", email: "owner@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.receivables.receiptEligibility({ receivableId: 19 })).resolves.toMatchObject({ eligible: true });
    await expect(caller.receivables.createReceiptDraft({ receivableId: 19 })).resolves.toMatchObject({ id: 77, created: true });
    expect(getReceiptEligibility).toHaveBeenCalledWith(321, 19);
    expect(createReceiptDraft).toHaveBeenCalledWith(321, 19);
  });

  it("rejects receipt draft access when the receivable is not owned by the authenticated caller", async () => {
    const denied = new Error("ไม่พบรายการลูกหนี้ของผู้ใช้รายนี้");
    const getReceiptEligibility = vi.spyOn(db, "getReceiptEligibility").mockImplementation(async (userId) => { if (userId !== 321) throw denied; return { eligible: true } as never; });
    const createReceiptDraft = vi.spyOn(db, "createReceiptDraft").mockImplementation(async (userId) => { if (userId !== 321) throw denied; return { id: 77 } as never; });
    const otherUser = { user: { id: 999, openId: "other-owner", name: "Other", email: "other@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const caller = appRouter.createCaller(otherUser);
    await expect(caller.receivables.receiptEligibility({ receivableId: 19 })).rejects.toThrow("ไม่พบรายการลูกหนี้ของผู้ใช้รายนี้");
    await expect(caller.receivables.createReceiptDraft({ receivableId: 19 })).rejects.toThrow("ไม่พบรายการลูกหนี้ของผู้ใช้รายนี้");
    expect(getReceiptEligibility).toHaveBeenCalledWith(999, 19);
    expect(createReceiptDraft).toHaveBeenCalledWith(999, 19);
  });
});

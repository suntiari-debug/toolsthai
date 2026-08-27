export type ReceivableStatus = "open" | "partial" | "paid" | "overdue" | "cancelled";

export type InvoicePayloadLike = {
  issueDate?: string;
  dueDate?: string;
  documentNumber?: string;
  kind?: string;
  company?: { name?: string; address?: string };
  customer?: { name?: string; address?: string };
  items?: Array<{ quantity?: number; unitPrice?: number }>;
  discount?: number;
  vatRate?: number;
  vatMode?: "excluded" | "included" | "none";
  note?: string;
};

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function moneyToCents(value: number | string) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Math.round((Number(parsed) || 0) * 100);
}

export function centsToMoney(value: number) {
  return (Math.round(Number(value) || 0) / 100).toFixed(2);
}

export function calculateInvoiceTotal(payload: InvoicePayloadLike) {
  const subtotalCents = (payload.items || []).reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPriceCents = moneyToCents(Number(item.unitPrice) || 0);
    return sum + Math.round(quantity * unitPriceCents);
  }, 0);
  const discountCents = Math.min(Math.max(moneyToCents(payload.discount || 0), 0), subtotalCents);
  const beforeVatCents = subtotalCents - discountCents;
  const vatRate = Math.max(Number(payload.vatRate) || 0, 0);
  let vatCents = 0;
  let totalCents = beforeVatCents;
  if (payload.vatMode === "included") {
    vatCents = vatRate ? Math.round((beforeVatCents * vatRate) / (100 + vatRate)) : 0;
  } else if (payload.vatMode !== "none") {
    vatCents = Math.round((beforeVatCents * vatRate) / 100);
    totalCents = beforeVatCents + vatCents;
  }
  return {
    subtotal: centsToMoney(subtotalCents),
    discount: centsToMoney(discountCents),
    beforeVat: centsToMoney(beforeVatCents),
    vat: centsToMoney(vatCents),
    total: centsToMoney(totalCents),
    totalCents,
  };
}

export function deriveReceivableStatus(totalAmount: number | string, paidAmount: number | string, dueAt: Date, now = new Date()): ReceivableStatus {
  const totalCents = moneyToCents(totalAmount);
  const paidCents = Math.min(Math.max(moneyToCents(paidAmount), 0), totalCents);
  if (totalCents > 0 && paidCents >= totalCents) return "paid";
  if (paidCents > 0) return "partial";
  if (dueAt.getTime() < now.getTime()) return "overdue";
  return "open";
}

export function validatePaymentAmount(totalAmount: number | string, paidAmount: number | string, paymentAmount: number | string) {
  const outstandingCents = moneyToCents(totalAmount) - moneyToCents(paidAmount);
  const amountCents = moneyToCents(paymentAmount);
  if (amountCents <= 0) return { valid: false as const, reason: "จำนวนรับชำระต้องมากกว่า 0" };
  if (amountCents > outstandingCents) return { valid: false as const, reason: "จำนวนรับชำระมากกว่ายอดคงเหลือ" };
  return { valid: true as const, amountCents, outstandingCents };
}

export function getReceiptDraftEligibility(status: ReceivableStatus, totalAmount: number | string, activePaymentTotal: number | string) {
  if (status === "cancelled") return { eligible: false as const, reason: "รายการลูกหนี้นี้ถูกยกเลิกแล้ว" };
  if (moneyToCents(totalAmount) <= 0 || moneyToCents(activePaymentTotal) !== moneyToCents(totalAmount)) return { eligible: false as const, reason: "ออกใบเสร็จได้เมื่อยอดคงเหลือเป็น ฿0.00" };
  return { eligible: true as const, reason: null };
}

export function hasReceiptSourcePaymentChanged(createdPaymentIds: number[], paymentIdsNow: number[], paymentTotalAtCreation: number | string, paymentTotalNow: number | string) {
  const normalizeIds = (ids: number[]) => [...ids].filter((id) => Number.isInteger(id) && id > 0).sort((left, right) => left - right);
  const created = normalizeIds(createdPaymentIds);
  const current = normalizeIds(paymentIdsNow);
  return created.length !== current.length || created.some((id, index) => id !== current[index]) || moneyToCents(paymentTotalAtCreation) !== moneyToCents(paymentTotalNow);
}

export function buildReceivableActivityEvent(input: { userId: number; receivableId: number; type: "created" | "payment-recorded" | "payment-voided" | "payment-replaced" | "receipt-draft-created" | "payment-attachment-added" | "payment-attachment-removed"; paymentId?: number | null; amount?: number | string | null; note?: string | null }) {
  return {
    userId: input.userId,
    receivableId: input.receivableId,
    type: input.type,
    paymentId: input.paymentId ?? null,
    amount: input.amount === null || input.amount === undefined ? null : centsToMoney(moneyToCents(input.amount)),
    note: input.note?.trim() || null,
  };
}

export function parseDateOnly(value: string, endOfDay = false) {
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime())) throw new Error("รูปแบบวันที่ไม่ถูกต้อง");
  return date;
}

export function parseInvoicePayload(payload: string): InvoicePayloadLike {
  const parsed = JSON.parse(payload) as InvoicePayloadLike;
  if (!parsed || typeof parsed !== "object") throw new Error("ข้อมูลใบแจ้งหนี้ไม่ถูกต้อง");
  if (parsed.kind && parsed.kind !== "invoice") throw new Error("เลือกได้เฉพาะใบแจ้งหนี้");
  if (!parsed.documentNumber) throw new Error("ใบแจ้งหนี้ไม่มีเลขที่เอกสาร");
  return parsed;
}

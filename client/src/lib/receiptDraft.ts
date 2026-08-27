export type ReceiptSourceContext = {
  sourceInvoiceId: number;
  sourceReceivableId: number;
  activePaymentIds: number[];
  paymentTotalAtCreation: string;
  createdFrom: "receivable-paid";
  sourceInvoiceNumber: string;
};

export function parseReceiptSourceContext(payload: string): ReceiptSourceContext | null {
  try {
    const parsed = JSON.parse(payload) as { kind?: string; receiptSource?: Partial<ReceiptSourceContext> };
    const source = parsed.receiptSource;
    if (parsed.kind !== "receipt" || !source || source.createdFrom !== "receivable-paid" || typeof source.sourceInvoiceId !== "number" || !Number.isInteger(source.sourceInvoiceId) || typeof source.sourceReceivableId !== "number" || !Number.isInteger(source.sourceReceivableId) || !Array.isArray(source.activePaymentIds) || !source.activePaymentIds.every((id) => Number.isInteger(id) && id > 0) || typeof source.paymentTotalAtCreation !== "string" || typeof source.sourceInvoiceNumber !== "string") return null;
    return { sourceInvoiceId: source.sourceInvoiceId, sourceReceivableId: source.sourceReceivableId, activePaymentIds: source.activePaymentIds, paymentTotalAtCreation: source.paymentTotalAtCreation, createdFrom: "receivable-paid", sourceInvoiceNumber: source.sourceInvoiceNumber };
  } catch {
    return null;
  }
}

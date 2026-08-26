export const documentStatuses = ["draft", "sent", "paid", "overdue"] as const;
export type DocumentStatus = (typeof documentStatuses)[number];

export function makeCopyDocumentNumber(documentNumber: string, timestamp = Date.now()) {
  const suffix = `-COPY-${timestamp.toString(36).toUpperCase()}`;
  return `${documentNumber.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
}

export type DuplicateDocumentSource = {
  kind: "quotation" | "invoice" | "receipt" | "delivery-note" | "tax-invoice";
  documentNumber: string;
  customerName: string | null;
  payload: string;
};

export function createDuplicateDocument(source: DuplicateDocumentSource, timestamp = Date.now()) {
  return { kind: source.kind, documentNumber: makeCopyDocumentNumber(source.documentNumber, timestamp), customerName: source.customerName, payload: source.payload, status: "draft" as const };
}

export function summarizeDocumentStatuses(documents: ReadonlyArray<{ status: DocumentStatus }>) {
  return {
    total: documents.length,
    awaiting: documents.filter((document) => document.status === "sent" || document.status === "overdue").length,
    paid: documents.filter((document) => document.status === "paid").length,
  };
}

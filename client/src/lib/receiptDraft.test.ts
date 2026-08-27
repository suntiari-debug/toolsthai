import { describe, expect, it } from "vitest";
import { parseReceiptSourceContext } from "./receiptDraft";

describe("receipt draft source context", () => {
  it("returns a validated receipt source context from a server-created payload", () => {
    expect(parseReceiptSourceContext(JSON.stringify({ kind: "receipt", receiptSource: { sourceInvoiceId: 8, sourceReceivableId: 19, activePaymentIds: [72, 73], paymentTotalAtCreation: "1000.00", createdFrom: "receivable-paid", sourceInvoiceNumber: "IV-202608-008" } }))).toMatchObject({ sourceInvoiceId: 8, sourceReceivableId: 19, activePaymentIds: [72, 73], sourceInvoiceNumber: "IV-202608-008" });
  });

  it("rejects missing, malformed, or non-receipt source context", () => {
    expect(parseReceiptSourceContext("not-json")).toBeNull();
    expect(parseReceiptSourceContext(JSON.stringify({ kind: "invoice", receiptSource: { sourceReceivableId: 19 } }))).toBeNull();
    expect(parseReceiptSourceContext(JSON.stringify({ kind: "receipt", receiptSource: { sourceInvoiceId: 8, sourceReceivableId: 19, activePaymentIds: [0], paymentTotalAtCreation: "1000.00", createdFrom: "receivable-paid", sourceInvoiceNumber: "IV-008" } }))).toBeNull();
  });
});

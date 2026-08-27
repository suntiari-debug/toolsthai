import { describe, expect, it } from "vitest";
import { DOCUMENT_REVISION_RETENTION, clampDocumentRevisionPage, getRestoredDocumentFields, summarizeDocumentRevision } from "./documentRevisions";

describe("document revision contracts", () => {
  it("uses bounded metadata pagination, non-destructive retention, and field summaries", () => {
    expect(clampDocumentRevisionPage({ page: -2, pageSize: 100 })).toEqual({ page: 1, pageSize: 20 });
    expect(DOCUMENT_REVISION_RETENTION).toBe("non-destructive");
    expect(summarizeDocumentRevision(null, JSON.stringify({ documentNumber: "QT-001", customer: { name: "บริษัท เอ" } }), "QT-001")).toBe("บันทึกครั้งแรก · QT-001");
    expect(summarizeDocumentRevision(JSON.stringify({ documentNumber: "QT-001", customer: { name: "บริษัท เอ" }, items: [{}] }), JSON.stringify({ documentNumber: "QT-002", customer: { name: "บริษัท บี" }, items: [{}, {}] }), "QT-002")).toContain("เลขที่เอกสาร");
    expect(getRestoredDocumentFields(JSON.stringify({ documentNumber: "QT-001", customerId: 9, customer: { name: "บริษัท เอ" } }), { documentNumber: "fallback", customerName: null, customerId: null })).toEqual({ documentNumber: "QT-001", customerName: "บริษัท เอ", customerId: 9 });
  });
});

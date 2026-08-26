import { describe, expect, it, vi } from "vitest";
import { restoreDocument } from "../client/src/lib/document";
import { duplicateSavedDocumentFromStore, type DuplicateDocumentStore } from "./db";

describe("duplicateSavedDocumentFromStore", () => {
  it("loads only the owner source, inserts a draft copy with the original payload, and keeps it editor-ready", async () => {
    const source = { kind: "invoice" as const, documentNumber: "IV-2026-001", customerName: "บริษัท เอซีมี", payload: JSON.stringify({ kind: "invoice", customer: { name: "บริษัท เอซีมี" }, items: [] }) };
    const insert = vi.fn<DuplicateDocumentStore["insert"]>().mockResolvedValue(undefined);
    const store: DuplicateDocumentStore = { findByOwner: vi.fn().mockResolvedValue(source), insert };

    const result = await duplicateSavedDocumentFromStore(store, 41, 9);
    const inserted = insert.mock.calls[0]?.[0];

    expect(store.findByOwner).toHaveBeenCalledWith(41, 9);
    expect(result.documentNumber).toContain("-COPY-");
    expect(inserted).toMatchObject({ userId: 41, kind: "invoice", customerName: "บริษัท เอซีมี", payload: source.payload, status: "draft" });
    expect(restoreDocument(inserted!.payload, "invoice").kind).toBe("invoice");
  });

  it("does not insert a copy when the document does not belong to the caller", async () => {
    const insert = vi.fn<DuplicateDocumentStore["insert"]>().mockResolvedValue(undefined);
    const store: DuplicateDocumentStore = { findByOwner: vi.fn().mockResolvedValue(null), insert };

    await expect(duplicateSavedDocumentFromStore(store, 41, 999)).rejects.toThrow("ไม่พบเอกสารที่ต้องการทำสำเนา");
    expect(insert).not.toHaveBeenCalled();
  });
});

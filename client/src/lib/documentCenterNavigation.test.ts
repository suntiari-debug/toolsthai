import { describe, expect, it } from "vitest";
import { createDuplicateDocument } from "@shared/documentCenter";
import { createInitialDocument, restoreDocument } from "./document";
import { createDocumentResume, DOCUMENT_RESUME_STORAGE_KEY, persistDocumentResume, restoreDocumentResume } from "./documentCenterNavigation";

function createMemoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}

describe("document center navigation", () => {
  it("prepares the same storage key and editor route used by document restore", () => {
    expect(createDocumentResume('{"kind":"invoice"}', "invoice")).toEqual({
      storageKey: DOCUMENT_RESUME_STORAGE_KEY,
      payload: '{"kind":"invoice"}',
      path: "/invoice",
    });
  });

  it("persists and restores an editor-ready document payload through the same session storage flow used by the components", () => {
    const source = createInitialDocument("quotation");
    const storage = createMemoryStorage();
    const resume = persistDocumentResume(storage, JSON.stringify(source), "invoice");
    const restored = restoreDocumentResume(storage, "invoice");

    expect(resume.storageKey).toBe(DOCUMENT_RESUME_STORAGE_KEY);
    expect(resume.path).toBe("/invoice");
    expect(restored?.kind).toBe("invoice");
    expect(restored?.items).toEqual(source.items);
    expect(storage.getItem(DOCUMENT_RESUME_STORAGE_KEY)).toBeNull();
  });

  it("keeps the actual duplicate payload editor-ready while assigning a distinct draft number", () => {
    const source = createInitialDocument("invoice");
    const duplicate = createDuplicateDocument({ kind: source.kind, documentNumber: source.documentNumber, customerName: source.customer.name || null, payload: JSON.stringify(source) }, 1_775_000_000_000);
    const storage = createMemoryStorage();
    persistDocumentResume(storage, duplicate.payload, duplicate.kind);
    const restored = restoreDocumentResume(storage, duplicate.kind);

    expect(duplicate.documentNumber).not.toBe(source.documentNumber);
    expect(duplicate.documentNumber).toContain("-COPY-");
    expect(duplicate.status).toBe("draft");
    expect(restored?.customer.name).toBe(source.customer.name);
    expect(restored?.kind).toBe("invoice");
  });
});

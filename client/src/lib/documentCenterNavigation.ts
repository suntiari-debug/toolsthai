import { restoreDocument, type BusinessDocument, type DocumentKind } from "./document";

export const DOCUMENT_RESUME_STORAGE_KEY = "toolsThai.convertedDocument";

export function createDocumentResume(payload: string, kind: DocumentKind) {
  return { storageKey: DOCUMENT_RESUME_STORAGE_KEY, payload, path: `/${kind}` };
}

type ResumeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function persistDocumentResume(storage: ResumeStorage, payload: string, kind: DocumentKind) {
  const resume = createDocumentResume(payload, kind);
  storage.setItem(resume.storageKey, resume.payload);
  return resume;
}

export function restoreDocumentResume(storage: ResumeStorage, kind: DocumentKind): BusinessDocument | null {
  const payload = storage.getItem(DOCUMENT_RESUME_STORAGE_KEY);
  if (!payload) return null;
  try {
    return restoreDocument(payload, kind);
  } catch {
    return null;
  } finally {
    storage.removeItem(DOCUMENT_RESUME_STORAGE_KEY);
  }
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: { id: 41, openId: "document-owner", email: "owner@example.com", name: "Owner", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterEach(() => vi.restoreAllMocks());

describe("documents router", () => {
  it("passes search and filter input to the authenticated owner's document query", async () => {
    const list = vi.spyOn(db, "listSavedDocuments").mockResolvedValue([]);
    const caller = appRouter.createCaller(createContext());

    await caller.documents.list({ query: "ACME", kind: "invoice", status: "sent" });

    expect(list).toHaveBeenCalledWith(41, { query: "ACME", kind: "invoice", status: "sent" });
  });

  it("scopes status, archive, and duplicate mutations to the authenticated owner", async () => {
    const status = vi.spyOn(db, "setDocumentStatus").mockResolvedValue(undefined);
    const archived = vi.spyOn(db, "setDocumentArchived").mockResolvedValue(undefined);
    const duplicate = vi.spyOn(db, "duplicateSavedDocument").mockResolvedValue({ documentNumber: "IV-001-COPY-ABC" });
    const caller = appRouter.createCaller(createContext());

    await caller.documents.updateStatus({ id: 9, status: "paid" });
    await caller.documents.setArchived({ id: 9, archived: true });
    await expect(caller.documents.duplicate({ id: 9 })).resolves.toEqual({ documentNumber: "IV-001-COPY-ABC" });

    expect(status).toHaveBeenCalledWith(41, 9, "paid");
    expect(archived).toHaveBeenCalledWith(41, 9, true);
    expect(duplicate).toHaveBeenCalledWith(41, 9);
  });

  it("records and reads PDF export history through the authenticated owner", async () => {
    const record = vi.spyOn(db, "recordDocumentExport").mockResolvedValue({ documentId: 12 });
    const listExports = vi.spyOn(db, "listDocumentExports").mockResolvedValue([]);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.documents.recordExport({ kind: "quotation", documentNumber: "QT-001", customerName: "ACME", payload: "{}", filename: "ใบเสนอราคา ACME.pdf" })).resolves.toEqual({ documentId: 12 });
    await caller.documents.listExports({ documentId: 12 });

    expect(record).toHaveBeenCalledWith({ userId: 41, kind: "quotation", documentNumber: "QT-001", customerName: "ACME", payload: "{}", filename: "ใบเสนอราคา ACME.pdf" });
    expect(listExports).toHaveBeenCalledWith(41, 12);
  });
});

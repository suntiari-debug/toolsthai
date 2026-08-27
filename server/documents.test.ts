import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

const ownerContext = {
  user: { id: 321, openId: "owner-321", name: "Owner", email: "owner@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
} as TrpcContext;

describe("documents router access", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires authentication for document center queries", async () => {
    const caller = appRouter.createCaller({ ...ownerContext, user: null });
    await expect(caller.documents.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.documents.get({ id: 19 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("passes the authenticated owner and requested filters to the document list", async () => {
    const listSavedDocuments = vi.spyOn(db, "listSavedDocuments").mockResolvedValue([]);
    await expect(appRouter.createCaller(ownerContext).documents.list({ kind: "invoice", status: "sent", archived: false, search: "IV-2026" })).resolves.toEqual([]);
    expect(listSavedDocuments).toHaveBeenCalledWith(321, { kind: "invoice", status: "sent", archived: false, search: "IV-2026" });
  });

  it("scopes get, status, archive, and duplicate operations to the authenticated owner", async () => {
    const getSavedDocument = vi.spyOn(db, "getSavedDocument").mockResolvedValue(null);
    const updateSavedDocumentStatus = vi.spyOn(db, "updateSavedDocumentStatus").mockResolvedValue(null);
    const setSavedDocumentArchived = vi.spyOn(db, "setSavedDocumentArchived").mockResolvedValue(null);
    const duplicateSavedDocument = vi.spyOn(db, "duplicateSavedDocument").mockResolvedValue(null);
    const caller = appRouter.createCaller(ownerContext);
    await caller.documents.get({ id: 18 });
    await caller.documents.updateStatus({ id: 18, status: "paid" });
    await caller.documents.setArchived({ id: 18, archived: true });
    await caller.documents.duplicate({ id: 18 });
    expect(getSavedDocument).toHaveBeenCalledWith(321, 18);
    expect(updateSavedDocumentStatus).toHaveBeenCalledWith(321, 18, "paid");
    expect(setSavedDocumentArchived).toHaveBeenCalledWith(321, 18, true);
    expect(duplicateSavedDocument).toHaveBeenCalledWith(321, 18);
  });

  it("records PDF history through the server-side owner-scoped document resolver", async () => {
    const recordDocumentExportForDocument = vi.spyOn(db, "recordDocumentExportForDocument").mockResolvedValue({ documentId: 18 });
    await expect(appRouter.createCaller(ownerContext).documents.recordExportForDocument({ kind: "invoice", documentNumber: "IV-202608-018", customerName: "บริษัททดสอบ", payload: "{\"kind\":\"invoice\"}", filename: "invoice-18.pdf" })).resolves.toEqual({ documentId: 18 });
    expect(recordDocumentExportForDocument).toHaveBeenCalledWith(expect.objectContaining({ userId: 321, kind: "invoice", documentNumber: "IV-202608-018", filename: "invoice-18.pdf" }));
  });
});

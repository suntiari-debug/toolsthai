import { and, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { companyProfiles, documentExports, InsertUser, savedDocuments, users } from "../drizzle/schema";
import { createDuplicateDocument, type DocumentStatus, type DuplicateDocumentSource } from "../shared/documentCenter";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export type SavedDocumentKind = "quotation" | "invoice" | "receipt" | "delivery-note" | "tax-invoice";
export type SavedDocumentStatus = DocumentStatus;
export type DocumentExportInput = { userId: number; kind: SavedDocumentKind; documentNumber: string; customerName?: string; payload: string; filename: string };

export function summarizeDocumentExportHistory(records: Array<{ documentId: number; createdAt: Date }>) {
  const historySummary = new Map<number, { exportCount: number; lastExportedAt: Date }>();
  for (const item of records) {
    const summary = historySummary.get(item.documentId);
    historySummary.set(item.documentId, summary ? { exportCount: summary.exportCount + 1, lastExportedAt: summary.lastExportedAt } : { exportCount: 1, lastExportedAt: item.createdAt });
  }
  return historySummary;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getCompanyProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function saveCompanyProfile(input: { userId: number; name: string; address?: string | null; taxId?: string | null; phone?: string | null; email?: string | null; logoUrl?: string | null; signatureUrl?: string | null; stampUrl?: string | null; signerName?: string | null; signerPosition?: string | null; defaultDocumentTemplate?: "modern" | "classic" | "minimal" | null; defaultAccentColor?: string | null; defaultFontFamily?: "sarabun" | "noto-sans" | "noto-serif" | null; defaultFontSize?: "small" | "medium" | "large" | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(companyProfiles).values(input).onDuplicateKeyUpdate({
    set: { name: input.name, address: input.address ?? null, taxId: input.taxId ?? null, phone: input.phone ?? null, email: input.email ?? null, logoUrl: input.logoUrl ?? null, signatureUrl: input.signatureUrl ?? null, stampUrl: input.stampUrl ?? null, signerName: input.signerName ?? null, signerPosition: input.signerPosition ?? null, defaultDocumentTemplate: input.defaultDocumentTemplate ?? null, defaultAccentColor: input.defaultAccentColor ?? null, defaultFontFamily: input.defaultFontFamily ?? null, defaultFontSize: input.defaultFontSize ?? null },
  });
  return getCompanyProfile(input.userId);
}

export async function saveDocument(input: { userId: number; kind: SavedDocumentKind; documentNumber: string; customerName?: string; payload: string; status?: SavedDocumentStatus }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(savedDocuments).values(input);
}

export async function listSavedDocuments(userId: number, filters: { query?: string; kind?: SavedDocumentKind; status?: SavedDocumentStatus; includeArchived?: boolean } = {}) {
  const db = await getDb();
  if (!db) return [];
  const query = filters.query?.trim();
  const documents = await db.select({ id: savedDocuments.id, kind: savedDocuments.kind, documentNumber: savedDocuments.documentNumber, customerName: savedDocuments.customerName, payload: savedDocuments.payload, status: savedDocuments.status, archivedAt: savedDocuments.archivedAt, updatedAt: savedDocuments.updatedAt, createdAt: savedDocuments.createdAt }).from(savedDocuments).where(and(
    eq(savedDocuments.userId, userId),
    filters.includeArchived ? undefined : isNull(savedDocuments.archivedAt),
    filters.kind ? eq(savedDocuments.kind, filters.kind) : undefined,
    filters.status ? eq(savedDocuments.status, filters.status) : undefined,
    query ? or(like(savedDocuments.documentNumber, `%${query}%`), like(savedDocuments.customerName, `%${query}%`)) : undefined,
  )).orderBy(desc(savedDocuments.updatedAt)).limit(100);
  if (!documents.length) return [];
  const exports = await db.select({ documentId: documentExports.documentId, createdAt: documentExports.createdAt }).from(documentExports).where(and(eq(documentExports.userId, userId), inArray(documentExports.documentId, documents.map((document) => document.id)))).orderBy(desc(documentExports.createdAt));
  const historySummary = summarizeDocumentExportHistory(exports);
  return documents.map((document) => ({ ...document, exportCount: historySummary.get(document.id)?.exportCount ?? 0, lastExportedAt: historySummary.get(document.id)?.lastExportedAt ?? null }));
}

export async function recordDocumentExport(input: DocumentExportInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select({ id: savedDocuments.id }).from(savedDocuments).where(and(eq(savedDocuments.userId, input.userId), eq(savedDocuments.kind, input.kind), eq(savedDocuments.documentNumber, input.documentNumber))).orderBy(desc(savedDocuments.updatedAt)).limit(1);
  let documentId = existing[0]?.id;
  if (documentId) {
    await db.update(savedDocuments).set({ customerName: input.customerName ?? null, payload: input.payload, updatedAt: new Date() }).where(and(eq(savedDocuments.id, documentId), eq(savedDocuments.userId, input.userId)));
  } else {
    await db.insert(savedDocuments).values({ userId: input.userId, kind: input.kind, documentNumber: input.documentNumber, customerName: input.customerName, payload: input.payload });
    const created = await db.select({ id: savedDocuments.id }).from(savedDocuments).where(and(eq(savedDocuments.userId, input.userId), eq(savedDocuments.kind, input.kind), eq(savedDocuments.documentNumber, input.documentNumber))).orderBy(desc(savedDocuments.createdAt)).limit(1);
    documentId = created[0]?.id;
  }
  if (!documentId) throw new Error("ไม่สามารถบันทึกเอกสารสำหรับประวัติการส่งออกได้");
  await db.insert(documentExports).values({ userId: input.userId, documentId, filename: input.filename });
  return { documentId };
}

export async function listDocumentExports(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: documentExports.id, filename: documentExports.filename, createdAt: documentExports.createdAt }).from(documentExports).where(and(eq(documentExports.userId, userId), eq(documentExports.documentId, documentId))).orderBy(desc(documentExports.createdAt)).limit(30);
}

export async function setDocumentStatus(userId: number, id: number, status: SavedDocumentStatus) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(savedDocuments).set({ status }).where(and(eq(savedDocuments.id, id), eq(savedDocuments.userId, userId)));
}

export async function setDocumentArchived(userId: number, id: number, archived: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(savedDocuments).set({ archivedAt: archived ? new Date() : null }).where(and(eq(savedDocuments.id, id), eq(savedDocuments.userId, userId)));
}

export type DuplicateDocumentStore = {
  findByOwner: (userId: number, id: number) => Promise<DuplicateDocumentSource | null>;
  insert: (document: { userId: number } & ReturnType<typeof createDuplicateDocument>) => Promise<void>;
};

export async function duplicateSavedDocumentFromStore(store: DuplicateDocumentStore, userId: number, id: number) {
  const source = await store.findByOwner(userId, id);
  if (!source) throw new Error("ไม่พบเอกสารที่ต้องการทำสำเนา");
  const duplicate = createDuplicateDocument(source);
  await store.insert({ userId, ...duplicate });
  return { documentNumber: duplicate.documentNumber };
}

export async function duplicateSavedDocument(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return duplicateSavedDocumentFromStore({
    findByOwner: async (ownerId, documentId) => {
      const source = await db.select().from(savedDocuments).where(and(eq(savedDocuments.id, documentId), eq(savedDocuments.userId, ownerId))).limit(1);
      const document = source[0];
      return document ? { kind: document.kind, documentNumber: document.documentNumber, customerName: document.customerName, payload: document.payload } : null;
    },
    insert: async (document) => { await db.insert(savedDocuments).values(document); },
  }, userId, id);
}

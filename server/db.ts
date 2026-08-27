import { and, desc, eq, gte, inArray, isNull, like, lt, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { companyProfiles, customers, documentExports, InsertUser, paymentAttachments, payments, receivableEvents, receivableReminderSettings, receivableReminders, receivables, receiptSources, savedDocuments, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { buildReceivableActivityEvent, calculateInvoiceTotal, centsToMoney, deriveReceivableStatus, getReceiptDraftEligibility, hasReceiptSourcePaymentChanged, moneyToCents, parseDateOnly, parseInvoicePayload, validatePaymentAmount } from "./receivables";
import { buildReceivableAgingReport, getMonthBounds } from "./agingReport";
import { getReminderCandidate, parseReminderDays, REMINDER_TIMEZONE, serializeReminderDays } from "./receivableReminders";
import { buildPaymentAttachmentStorageName, parsePaymentAttachmentDataUrl, sanitizePaymentAttachmentFilename, type PaymentAttachmentMimeType } from "./paymentAttachments";
import { storageGetSignedUrl, storagePut } from "./storage";

let _db: ReturnType<typeof drizzle> | null = null;

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

/** Test-only seam for transaction-scoped integration fixtures; never used by routers or client code. */
export function __setDbForTests(instance: ReturnType<typeof drizzle> | null) {
  _db = instance;
}

function isDuplicateKeyError(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === "ER_DUP_ENTRY" || candidate?.cause?.code === "ER_DUP_ENTRY";
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

export type CustomerInput = { customerType: "company" | "person"; name: string; taxId?: string | null; address?: string | null; contactName?: string | null; phone?: string | null; email?: string | null; note?: string | null };
export type CustomerListInput = { query?: string; archived?: boolean; page?: number; pageSize?: number };

const customerColumns = {
  id: customers.id, userId: customers.userId, customerType: customers.customerType, name: customers.name, taxId: customers.taxId, address: customers.address, contactName: customers.contactName, phone: customers.phone, email: customers.email, note: customers.note, archivedAt: customers.archivedAt, createdAt: customers.createdAt, updatedAt: customers.updatedAt,
};

async function attachCustomerRelationships(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number, customer: typeof customers.$inferSelect) {
  const [documentRows, receivableRows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(savedDocuments).where(and(eq(savedDocuments.userId, userId), eq(savedDocuments.customerId, customer.id))).limit(1),
    db.select({ total: sql<number>`count(*)`, outstandingAmount: sql<string>`coalesce(sum(case when ${receivables.status} <> 'cancelled' then greatest(${receivables.totalAmount} - ${receivables.paidAmount}, 0) else 0 end), 0)` }).from(receivables).where(and(eq(receivables.userId, userId), eq(receivables.customerId, customer.id))).limit(1),
  ]);
  return { ...customer, documentCount: Number(documentRows[0]?.total || 0), receivableCount: Number(receivableRows[0]?.total || 0), outstandingAmount: (Number(receivableRows[0]?.outstandingAmount || 0) || 0).toFixed(2) };
}

function customerSearchConditions(userId: number, input: CustomerListInput) {
  const conditions = [eq(customers.userId, userId)];
  if (input.archived === true) conditions.push(sql`${customers.archivedAt} is not null`);
  if (input.archived === false) conditions.push(isNull(customers.archivedAt));
  const query = input.query?.trim();
  if (query) {
    const term = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(like(customers.name, term), like(customers.taxId, term), like(customers.contactName, term))!);
  }
  return conditions;
}

function toCustomerInput(input: CustomerInput) {
  return { customerType: input.customerType, name: input.name.trim(), taxId: input.taxId?.trim() || null, address: input.address?.trim() || null, contactName: input.contactName?.trim() || null, phone: input.phone?.trim() || null, email: input.email?.trim() || null, note: input.note?.trim() || null };
}

export async function getCustomerDuplicateMatches(userId: number, input: Pick<CustomerInput, "name" | "taxId">, excludeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const matches = [eq(customers.name, input.name.trim())];
  if (input.taxId?.trim()) matches.push(eq(customers.taxId, input.taxId.trim()));
  const conditions = [eq(customers.userId, userId), or(...matches)!];
  if (excludeId) conditions.push(ne(customers.id, excludeId));
  return db.select({ id: customers.id, name: customers.name, taxId: customers.taxId, archivedAt: customers.archivedAt }).from(customers).where(and(...conditions)).orderBy(desc(customers.updatedAt)).limit(5);
}

export async function listCustomers(userId: number, input: CustomerListInput = {}) {
  const db = await getDb();
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
  const page = Math.max(1, input.page ?? 1);
  if (!db) return { items: [], total: 0, page, pageSize };
  const conditions = customerSearchConditions(userId, { ...input, archived: input.archived ?? false });
  const countRows = await db.select({ total: sql<number>`count(*)` }).from(customers).where(and(...conditions)).limit(1);
  const items = await db.select(customerColumns).from(customers).where(and(...conditions)).orderBy(desc(customers.updatedAt), customers.name).limit(pageSize).offset((page - 1) * pageSize);
  return { items: await Promise.all(items.map((item) => attachCustomerRelationships(db, userId, item))), total: Number(countRows[0]?.total || 0), page, pageSize };
}

export async function getCustomer(userId: number, customerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select(customerColumns).from(customers).where(and(eq(customers.userId, userId), eq(customers.id, customerId))).limit(1);
  const item = rows[0];
  return item ? attachCustomerRelationships(db, userId, item) : undefined;
}

export async function assertCustomerOwnership(userId: number, customerId: number) {
  const customer = await getCustomer(userId, customerId);
  if (!customer) throw new Error("ไม่พบข้อมูลลูกค้าของผู้ใช้รายนี้");
  return customer;
}

export async function createCustomer(userId: number, input: CustomerInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const normalized = toCustomerInput(input);
  const duplicateMatches = await getCustomerDuplicateMatches(userId, normalized);
  const result = await db.insert(customers).values({ userId, ...normalized });
  const customer = await getCustomer(userId, Number(result[0].insertId));
  if (!customer) throw new Error("ไม่สามารถสร้างข้อมูลลูกค้าได้");
  return { customer, duplicateMatches };
}

export async function updateCustomer(userId: number, customerId: number, input: CustomerInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await assertCustomerOwnership(userId, customerId);
  const normalized = toCustomerInput(input);
  const duplicateMatches = await getCustomerDuplicateMatches(userId, normalized, customerId);
  await db.update(customers).set(normalized).where(and(eq(customers.userId, userId), eq(customers.id, customerId)));
  const customer = await getCustomer(userId, customerId);
  if (!customer) throw new Error("ไม่พบข้อมูลลูกค้าของผู้ใช้รายนี้");
  return { customer, duplicateMatches };
}

export async function setCustomerArchived(userId: number, customerId: number, archived: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(customers).set({ archivedAt: archived ? new Date() : null }).where(and(eq(customers.userId, userId), eq(customers.id, customerId)));
  const customer = await getCustomer(userId, customerId);
  if (!customer) throw new Error("ไม่พบข้อมูลลูกค้าของผู้ใช้รายนี้");
  return customer;
}

export async function saveDocument(input: { userId: number; customerId?: number | null; kind: "quotation" | "invoice" | "receipt" | "delivery-note" | "tax-invoice"; documentNumber: string; customerName?: string; payload: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (input.customerId) await assertCustomerOwnership(input.userId, input.customerId);
  await db.insert(savedDocuments).values(input);
}

export type SavedDocumentStatus = "draft" | "sent" | "paid" | "overdue";

export async function listSavedDocuments(userId: number, filters: { kind?: "quotation" | "invoice" | "receipt" | "delivery-note" | "tax-invoice"; status?: SavedDocumentStatus; archived?: boolean; search?: string } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(savedDocuments.userId, userId)];
  if (filters.kind) conditions.push(eq(savedDocuments.kind, filters.kind));
  if (filters.status) conditions.push(eq(savedDocuments.status, filters.status));
  if (filters.archived === true) conditions.push(sql`${savedDocuments.archivedAt} is not null`);
  if (filters.archived === false) conditions.push(sql`${savedDocuments.archivedAt} is null`);
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(sql`(${savedDocuments.documentNumber} like ${term} escape '\\' or ${savedDocuments.customerName} like ${term} escape '\\')`);
  }
  return db.select({ id: savedDocuments.id, customerId: savedDocuments.customerId, kind: savedDocuments.kind, documentNumber: savedDocuments.documentNumber, customerName: savedDocuments.customerName, payload: savedDocuments.payload, status: savedDocuments.status, archivedAt: savedDocuments.archivedAt, updatedAt: savedDocuments.updatedAt, createdAt: savedDocuments.createdAt, exportCount: sql<number>`(select count(*) from ${documentExports} where ${documentExports.userId} = ${userId} and ${documentExports.documentId} = ${savedDocuments.id})`, lastExportAt: sql<Date | null>`(select max(${documentExports.createdAt}) from ${documentExports} where ${documentExports.userId} = ${userId} and ${documentExports.documentId} = ${savedDocuments.id})` }).from(savedDocuments).where(and(...conditions)).orderBy(desc(savedDocuments.updatedAt)).limit(100);
}

export async function getSavedDocument(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ id: savedDocuments.id, userId: savedDocuments.userId, customerId: savedDocuments.customerId, kind: savedDocuments.kind, documentNumber: savedDocuments.documentNumber, customerName: savedDocuments.customerName, payload: savedDocuments.payload, status: savedDocuments.status, archivedAt: savedDocuments.archivedAt, updatedAt: savedDocuments.updatedAt, createdAt: savedDocuments.createdAt }).from(savedDocuments).where(and(eq(savedDocuments.id, id), eq(savedDocuments.userId, userId))).limit(1);
  return result[0];
}

export async function updateSavedDocumentStatus(userId: number, id: number, status: SavedDocumentStatus) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(savedDocuments).set({ status }).where(and(eq(savedDocuments.id, id), eq(savedDocuments.userId, userId)));
  return getSavedDocument(userId, id);
}

export async function setSavedDocumentArchived(userId: number, id: number, archived: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(savedDocuments).set({ archivedAt: archived ? new Date() : null }).where(and(eq(savedDocuments.id, id), eq(savedDocuments.userId, userId)));
  return getSavedDocument(userId, id);
}

export async function duplicateSavedDocument(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const source = await getSavedDocument(userId, id);
  if (!source) throw new Error("ไม่พบเอกสารของผู้ใช้รายนี้");
  const suffix = `-COPY-${Date.now().toString().slice(-6)}`;
  const documentNumber = `${source.documentNumber.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
  const result = await db.insert(savedDocuments).values({ userId, customerId: source.customerId, kind: source.kind, documentNumber, customerName: source.customerName, payload: source.payload, status: "draft" });
  return getSavedDocument(userId, Number(result[0].insertId));
}

export async function recordDocumentExport(userId: number, documentId: number, filename: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const document = await getSavedDocument(userId, documentId);
  if (!document) throw new Error("ไม่พบเอกสารของผู้ใช้รายนี้");
  await db.insert(documentExports).values({ userId, documentId, filename });
}

export async function recordDocumentExportForDocument(input: { userId: number; customerId?: number | null; kind: "quotation" | "invoice" | "receipt" | "delivery-note" | "tax-invoice"; documentNumber: string; customerName?: string; payload: string; filename: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (input.customerId) await assertCustomerOwnership(input.userId, input.customerId);
  const existing = await db.select({ id: savedDocuments.id }).from(savedDocuments).where(and(eq(savedDocuments.userId, input.userId), eq(savedDocuments.kind, input.kind), eq(savedDocuments.documentNumber, input.documentNumber), eq(savedDocuments.payload, input.payload))).orderBy(desc(savedDocuments.updatedAt)).limit(1);
  const documentId = existing[0]?.id ?? Number((await db.insert(savedDocuments).values({ userId: input.userId, customerId: input.customerId ?? null, kind: input.kind, documentNumber: input.documentNumber, customerName: input.customerName, payload: input.payload, status: "draft" }))[0].insertId);
  await db.insert(documentExports).values({ userId: input.userId, documentId, filename: input.filename });
  return { documentId };
}

export async function listDocumentExports(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: documentExports.id, filename: documentExports.filename, createdAt: documentExports.createdAt }).from(documentExports).where(and(eq(documentExports.userId, userId), eq(documentExports.documentId, documentId))).orderBy(desc(documentExports.createdAt)).limit(50);
}

export async function listReceivables(userId: number) {
  const db = await getDb();
  if (!db) return { items: [], summary: { total: "0.00", outstanding: "0.00", overdue: "0.00", dueSoon: "0.00", collectedThisMonth: "0.00" } };
  const rows = await db.select({ id: receivables.id, invoiceId: receivables.invoiceId, customerId: receivables.customerId, documentNumber: receivables.documentNumber, customerName: receivables.customerName, customerAddress: receivables.customerAddress, issueDate: receivables.issueDate, dueDate: receivables.dueDate, totalAmount: receivables.totalAmount, paidAmount: receivables.paidAmount, status: receivables.status, note: receivables.note, createdAt: receivables.createdAt, updatedAt: receivables.updatedAt }).from(receivables).where(eq(receivables.userId, userId)).orderBy(desc(receivables.dueDate)).limit(100);
  const now = new Date();
  const items = rows.map((row) => ({ ...row, status: deriveReceivableStatus(row.totalAmount, row.paidAmount, row.dueDate, now) }));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const collected = await db.select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.userId, userId), isNull(payments.voidedAt), gte(payments.paidAt, startOfMonth), lt(payments.paidAt, nextMonth))).limit(1);
  const toCents = (value: number | string) => Math.round((Number(value) || 0) * 100);
  const fromCents = (value: number) => (value / 100).toFixed(2);
  const totalCents = items.reduce((sum, row) => sum + toCents(row.totalAmount), 0);
  const outstandingCents = items.filter((row) => row.status !== "paid" && row.status !== "cancelled").reduce((sum, row) => sum + Math.max(0, toCents(row.totalAmount) - toCents(row.paidAmount)), 0);
  const overdueCents = items.filter((row) => row.status === "overdue").reduce((sum, row) => sum + Math.max(0, toCents(row.totalAmount) - toCents(row.paidAmount)), 0);
  const dueSoonAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueSoonCents = items.filter((row) => row.status !== "paid" && row.status !== "cancelled" && row.dueDate >= now && row.dueDate <= dueSoonAt).reduce((sum, row) => sum + Math.max(0, toCents(row.totalAmount) - toCents(row.paidAmount)), 0);
  const overdueCount = items.filter((row) => row.status === "overdue").length;
  const dueSoonCount = items.filter((row) => row.status !== "paid" && row.status !== "cancelled" && row.dueDate >= now && row.dueDate <= dueSoonAt).length;
  return { items, summary: { total: fromCents(totalCents), outstanding: fromCents(outstandingCents), overdue: fromCents(overdueCents), dueSoon: fromCents(dueSoonCents), overdueCount, dueSoonCount, collectedThisMonth: String(collected[0]?.total || "0.00") } };
}

export type ReminderSettingsInput = {
  enabled: boolean;
  daysBeforeDue: number[];
  timezone: typeof REMINDER_TIMEZONE;
  scheduleCronTaskUid?: string | null;
};

export async function getReceivableReminderSettings(userId: number) {
  const db = await getDb();
  if (!db) return { id: null, userId, enabled: false, daysBeforeDue: [1, 3, 7], timezone: REMINDER_TIMEZONE, scheduleCronTaskUid: null, lastEvaluatedAt: null };
  const rows = await db.select({ id: receivableReminderSettings.id, userId: receivableReminderSettings.userId, enabled: receivableReminderSettings.enabled, daysBeforeDue: receivableReminderSettings.daysBeforeDue, timezone: receivableReminderSettings.timezone, scheduleCronTaskUid: receivableReminderSettings.scheduleCronTaskUid, lastEvaluatedAt: receivableReminderSettings.lastEvaluatedAt }).from(receivableReminderSettings).where(eq(receivableReminderSettings.userId, userId)).limit(1);
  const setting = rows[0];
  if (!setting) return { id: null, userId, enabled: false, daysBeforeDue: [1, 3, 7], timezone: REMINDER_TIMEZONE, scheduleCronTaskUid: null, lastEvaluatedAt: null };
  return { ...setting, enabled: Boolean(setting.enabled), daysBeforeDue: parseReminderDays(setting.daysBeforeDue), timezone: REMINDER_TIMEZONE };
}

export async function saveReceivableReminderSettings(userId: number, input: ReminderSettingsInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const current = await getReceivableReminderSettings(userId);
  const daysBeforeDue = serializeReminderDays(input.daysBeforeDue);
  const scheduleCronTaskUid = input.scheduleCronTaskUid === undefined ? current.scheduleCronTaskUid : input.scheduleCronTaskUid;
  await db.insert(receivableReminderSettings).values({ userId, enabled: input.enabled, daysBeforeDue, timezone: REMINDER_TIMEZONE, scheduleCronTaskUid }).onDuplicateKeyUpdate({
    set: { enabled: input.enabled, daysBeforeDue, timezone: REMINDER_TIMEZONE, scheduleCronTaskUid },
  });
  return getReceivableReminderSettings(userId);
}

export async function getReceivableReminderSettingsByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({ userId: receivableReminderSettings.userId, enabled: receivableReminderSettings.enabled, scheduleCronTaskUid: receivableReminderSettings.scheduleCronTaskUid }).from(receivableReminderSettings).where(eq(receivableReminderSettings.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0];
}

export async function evaluateReceivableReminders(userId: number, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const settings = await getReceivableReminderSettings(userId);
  if (!settings.enabled) return { created: 0, deduplicated: 0, considered: 0, skipped: "disabled" as const, evaluationDate: null };
  const eligibleRows = await db.select({ id: receivables.id, invoiceId: receivables.invoiceId, documentNumber: receivables.documentNumber, customerName: receivables.customerName, dueDate: receivables.dueDate, totalAmount: receivables.totalAmount, paidAmount: receivables.paidAmount, status: receivables.status }).from(receivables).where(and(eq(receivables.userId, userId), ne(receivables.status, "cancelled"))).limit(500);
  const candidates = eligibleRows.map((row) => getReminderCandidate(row, settings.daysBeforeDue, now, settings.timezone)).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  let created = 0;
  await db.transaction(async (tx) => {
    for (const candidate of candidates) {
      try {
        await tx.insert(receivableReminders).values({ userId, receivableId: candidate.receivableId, invoiceId: candidate.invoiceId, reminderType: candidate.reminderType, dueDate: candidate.dueDate, dueDateBasis: candidate.dueDateBasis, evaluationDate: candidate.evaluationDate, outstandingAmount: candidate.outstandingAmount, documentNumber: candidate.documentNumber, customerName: candidate.customerName });
        created += 1;
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
      }
    }
    await tx.update(receivableReminderSettings).set({ lastEvaluatedAt: now }).where(eq(receivableReminderSettings.userId, userId));
  });
  return { created, deduplicated: candidates.length - created, considered: candidates.length, skipped: null, evaluationDate: candidates[0]?.evaluationDate ?? null };
}

export async function evaluateReceivableRemindersByTaskUid(taskUid: string, now = new Date()) {
  const settings = await getReceivableReminderSettingsByTaskUid(taskUid);
  if (!settings) return { created: 0, deduplicated: 0, considered: 0, skipped: "orphan" as const, evaluationDate: null };
  if (!settings.enabled) return { created: 0, deduplicated: 0, considered: 0, skipped: "disabled" as const, evaluationDate: null };
  return evaluateReceivableReminders(settings.userId, now);
}

export async function getReceivableReminderInbox(userId: number) {
  const db = await getDb();
  if (!db) return { items: [], counts: { unread: 0, dueSoon: 0, overdue: 0 } };
  const items = await db.select({ id: receivableReminders.id, receivableId: receivableReminders.receivableId, invoiceId: receivableReminders.invoiceId, reminderType: receivableReminders.reminderType, dueDate: receivableReminders.dueDate, dueDateBasis: receivableReminders.dueDateBasis, outstandingAmount: receivableReminders.outstandingAmount, documentNumber: receivableReminders.documentNumber, customerName: receivableReminders.customerName, status: receivableReminders.status, readAt: receivableReminders.readAt, createdAt: receivableReminders.createdAt }).from(receivableReminders).where(eq(receivableReminders.userId, userId)).orderBy(desc(receivableReminders.createdAt)).limit(12);
  const counts = await db.select({ unread: sql<number>`coalesce(sum(case when ${receivableReminders.status} = 'unread' then 1 else 0 end), 0)`, dueSoon: sql<number>`coalesce(sum(case when ${receivableReminders.status} = 'unread' and ${receivableReminders.reminderType} = 'due-soon' then 1 else 0 end), 0)`, overdue: sql<number>`coalesce(sum(case when ${receivableReminders.status} = 'unread' and ${receivableReminders.reminderType} = 'overdue' then 1 else 0 end), 0)` }).from(receivableReminders).where(eq(receivableReminders.userId, userId)).limit(1);
  return { items, counts: { unread: Number(counts[0]?.unread || 0), dueSoon: Number(counts[0]?.dueSoon || 0), overdue: Number(counts[0]?.overdue || 0) } };
}

export async function markReceivableReminderRead(userId: number, reminderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.update(receivableReminders).set({ status: "read", readAt: new Date() }).where(and(eq(receivableReminders.id, reminderId), eq(receivableReminders.userId, userId), eq(receivableReminders.status, "unread")));
  return { updated: Number(result[0].affectedRows) > 0 };
}

export async function getReceivableDetails(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ id: receivables.id, invoiceId: receivables.invoiceId, customerId: receivables.customerId, documentNumber: receivables.documentNumber, customerName: receivables.customerName, customerAddress: receivables.customerAddress, issueDate: receivables.issueDate, dueDate: receivables.dueDate, totalAmount: receivables.totalAmount, paidAmount: receivables.paidAmount, status: receivables.status, note: receivables.note, updatedAt: receivables.updatedAt }).from(receivables).where(and(eq(receivables.id, id), eq(receivables.userId, userId))).limit(1);
  const receivable = result[0];
  if (!receivable) return undefined;
  const paymentRows = await db.select({ id: payments.id, amount: payments.amount, paidAt: payments.paidAt, method: payments.method, reference: payments.reference, note: payments.note, voidedAt: payments.voidedAt, voidReason: payments.voidReason, createdAt: payments.createdAt }).from(payments).where(and(eq(payments.receivableId, id), eq(payments.userId, userId))).orderBy(desc(payments.paidAt)).limit(100);
  const attachmentRows = paymentRows.length ? await db.select({ id: paymentAttachments.id, paymentId: paymentAttachments.paymentId, storageKey: paymentAttachments.storageKey, originalFilename: paymentAttachments.originalFilename, mimeType: paymentAttachments.mimeType, sizeBytes: paymentAttachments.sizeBytes, caption: paymentAttachments.caption, createdAt: paymentAttachments.createdAt }).from(paymentAttachments).where(and(eq(paymentAttachments.userId, userId), isNull(paymentAttachments.deletedAt), inArray(paymentAttachments.paymentId, paymentRows.map((payment) => payment.id)))).orderBy(desc(paymentAttachments.createdAt)).limit(250) : [];
  const visibleAttachments = await Promise.all(attachmentRows.map(async ({ storageKey, ...attachment }) => ({ ...attachment, thumbnailUrl: attachment.mimeType.startsWith("image/") ? await storageGetSignedUrl(storageKey).catch(() => null) : null })));
  const attachmentsByPayment = new Map<number, typeof visibleAttachments>();
  for (const attachment of visibleAttachments) attachmentsByPayment.set(attachment.paymentId, [...(attachmentsByPayment.get(attachment.paymentId) || []), attachment]);
  const events = await db.select({ id: receivableEvents.id, type: receivableEvents.type, paymentId: receivableEvents.paymentId, amount: receivableEvents.amount, note: receivableEvents.note, createdAt: receivableEvents.createdAt }).from(receivableEvents).where(and(eq(receivableEvents.receivableId, id), eq(receivableEvents.userId, userId))).orderBy(desc(receivableEvents.createdAt)).limit(100);
  return { ...receivable, status: deriveReceivableStatus(receivable.totalAmount, receivable.paidAmount, receivable.dueDate), payments: paymentRows.map((payment) => ({ ...payment, attachments: attachmentsByPayment.get(payment.id) || [] })), events };
}

async function getOwnedPaymentForAttachment(userId: number, paymentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select({ id: payments.id, receivableId: payments.receivableId, voidedAt: payments.voidedAt }).from(payments).where(and(eq(payments.id, paymentId), eq(payments.userId, userId))).limit(1);
  const payment = rows[0];
  if (!payment) throw new Error("ไม่พบรายการรับชำระของผู้ใช้รายนี้");
  return payment;
}

export async function listPaymentAttachments(userId: number, paymentId: number) {
  const db = await getDb();
  if (!db) return [];
  await getOwnedPaymentForAttachment(userId, paymentId);
  return db.select({ id: paymentAttachments.id, paymentId: paymentAttachments.paymentId, originalFilename: paymentAttachments.originalFilename, mimeType: paymentAttachments.mimeType, sizeBytes: paymentAttachments.sizeBytes, caption: paymentAttachments.caption, createdAt: paymentAttachments.createdAt }).from(paymentAttachments).where(and(eq(paymentAttachments.userId, userId), eq(paymentAttachments.paymentId, paymentId), isNull(paymentAttachments.deletedAt))).orderBy(desc(paymentAttachments.createdAt)).limit(50);
}

export async function uploadPaymentAttachment(userId: number, input: { paymentId: number; originalFilename: string; caption?: string | null; dataUrl: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const payment = await getOwnedPaymentForAttachment(userId, input.paymentId);
  if (payment.voidedAt) throw new Error("ไม่สามารถเพิ่มหลักฐานในรายการรับชำระที่ยกเลิกแล้ว");
  const parsed = parsePaymentAttachmentDataUrl(input.dataUrl);
  const originalFilename = sanitizePaymentAttachmentFilename(input.originalFilename);
  const storageName = buildPaymentAttachmentStorageName(originalFilename, parsed.mimeType);
  const uploaded = await storagePut(`payment-proofs/${userId}/${payment.id}/${storageName}`, parsed.bytes, parsed.mimeType);
  try {
    const insert = await db.insert(paymentAttachments).values({ userId, paymentId: payment.id, storageKey: uploaded.key, originalFilename, mimeType: parsed.mimeType, sizeBytes: parsed.bytes.length, caption: input.caption?.trim() || null });
    const attachmentId = Number(insert[0].insertId);
    await db.insert(receivableEvents).values(buildReceivableActivityEvent({ userId, receivableId: payment.receivableId, type: "payment-attachment-added", paymentId: payment.id, note: "เพิ่มหลักฐานการรับชำระ" }));
    return { id: attachmentId, paymentId: payment.id, originalFilename, mimeType: parsed.mimeType, sizeBytes: parsed.bytes.length, caption: input.caption?.trim() || null, createdAt: new Date() };
  } catch (error) {
    // The S3 key is never exposed and has no DB reference if metadata persistence fails.
    throw error;
  }
}

export async function getPaymentAttachmentForView(userId: number, attachmentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select({ id: paymentAttachments.id, paymentId: paymentAttachments.paymentId, storageKey: paymentAttachments.storageKey, originalFilename: paymentAttachments.originalFilename, mimeType: paymentAttachments.mimeType, sizeBytes: paymentAttachments.sizeBytes, caption: paymentAttachments.caption, createdAt: paymentAttachments.createdAt }).from(paymentAttachments).where(and(eq(paymentAttachments.id, attachmentId), eq(paymentAttachments.userId, userId), isNull(paymentAttachments.deletedAt))).limit(1);
  const attachment = rows[0];
  if (!attachment) throw new Error("ไม่พบหลักฐานการรับชำระของผู้ใช้รายนี้");
  return attachment;
}

export async function softDeletePaymentAttachment(userId: number, attachmentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: paymentAttachments.id, paymentId: paymentAttachments.paymentId, storageKey: paymentAttachments.storageKey, receivableId: payments.receivableId }).from(paymentAttachments).innerJoin(payments, eq(paymentAttachments.paymentId, payments.id)).where(and(eq(paymentAttachments.id, attachmentId), eq(paymentAttachments.userId, userId), eq(payments.userId, userId), isNull(paymentAttachments.deletedAt))).limit(1);
    const attachment = rows[0];
    if (!attachment) throw new Error("ไม่พบหลักฐานการรับชำระของผู้ใช้รายนี้");
    await tx.update(paymentAttachments).set({ deletedAt: new Date() }).where(and(eq(paymentAttachments.id, attachment.id), eq(paymentAttachments.userId, userId), isNull(paymentAttachments.deletedAt)));
    await tx.insert(receivableEvents).values(buildReceivableActivityEvent({ userId, receivableId: attachment.receivableId, type: "payment-attachment-removed", paymentId: attachment.paymentId, note: "ลบหลักฐานการรับชำระ" }));
    return { deleted: true as const };
  });
}

export async function getReceivableByInvoice(userId: number, invoiceId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ id: receivables.id }).from(receivables).where(and(eq(receivables.userId, userId), eq(receivables.invoiceId, invoiceId))).limit(1);
  return result[0] ? getReceivableDetails(userId, result[0].id) : undefined;
}

type ReceiptPaymentMethod = "cash" | "transfer" | "card" | "cheque" | "other";
type ReceiptSourcePayload = { sourceInvoiceId: number; sourceReceivableId: number; activePaymentIds: number[]; paymentTotalAtCreation: string; createdFrom: "receivable-paid"; sourceInvoiceNumber: string };

function buildReceiptNumber(receivableId: number, now = new Date()) {
  return `RC-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(receivableId).padStart(4, "0")}`;
}

function serializePaymentIds(ids: number[]) {
  return JSON.stringify([...ids].sort((left, right) => left - right));
}

function parsePaymentIds(value: string) {
  try {
    const ids = JSON.parse(value);
    return Array.isArray(ids) && ids.every((id) => Number.isInteger(id) && id > 0) ? ids : [];
  } catch {
    return [];
  }
}

function buildReceiptPayload(invoicePayload: string, receiptNumber: string, source: ReceiptSourcePayload) {
  const invoice = parseInvoicePayload(invoicePayload) as Record<string, unknown>;
  const today = new Date().toISOString().slice(0, 10);
  return JSON.stringify({ ...invoice, kind: "receipt", documentNumber: receiptNumber, issueDate: today, dueDate: today, receiptSource: source });
}

export async function getReceiptEligibility(userId: number, receivableId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const receivableRows = await db.select({ id: receivables.id, invoiceId: receivables.invoiceId, documentNumber: receivables.documentNumber, customerName: receivables.customerName, totalAmount: receivables.totalAmount, paidAmount: receivables.paidAmount, dueDate: receivables.dueDate, status: receivables.status }).from(receivables).where(and(eq(receivables.id, receivableId), eq(receivables.userId, userId))).limit(1);
  const receivable = receivableRows[0];
  if (!receivable) throw new Error("ไม่พบรายการลูกหนี้ของผู้ใช้รายนี้");
  const invoice = await getSavedDocument(userId, receivable.invoiceId);
  if (!invoice || invoice.kind !== "invoice") throw new Error("ไม่พบใบแจ้งหนี้ต้นทางของผู้ใช้รายนี้");
  const activePayments = await db.select({ id: payments.id, amount: payments.amount, paidAt: payments.paidAt, method: payments.method, reference: payments.reference }).from(payments).where(and(eq(payments.userId, userId), eq(payments.receivableId, receivable.id), isNull(payments.voidedAt))).orderBy(payments.paidAt);
  const activePaymentIds = activePayments.map((payment) => payment.id).sort((left, right) => left - right);
  const paymentTotal = centsToMoney(activePayments.reduce((sum, payment) => sum + moneyToCents(payment.amount), 0));
  const totalMatches = moneyToCents(paymentTotal) === moneyToCents(receivable.totalAmount);
  const currentStatus = deriveReceivableStatus(receivable.totalAmount, paymentTotal, receivable.dueDate);
  const sourceRows = await db.select({ receiptDocumentId: receiptSources.receiptDocumentId, activePaymentIds: receiptSources.activePaymentIds, paymentTotalAtCreation: receiptSources.paymentTotalAtCreation, createdAt: receiptSources.createdAt }).from(receiptSources).where(and(eq(receiptSources.userId, userId), eq(receiptSources.receivableId, receivable.id))).limit(1);
  const source = sourceRows[0];
  const receiptDraft = source ? await getSavedDocument(userId, source.receiptDocumentId) : undefined;
  const sourceChanged = Boolean(source && hasReceiptSourcePaymentChanged(parsePaymentIds(source.activePaymentIds), activePaymentIds, source.paymentTotalAtCreation, paymentTotal));
  const eligibility = getReceiptDraftEligibility(receivable.status === "cancelled" ? "cancelled" : currentStatus, receivable.totalAmount, paymentTotal);
  const eligible = eligibility.eligible && totalMatches;
  return {
    eligible,
    reason: eligible ? null : eligibility.reason,
    receivable: { ...receivable, status: currentStatus, paymentTotal, outstanding: centsToMoney(Math.max(0, moneyToCents(receivable.totalAmount) - moneyToCents(paymentTotal))) },
    invoice: { id: invoice.id, documentNumber: invoice.documentNumber, customerName: invoice.customerName, payload: invoice.payload },
    payments: activePayments.map((payment) => ({ ...payment, method: payment.method as ReceiptPaymentMethod })),
    receiptDraft: receiptDraft ? { id: receiptDraft.id, documentNumber: receiptDraft.documentNumber, payload: receiptDraft.payload, createdAt: source?.createdAt ?? receiptDraft.createdAt } : null,
    sourceChanged,
  };
}

export async function createReceiptDraft(userId: number, receivableId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  try {
    return await db.transaction(async (tx) => {
      const existingSource = await tx.select({ receiptDocumentId: receiptSources.receiptDocumentId }).from(receiptSources).where(and(eq(receiptSources.userId, userId), eq(receiptSources.receivableId, receivableId))).limit(1);
      if (existingSource[0]) {
        const existingReceipt = await tx.select({ id: savedDocuments.id, documentNumber: savedDocuments.documentNumber, payload: savedDocuments.payload, createdAt: savedDocuments.createdAt }).from(savedDocuments).where(and(eq(savedDocuments.id, existingSource[0].receiptDocumentId), eq(savedDocuments.userId, userId), eq(savedDocuments.kind, "receipt"))).limit(1);
        if (existingReceipt[0]) return { ...existingReceipt[0], created: false };
        throw new Error("ไม่พบใบเสร็จฉบับร่างที่เชื่อมกับรายการรับชำระ");
      }
      const receivableRows = await tx.select({ id: receivables.id, invoiceId: receivables.invoiceId, documentNumber: receivables.documentNumber, customerName: receivables.customerName, totalAmount: receivables.totalAmount, dueDate: receivables.dueDate, status: receivables.status }).from(receivables).where(and(eq(receivables.id, receivableId), eq(receivables.userId, userId))).limit(1);
      const receivable = receivableRows[0];
      if (!receivable) throw new Error("ไม่พบรายการลูกหนี้ของผู้ใช้รายนี้");
      if (receivable.status === "cancelled") throw new Error("รายการลูกหนี้นี้ถูกยกเลิกแล้ว");
      const invoiceRows = await tx.select({ id: savedDocuments.id, customerId: savedDocuments.customerId, documentNumber: savedDocuments.documentNumber, customerName: savedDocuments.customerName, payload: savedDocuments.payload }).from(savedDocuments).where(and(eq(savedDocuments.id, receivable.invoiceId), eq(savedDocuments.userId, userId), eq(savedDocuments.kind, "invoice"))).limit(1);
      const invoice = invoiceRows[0];
      if (!invoice) throw new Error("ไม่พบใบแจ้งหนี้ต้นทางของผู้ใช้รายนี้");
      const activePayments = await tx.select({ id: payments.id, amount: payments.amount }).from(payments).where(and(eq(payments.userId, userId), eq(payments.receivableId, receivable.id), isNull(payments.voidedAt))).orderBy(payments.id);
      const paymentTotal = centsToMoney(activePayments.reduce((sum, payment) => sum + moneyToCents(payment.amount), 0));
      const eligibility = getReceiptDraftEligibility(deriveReceivableStatus(receivable.totalAmount, paymentTotal, receivable.dueDate), receivable.totalAmount, paymentTotal);
      if (!eligibility.eligible) throw new Error(eligibility.reason);
      const receiptNumber = buildReceiptNumber(receivable.id);
      const source: ReceiptSourcePayload = { sourceInvoiceId: invoice.id, sourceReceivableId: receivable.id, activePaymentIds: activePayments.map((payment) => payment.id), paymentTotalAtCreation: paymentTotal, createdFrom: "receivable-paid", sourceInvoiceNumber: invoice.documentNumber };
      const payload = buildReceiptPayload(invoice.payload, receiptNumber, source);
      const receiptInsert = await tx.insert(savedDocuments).values({ userId, customerId: invoice.customerId ?? null, kind: "receipt", documentNumber: receiptNumber, customerName: invoice.customerName || receivable.customerName, payload, status: "draft" });
      const receiptDocumentId = Number(receiptInsert[0].insertId);
      await tx.insert(receiptSources).values({ userId, receivableId: receivable.id, invoiceId: invoice.id, receiptDocumentId, activePaymentIds: serializePaymentIds(source.activePaymentIds), paymentTotalAtCreation: paymentTotal, createdFrom: source.createdFrom });
      await tx.insert(receivableEvents).values(buildReceivableActivityEvent({ userId, receivableId: receivable.id, type: "receipt-draft-created", amount: paymentTotal, note: `สร้างใบเสร็จร่าง ${receiptNumber} จากใบแจ้งหนี้ ${invoice.documentNumber}` }));
      return { id: receiptDocumentId, documentNumber: receiptNumber, payload, createdAt: new Date(), created: true };
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "ER_DUP_ENTRY") throw error;
    const eligibility = await getReceiptEligibility(userId, receivableId);
    if (eligibility.receiptDraft) return { ...eligibility.receiptDraft, created: false };
    throw error;
  }
}

export async function getReceivableAgingReport(userId: number, input: { asOf: Date; month: string }) {
  const db = await getDb();
  if (!db) return buildReceivableAgingReport({ rows: [], payments: [], asOf: input.asOf, month: input.month });
  const rows = await db.select({ id: receivables.id, invoiceId: receivables.invoiceId, documentNumber: receivables.documentNumber, customerName: receivables.customerName, issueDate: receivables.issueDate, dueDate: receivables.dueDate, totalAmount: receivables.totalAmount, paidAmount: receivables.paidAmount, status: receivables.status }).from(receivables).where(eq(receivables.userId, userId)).orderBy(desc(receivables.dueDate));
  const bounds = getMonthBounds(input.month);
  const monthlyPayments = await db.select({ amount: payments.amount, method: payments.method }).from(payments).where(and(eq(payments.userId, userId), isNull(payments.voidedAt), gte(payments.paidAt, bounds.start), lt(payments.paidAt, bounds.end)));
  return buildReceivableAgingReport({ rows, payments: monthlyPayments, asOf: input.asOf, month: input.month });
}

export async function createReceivableFromInvoice(userId: number, invoiceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const invoice = await getSavedDocument(userId, invoiceId);
  if (!invoice || invoice.kind !== "invoice") throw new Error("ไม่พบใบแจ้งหนี้ของผู้ใช้รายนี้");
  const existing = await db.select({ id: receivables.id }).from(receivables).where(and(eq(receivables.userId, userId), eq(receivables.invoiceId, invoiceId))).limit(1);
  if (existing[0]) return getReceivableDetails(userId, existing[0].id);
  const payload = parseInvoicePayload(invoice.payload);
  const totals = calculateInvoiceTotal(payload);
  const issueDate = parseDateOnly(payload.issueDate || new Date().toISOString().slice(0, 10));
  const dueDate = parseDateOnly(payload.dueDate || payload.issueDate || new Date().toISOString().slice(0, 10), true);
  const customerName = payload.customer?.name?.trim() || invoice.customerName?.trim();
  if (!customerName) throw new Error("กรุณาระบุชื่อลูกค้าในใบแจ้งหนี้ก่อนติดตามรับชำระ");
  const status = deriveReceivableStatus(totals.total, "0.00", dueDate);
  const result = await db.insert(receivables).values({ userId, invoiceId, customerId: invoice.customerId ?? null, documentNumber: invoice.documentNumber, customerName, customerAddress: payload.customer?.address || null, issueDate, dueDate, totalAmount: totals.total, paidAmount: "0.00", status, note: payload.note || null });
  const insertedId = Number(result[0].insertId);
  await db.insert(receivableEvents).values(buildReceivableActivityEvent({ userId, receivableId: insertedId, type: "created", amount: totals.total, note: "เพิ่มจากใบแจ้งหนี้" }));
  return getReceivableDetails(userId, insertedId);
}

export async function recordPayment(userId: number, input: { receivableId: number; amount: number; paidAt: Date; method: "cash" | "transfer" | "card" | "cheque" | "other"; reference?: string | null; note?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: receivables.id, totalAmount: receivables.totalAmount, paidAmount: receivables.paidAmount, dueDate: receivables.dueDate, status: receivables.status }).from(receivables).where(and(eq(receivables.id, input.receivableId), eq(receivables.userId, userId))).limit(1);
    const receivable = rows[0];
    if (!receivable) throw new Error("ไม่พบรายการลูกหนี้ของผู้ใช้รายนี้");
    if (receivable.status === "cancelled") throw new Error("รายการลูกหนี้นี้ถูกยกเลิกแล้ว");
    const validation = validatePaymentAmount(receivable.totalAmount, receivable.paidAmount, input.amount);
    if (!validation.valid) throw new Error(validation.reason);
    const paymentInsert = await tx.insert(payments).values({ userId, receivableId: input.receivableId, amount: Number(input.amount).toFixed(2), paidAt: input.paidAt, method: input.method, reference: input.reference || null, note: input.note || null });
    const paymentId = Number(paymentInsert[0].insertId);
    await tx.insert(receivableEvents).values(buildReceivableActivityEvent({ userId, receivableId: input.receivableId, type: "payment-recorded", paymentId, amount: input.amount, note: input.note }));
    const nextPaidCents = Math.round((Number(receivable.paidAmount) || 0) * 100) + validation.amountCents;
    const nextPaid = (nextPaidCents / 100).toFixed(2);
    const nextStatus = deriveReceivableStatus(receivable.totalAmount, nextPaid, receivable.dueDate);
    await tx.update(receivables).set({ paidAmount: nextPaid, status: nextStatus }).where(and(eq(receivables.id, input.receivableId), eq(receivables.userId, userId)));
    return { paymentId, paidAmount: nextPaid, status: nextStatus };
  });
}

type PaymentInput = { receivableId: number; amount: number; paidAt: Date; method: "cash" | "transfer" | "card" | "cheque" | "other"; reference?: string | null; note?: string | null };

export async function voidPayment(userId: number, input: { paymentId: number; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async (tx) => {
    const paymentRows = await tx.select({ id: payments.id, receivableId: payments.receivableId, amount: payments.amount, voidedAt: payments.voidedAt }).from(payments).where(and(eq(payments.id, input.paymentId), eq(payments.userId, userId))).limit(1);
    const payment = paymentRows[0];
    if (!payment) throw new Error("ไม่พบรายการรับชำระของผู้ใช้รายนี้");
    if (payment.voidedAt) throw new Error("รายการรับชำระนี้ถูกยกเลิกไปแล้ว");
    const receivableRows = await tx.select({ id: receivables.id, totalAmount: receivables.totalAmount, paidAmount: receivables.paidAmount, dueDate: receivables.dueDate, status: receivables.status }).from(receivables).where(and(eq(receivables.id, payment.receivableId), eq(receivables.userId, userId))).limit(1);
    const receivable = receivableRows[0];
    if (!receivable) throw new Error("ไม่พบรายการลูกหนี้ของผู้ใช้รายนี้");
    const reason = input.reason.trim();
    await tx.update(payments).set({ voidedAt: new Date(), voidReason: reason }).where(and(eq(payments.id, payment.id), eq(payments.userId, userId), isNull(payments.voidedAt)));
    await tx.insert(receivableEvents).values(buildReceivableActivityEvent({ userId, receivableId: receivable.id, type: "payment-voided", paymentId: payment.id, amount: payment.amount, note: reason }));
    const nextPaidCents = Math.max(0, Math.round((Number(receivable.paidAmount) || 0) * 100) - Math.round((Number(payment.amount) || 0) * 100));
    const nextPaid = (nextPaidCents / 100).toFixed(2);
    const nextStatus = deriveReceivableStatus(receivable.totalAmount, nextPaid, receivable.dueDate);
    await tx.update(receivables).set({ paidAmount: nextPaid, status: nextStatus }).where(and(eq(receivables.id, receivable.id), eq(receivables.userId, userId)));
    return { receivableId: receivable.id, paidAmount: nextPaid, status: nextStatus };
  });
}

export async function replacePayment(userId: number, input: PaymentInput & { paymentId: number; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async (tx) => {
    const paymentRows = await tx.select({ id: payments.id, receivableId: payments.receivableId, amount: payments.amount, voidedAt: payments.voidedAt }).from(payments).where(and(eq(payments.id, input.paymentId), eq(payments.userId, userId), eq(payments.receivableId, input.receivableId))).limit(1);
    const payment = paymentRows[0];
    if (!payment) throw new Error("ไม่พบรายการรับชำระของผู้ใช้รายนี้");
    if (payment.voidedAt) throw new Error("รายการรับชำระนี้ถูกยกเลิกไปแล้ว");
    const receivableRows = await tx.select({ id: receivables.id, totalAmount: receivables.totalAmount, paidAmount: receivables.paidAmount, dueDate: receivables.dueDate, status: receivables.status }).from(receivables).where(and(eq(receivables.id, input.receivableId), eq(receivables.userId, userId))).limit(1);
    const receivable = receivableRows[0];
    if (!receivable) throw new Error("ไม่พบรายการลูกหนี้ของผู้ใช้รายนี้");
    const paidWithoutCurrentCents = Math.max(0, Math.round((Number(receivable.paidAmount) || 0) * 100) - Math.round((Number(payment.amount) || 0) * 100));
    const validation = validatePaymentAmount(receivable.totalAmount, (paidWithoutCurrentCents / 100).toFixed(2), input.amount);
    if (!validation.valid) throw new Error(validation.reason);
    const reason = input.reason.trim();
    const replacementInsert = await tx.insert(payments).values({ userId, receivableId: input.receivableId, amount: Number(input.amount).toFixed(2), paidAt: input.paidAt, method: input.method, reference: input.reference || null, note: input.note || null });
    const replacementId = Number(replacementInsert[0].insertId);
    await tx.update(payments).set({ voidedAt: new Date(), voidReason: `แทนที่ด้วยรายการ #${replacementId}: ${reason}` }).where(and(eq(payments.id, payment.id), eq(payments.userId, userId), isNull(payments.voidedAt)));
    await tx.insert(receivableEvents).values(buildReceivableActivityEvent({ userId, receivableId: receivable.id, type: "payment-replaced", paymentId: payment.id, amount: payment.amount, note: `แทนที่ด้วยรายการ #${replacementId}: ${reason}` }));
    await tx.insert(receivableEvents).values(buildReceivableActivityEvent({ userId, receivableId: receivable.id, type: "payment-recorded", paymentId: replacementId, amount: input.amount, note: `รายการแทน #${payment.id}${input.note?.trim() ? ` · ${input.note.trim()}` : ""}` }));
    const nextPaidCents = paidWithoutCurrentCents + validation.amountCents;
    const nextPaid = (nextPaidCents / 100).toFixed(2);
    const nextStatus = deriveReceivableStatus(receivable.totalAmount, nextPaid, receivable.dueDate);
    await tx.update(receivables).set({ paidAmount: nextPaid, status: nextStatus }).where(and(eq(receivables.id, receivable.id), eq(receivables.userId, userId)));
    return { receivableId: receivable.id, paidAmount: nextPaid, status: nextStatus, replacementId };
  });
}

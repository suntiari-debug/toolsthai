import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { companyProfiles, InsertUser, payments, receivables, savedDocuments, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { calculateInvoiceTotal, deriveReceivableStatus, parseDateOnly, parseInvoicePayload, validatePaymentAmount } from "./receivables";

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

export async function saveDocument(input: { userId: number; kind: "quotation" | "invoice" | "receipt" | "delivery-note" | "tax-invoice"; documentNumber: string; customerName?: string; payload: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(savedDocuments).values(input);
}

export async function listSavedDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: savedDocuments.id, kind: savedDocuments.kind, documentNumber: savedDocuments.documentNumber, customerName: savedDocuments.customerName, payload: savedDocuments.payload, updatedAt: savedDocuments.updatedAt, createdAt: savedDocuments.createdAt }).from(savedDocuments).where(eq(savedDocuments.userId, userId)).orderBy(desc(savedDocuments.updatedAt)).limit(50);
}

export async function getSavedDocument(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ id: savedDocuments.id, userId: savedDocuments.userId, kind: savedDocuments.kind, documentNumber: savedDocuments.documentNumber, customerName: savedDocuments.customerName, payload: savedDocuments.payload, updatedAt: savedDocuments.updatedAt, createdAt: savedDocuments.createdAt }).from(savedDocuments).where(and(eq(savedDocuments.id, id), eq(savedDocuments.userId, userId))).limit(1);
  return result[0];
}

export async function listReceivables(userId: number) {
  const db = await getDb();
  if (!db) return { items: [], summary: { total: "0.00", outstanding: "0.00", overdue: "0.00", dueSoon: "0.00", collectedThisMonth: "0.00" } };
  const rows = await db.select({ id: receivables.id, invoiceId: receivables.invoiceId, documentNumber: receivables.documentNumber, customerName: receivables.customerName, customerAddress: receivables.customerAddress, issueDate: receivables.issueDate, dueDate: receivables.dueDate, totalAmount: receivables.totalAmount, paidAmount: receivables.paidAmount, status: receivables.status, note: receivables.note, createdAt: receivables.createdAt, updatedAt: receivables.updatedAt }).from(receivables).where(eq(receivables.userId, userId)).orderBy(desc(receivables.dueDate)).limit(100);
  const now = new Date();
  const items = rows.map((row) => ({ ...row, status: deriveReceivableStatus(row.totalAmount, row.paidAmount, row.dueDate, now) }));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const collected = await db.select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.userId, userId), gte(payments.paidAt, startOfMonth), lt(payments.paidAt, nextMonth))).limit(1);
  const toCents = (value: number | string) => Math.round((Number(value) || 0) * 100);
  const fromCents = (value: number) => (value / 100).toFixed(2);
  const totalCents = items.reduce((sum, row) => sum + toCents(row.totalAmount), 0);
  const outstandingCents = items.filter((row) => row.status !== "paid" && row.status !== "cancelled").reduce((sum, row) => sum + Math.max(0, toCents(row.totalAmount) - toCents(row.paidAmount)), 0);
  const overdueCents = items.filter((row) => row.status === "overdue").reduce((sum, row) => sum + Math.max(0, toCents(row.totalAmount) - toCents(row.paidAmount)), 0);
  const dueSoonAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueSoonCents = items.filter((row) => row.status !== "paid" && row.status !== "cancelled" && row.dueDate >= now && row.dueDate <= dueSoonAt).reduce((sum, row) => sum + Math.max(0, toCents(row.totalAmount) - toCents(row.paidAmount)), 0);
  return { items, summary: { total: fromCents(totalCents), outstanding: fromCents(outstandingCents), overdue: fromCents(overdueCents), dueSoon: fromCents(dueSoonCents), collectedThisMonth: String(collected[0]?.total || "0.00") } };
}

export async function getReceivableDetails(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({ id: receivables.id, invoiceId: receivables.invoiceId, documentNumber: receivables.documentNumber, customerName: receivables.customerName, customerAddress: receivables.customerAddress, issueDate: receivables.issueDate, dueDate: receivables.dueDate, totalAmount: receivables.totalAmount, paidAmount: receivables.paidAmount, status: receivables.status, note: receivables.note, updatedAt: receivables.updatedAt }).from(receivables).where(and(eq(receivables.id, id), eq(receivables.userId, userId))).limit(1);
  const receivable = result[0];
  if (!receivable) return undefined;
  const paymentRows = await db.select({ id: payments.id, amount: payments.amount, paidAt: payments.paidAt, method: payments.method, reference: payments.reference, note: payments.note, createdAt: payments.createdAt }).from(payments).where(and(eq(payments.receivableId, id), eq(payments.userId, userId))).orderBy(desc(payments.paidAt)).limit(100);
  return { ...receivable, status: deriveReceivableStatus(receivable.totalAmount, receivable.paidAmount, receivable.dueDate), payments: paymentRows };
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
  const result = await db.insert(receivables).values({ userId, invoiceId, documentNumber: invoice.documentNumber, customerName, customerAddress: payload.customer?.address || null, issueDate, dueDate, totalAmount: totals.total, paidAmount: "0.00", status, note: payload.note || null });
  const insertedId = Number(result[0].insertId);
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
    await tx.insert(payments).values({ userId, receivableId: input.receivableId, amount: Number(input.amount).toFixed(2), paidAt: input.paidAt, method: input.method, reference: input.reference || null, note: input.note || null });
    const nextPaidCents = Math.round((Number(receivable.paidAmount) || 0) * 100) + validation.amountCents;
    const nextPaid = (nextPaidCents / 100).toFixed(2);
    const nextStatus = deriveReceivableStatus(receivable.totalAmount, nextPaid, receivable.dueDate);
    await tx.update(receivables).set({ paidAmount: nextPaid, status: nextStatus }).where(and(eq(receivables.id, input.receivableId), eq(receivables.userId, userId)));
    return { paidAmount: nextPaid, status: nextStatus };
  });
}

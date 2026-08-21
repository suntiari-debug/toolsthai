import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { companyProfiles, InsertUser, savedDocuments, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

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

export async function saveCompanyProfile(input: { userId: number; name: string; address?: string | null; taxId?: string | null; phone?: string | null; email?: string | null; logoUrl?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(companyProfiles).values(input).onDuplicateKeyUpdate({
    set: { name: input.name, address: input.address ?? null, taxId: input.taxId ?? null, phone: input.phone ?? null, email: input.email ?? null, logoUrl: input.logoUrl ?? null },
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

import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const companyProfiles = mysqlTable("company_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  taxId: varchar("taxId", { length: 32 }),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 320 }),
  logoUrl: text("logoUrl"),
  signatureUrl: text("signatureUrl"),
  stampUrl: text("stampUrl"),
  signerName: varchar("signerName", { length: 255 }),
  signerPosition: varchar("signerPosition", { length: 255 }),
  defaultDocumentTemplate: varchar("defaultDocumentTemplate", { length: 32 }),
  defaultAccentColor: varchar("defaultAccentColor", { length: 16 }),
  defaultFontFamily: varchar("defaultFontFamily", { length: 32 }),
  defaultFontSize: varchar("defaultFontSize", { length: 16 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const savedDocuments = mysqlTable("saved_documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: mysqlEnum("kind", ["quotation", "invoice", "receipt", "delivery-note", "tax-invoice"]).notNull(),
  documentNumber: varchar("documentNumber", { length: 64 }).notNull(),
  customerName: varchar("customerName", { length: 255 }),
  payload: text("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const receivables = mysqlTable("receivables", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  invoiceId: int("invoiceId").notNull().unique().references(() => savedDocuments.id, { onDelete: "cascade" }),
  documentNumber: varchar("documentNumber", { length: 64 }).notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerAddress: text("customerAddress"),
  issueDate: timestamp("issueDate").notNull(),
  dueDate: timestamp("dueDate").notNull(),
  totalAmount: decimal("totalAmount", { precision: 14, scale: 2 }).notNull(),
  paidAmount: decimal("paidAmount", { precision: 14, scale: 2 }).notNull().default("0.00"),
  status: mysqlEnum("status", ["open", "partial", "paid", "overdue", "cancelled"]).notNull().default("open"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userStatusIdx: index("receivables_user_status_idx").on(table.userId, table.status),
  dueDateIdx: index("receivables_due_date_idx").on(table.userId, table.dueDate),
}));

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  receivableId: int("receivableId").notNull().references(() => receivables.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  paidAt: timestamp("paidAt").notNull(),
  method: mysqlEnum("method", ["cash", "transfer", "card", "cheque", "other"]).notNull().default("transfer"),
  reference: varchar("reference", { length: 128 }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userPaidAtIdx: index("payments_user_paid_at_idx").on(table.userId, table.paidAt),
  receivableIdx: index("payments_receivable_idx").on(table.receivableId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Receivable = typeof receivables.$inferSelect;
export type Payment = typeof payments.$inferSelect;

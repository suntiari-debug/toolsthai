import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
  status: mysqlEnum("status", ["draft", "sent", "paid", "overdue"]).notNull().default("draft"),
  archivedAt: timestamp("archivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userStatusUpdatedIdx: index("saved_documents_user_status_updated_idx").on(table.userId, table.status, table.updatedAt),
}));

export const documentExports = mysqlTable("document_exports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentId: int("documentId").notNull().references(() => savedDocuments.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userDocumentCreatedIdx: index("document_exports_user_document_created_idx").on(table.userId, table.documentId, table.createdAt),
}));

export const receiptSources = mysqlTable("receipt_sources", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  receivableId: int("receivableId").notNull().references(() => receivables.id, { onDelete: "cascade" }),
  invoiceId: int("invoiceId").notNull().references(() => savedDocuments.id, { onDelete: "cascade" }),
  receiptDocumentId: int("receiptDocumentId").notNull().references(() => savedDocuments.id, { onDelete: "cascade" }),
  activePaymentIds: text("activePaymentIds").notNull(),
  paymentTotalAtCreation: decimal("paymentTotalAtCreation", { precision: 14, scale: 2 }).notNull(),
  createdFrom: varchar("createdFrom", { length: 32 }).notNull().default("receivable-paid"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  receivableUnique: uniqueIndex("receipt_sources_receivable_unique").on(table.receivableId),
  receiptDocumentUnique: uniqueIndex("receipt_sources_receipt_document_unique").on(table.receiptDocumentId),
  userReceivableIdx: index("receipt_sources_user_receivable_idx").on(table.userId, table.receivableId),
}));

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
  voidedAt: timestamp("voidedAt"),
  voidReason: varchar("voidReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userPaidAtIdx: index("payments_user_paid_at_idx").on(table.userId, table.paidAt),
  receivableIdx: index("payments_receivable_idx").on(table.receivableId),
}));

export const receivableEvents = mysqlTable("receivable_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  receivableId: int("receivableId").notNull().references(() => receivables.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["created", "payment-recorded", "payment-voided", "payment-replaced", "receipt-draft-created"]).notNull(),
  paymentId: int("paymentId").references(() => payments.id, { onDelete: "set null" }),
  amount: decimal("amount", { precision: 14, scale: 2 }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userReceivableCreatedIdx: index("receivable_events_user_receivable_created_idx").on(table.userId, table.receivableId, table.createdAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Receivable = typeof receivables.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type ReceivableEvent = typeof receivableEvents.$inferSelect;
export type DocumentExport = typeof documentExports.$inferSelect;
export type ReceiptSource = typeof receiptSources.$inferSelect;

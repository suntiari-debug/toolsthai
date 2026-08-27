import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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

/** Customer master is owner-scoped. Duplicate name/tax ID stays permitted and is surfaced as a warning in application logic. */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerType: mysqlEnum("customerType", ["company", "person"]).notNull().default("company"),
  name: varchar("name", { length: 255 }).notNull(),
  taxId: varchar("taxId", { length: 32 }),
  address: text("address"),
  contactName: varchar("contactName", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 320 }),
  note: text("note"),
  archivedAt: timestamp("archivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userArchivedNameIdx: index("customers_user_archived_name_idx").on(table.userId, table.archivedAt, table.name),
  userTaxIdIdx: index("customers_user_tax_id_idx").on(table.userId, table.taxId),
}));

export const savedDocuments = mysqlTable("saved_documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: int("customerId").references(() => customers.id, { onDelete: "set null" }),
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
  userCustomerIdx: index("saved_documents_user_customer_idx").on(table.userId, table.customerId),
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

/** Immutable save-time snapshots. Retention is non-destructive; list APIs page metadata and load payload only for an explicit preview. */
export const documentRevisions = mysqlTable("document_revisions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull().references(() => savedDocuments.id, { onDelete: "cascade" }),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  actorId: int("actorId").references(() => users.id, { onDelete: "set null" }),
  revisionNumber: int("revisionNumber").notNull(),
  summary: varchar("summary", { length: 500 }).notNull(),
  payload: text("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  documentRevisionUnique: uniqueIndex("document_revisions_document_revision_unique").on(table.documentId, table.revisionNumber),
  ownerDocumentCreatedIdx: index("document_revisions_owner_document_created_idx").on(table.ownerId, table.documentId, table.createdAt),
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
  customerId: int("customerId").references(() => customers.id, { onDelete: "set null" }),
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
  userCustomerIdx: index("receivables_user_customer_idx").on(table.userId, table.customerId),
}));

/** User-owned opt-in preferences and the lifecycle key for one daily reminder schedule. */
export const receivableReminderSettings = mysqlTable("receivable_reminder_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  daysBeforeDue: varchar("daysBeforeDue", { length: 32 }).notNull().default("1,3,7"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Bangkok"),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).unique(),
  lastEvaluatedAt: timestamp("lastEvaluatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Both the end-user inbox and immutable reminder audit/dedupe ledger.  A unique
 * owner/receivable/type/local-date tuple makes repeated/retried evaluations safe.
 */
export const receivableReminders = mysqlTable("receivable_reminders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  receivableId: int("receivableId").notNull().references(() => receivables.id, { onDelete: "cascade" }),
  invoiceId: int("invoiceId").notNull().references(() => savedDocuments.id, { onDelete: "cascade" }),
  reminderType: mysqlEnum("reminderType", ["due-soon", "overdue"]).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  dueDateBasis: varchar("dueDateBasis", { length: 10 }).notNull(),
  evaluationDate: varchar("evaluationDate", { length: 10 }).notNull(),
  outstandingAmount: decimal("outstandingAmount", { precision: 14, scale: 2 }).notNull(),
  documentNumber: varchar("documentNumber", { length: 64 }).notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["unread", "read"]).notNull().default("unread"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userStatusCreatedIdx: index("reminder_user_status_created_idx").on(table.userId, table.status, table.createdAt),
  userTypeCreatedIdx: index("reminder_user_type_created_idx").on(table.userId, table.reminderType, table.createdAt),
  userReceivableIdx: index("reminder_user_receivable_idx").on(table.userId, table.receivableId),
  dailyDedupeUnique: uniqueIndex("reminder_user_receivable_type_day_unique").on(table.userId, table.receivableId, table.reminderType, table.evaluationDate),
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

/** Metadata only; proof bytes live exclusively in S3 and deletedAt hides the key from all future application reads. */
export const paymentAttachments = mysqlTable("payment_attachments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  paymentId: int("paymentId").notNull().references(() => payments.id, { onDelete: "cascade" }),
  storageKey: varchar("storageKey", { length: 1024 }).notNull(),
  originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
  mimeType: mysqlEnum("mimeType", ["image/png", "image/jpeg", "image/webp", "application/pdf"]).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  caption: varchar("caption", { length: 500 }),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  storageKeyUnique: uniqueIndex("payment_attachments_storage_key_unique").on(table.storageKey),
  userPaymentDeletedCreatedIdx: index("payment_attachments_user_payment_deleted_created_idx").on(table.userId, table.paymentId, table.deletedAt, table.createdAt),
}));

export const receivableEvents = mysqlTable("receivable_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  receivableId: int("receivableId").notNull().references(() => receivables.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["created", "payment-recorded", "payment-voided", "payment-replaced", "receipt-draft-created", "payment-attachment-added", "payment-attachment-removed"]).notNull(),
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
export type PaymentAttachment = typeof paymentAttachments.$inferSelect;
export type ReceivableEvent = typeof receivableEvents.$inferSelect;
export type DocumentExport = typeof documentExports.$inferSelect;
export type DocumentRevision = typeof documentRevisions.$inferSelect;
export type ReceiptSource = typeof receiptSources.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type ReceivableReminderSetting = typeof receivableReminderSettings.$inferSelect;
export type ReceivableReminder = typeof receivableReminders.$inferSelect;

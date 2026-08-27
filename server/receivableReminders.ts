import { centsToMoney, deriveReceivableStatus, moneyToCents, type ReceivableStatus } from "./receivables";

export const REMINDER_TIMEZONE = "Asia/Bangkok" as const;
export const REMINDER_CRON = "0 5 1 * * *" as const;

export type ReminderType = "due-soon" | "overdue";
export type ReminderDays = readonly number[];

export type ReminderCandidateInput = {
  id: number;
  invoiceId: number;
  documentNumber: string;
  customerName: string;
  dueDate: Date;
  totalAmount: number | string;
  paidAmount: number | string;
  status: ReceivableStatus;
};

export type ReminderCandidate = {
  receivableId: number;
  invoiceId: number;
  reminderType: ReminderType;
  documentNumber: string;
  customerName: string;
  dueDate: Date;
  dueDateBasis: string;
  evaluationDate: string;
  outstandingAmount: string;
};

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Produces the calendar day in the user's configured IANA timezone without render-time clocks. */
export function getLocalDateKey(now: Date, timezone = REMINDER_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (kind: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === kind)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) throw new Error("ไม่สามารถคำนวณวันตามเขตเวลาที่เลือกได้");
  return toDateKey(Number(year), Number(month), Number(day));
}

/** Due dates are business date-only values persisted at a UTC day boundary in the current schema. */
export function getDueDateBasis(dueDate: Date) {
  if (Number.isNaN(dueDate.getTime())) throw new Error("วันครบกำหนดไม่ถูกต้อง");
  return dueDate.toISOString().slice(0, 10);
}

export function daysBetweenDateKeys(from: string, to: string) {
  const parse = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new Error("รูปแบบวันไม่ถูกต้อง");
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export function normalizeReminderDays(days: readonly number[]) {
  const normalized = Array.from(new Set(days.map((value) => Math.trunc(Number(value))).filter((value) => value >= 0 && value <= 60))).sort((left, right) => left - right);
  if (!normalized.length) throw new Error("โปรดเลือกจำนวนวันก่อนครบกำหนดอย่างน้อย 1 ค่า");
  return normalized;
}

export function parseReminderDays(value: string) {
  return normalizeReminderDays(value.split(",").map((part) => Number(part.trim())));
}

export function serializeReminderDays(days: readonly number[]) {
  return normalizeReminderDays(days).join(",");
}

export function getReminderCandidate(input: ReminderCandidateInput, daysBeforeDue: ReminderDays, now: Date, timezone = REMINDER_TIMEZONE): ReminderCandidate | null {
  const outstandingCents = Math.max(0, moneyToCents(input.totalAmount) - moneyToCents(input.paidAmount));
  const currentStatus = input.status === "cancelled" ? "cancelled" : deriveReceivableStatus(input.totalAmount, input.paidAmount, input.dueDate, now);
  if (currentStatus === "cancelled" || currentStatus === "paid" || outstandingCents <= 0) return null;

  const evaluationDate = getLocalDateKey(now, timezone);
  const dueDateBasis = getDueDateBasis(input.dueDate);
  const daysUntilDue = daysBetweenDateKeys(evaluationDate, dueDateBasis);
  const reminderType: ReminderType | null = daysUntilDue < 0 ? "overdue" : normalizeReminderDays(daysBeforeDue).includes(daysUntilDue) ? "due-soon" : null;
  if (!reminderType) return null;

  return {
    receivableId: input.id,
    invoiceId: input.invoiceId,
    reminderType,
    documentNumber: input.documentNumber,
    customerName: input.customerName,
    dueDate: input.dueDate,
    dueDateBasis,
    evaluationDate,
    outstandingAmount: centsToMoney(outstandingCents),
  };
}

export function getScheduleAction(input: { enabled: boolean; existingTaskUid?: string | null }) {
  if (!input.enabled) return input.existingTaskUid ? "pause" as const : "none" as const;
  return input.existingTaskUid ? "resume" as const : "create" as const;
}

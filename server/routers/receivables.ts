import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { parseDateOnly } from "../receivables";
import { createHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { getScheduleAction, REMINDER_CRON, REMINDER_TIMEZONE } from "../receivableReminders";

const paymentMethod = z.enum(["cash", "transfer", "card", "cheque", "other"]);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD");
const monthOnly = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "รูปแบบเดือนต้องเป็น YYYY-MM");
const reminderSettingsInput = z.object({ enabled: z.boolean(), daysBeforeDue: z.array(z.coerce.number().int().min(0).max(60)).min(1).max(8), timezone: z.literal(REMINDER_TIMEZONE) });

function getSessionToken(cookieHeader: string | undefined) {
  return parseCookie(cookieHeader || "")[COOKIE_NAME] || "";
}

export const receivablesRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.listReceivables(ctx.user.id)),
  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const result = await db.getReceivableDetails(ctx.user.id, input.id);
    if (!result) throw new Error("ไม่พบรายการลูกหนี้");
    return result;
  }),
  getByInvoice: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive() })).query(({ ctx, input }) => db.getReceivableByInvoice(ctx.user.id, input.invoiceId)),
  agingReport: protectedProcedure.input(z.object({ asOf: dateOnly, month: monthOnly })).query(({ ctx, input }) => db.getReceivableAgingReport(ctx.user.id, { asOf: parseDateOnly(input.asOf), month: input.month })),
  reminderSettings: protectedProcedure.query(({ ctx }) => db.getReceivableReminderSettings(ctx.user.id)),
  saveReminderSettings: protectedProcedure.input(reminderSettingsInput).mutation(async ({ ctx, input }) => {
    const current = await db.getReceivableReminderSettings(ctx.user.id);
    const sessionToken = getSessionToken(ctx.req.headers.cookie);
    const action = getScheduleAction({ enabled: input.enabled, existingTaskUid: current.scheduleCronTaskUid });
    let scheduleCronTaskUid = current.scheduleCronTaskUid;
    if (action === "create") {
      const created = await createHeartbeatJob({ name: `receivable-reminders-${ctx.user.id}`, cron: REMINDER_CRON, path: "/api/scheduled/receivable-reminders", description: "ประเมินการเตือนติดตามลูกหนี้รายวัน" }, sessionToken);
      scheduleCronTaskUid = created.taskUid;
    } else if (action === "pause" || action === "resume") {
      await updateHeartbeatJob(current.scheduleCronTaskUid!, { cron: REMINDER_CRON, path: "/api/scheduled/receivable-reminders", enable: action === "resume", description: "ประเมินการเตือนติดตามลูกหนี้รายวัน" }, sessionToken);
    }
    return db.saveReceivableReminderSettings(ctx.user.id, { ...input, scheduleCronTaskUid });
  }),
  reminderInbox: protectedProcedure.query(({ ctx }) => db.getReceivableReminderInbox(ctx.user.id)),
  markReminderRead: protectedProcedure.input(z.object({ reminderId: z.number().int().positive() })).mutation(({ ctx, input }) => db.markReceivableReminderRead(ctx.user.id, input.reminderId)),
  evaluateRemindersNow: adminProcedure.mutation(({ ctx }) => db.evaluateReceivableReminders(ctx.user.id)),
  receiptEligibility: protectedProcedure.input(z.object({ receivableId: z.number().int().positive() })).query(({ ctx, input }) => db.getReceiptEligibility(ctx.user.id, input.receivableId)),
  createFromInvoice: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive() })).mutation(({ ctx, input }) => db.createReceivableFromInvoice(ctx.user.id, input.invoiceId)),
  recordPayment: protectedProcedure.input(z.object({ receivableId: z.number().int().positive(), amount: z.coerce.number().positive().max(999999999), paidAt: dateOnly, method: paymentMethod, reference: z.string().trim().max(128).optional(), note: z.string().trim().max(2000).optional() })).mutation(({ ctx, input }) => db.recordPayment(ctx.user.id, { receivableId: input.receivableId, amount: input.amount, paidAt: parseDateOnly(input.paidAt, true), method: input.method, reference: input.reference, note: input.note })),
  voidPayment: protectedProcedure.input(z.object({ paymentId: z.number().int().positive(), reason: z.string().trim().min(3).max(255) })).mutation(({ ctx, input }) => db.voidPayment(ctx.user.id, input)),
  replacePayment: protectedProcedure.input(z.object({ paymentId: z.number().int().positive(), receivableId: z.number().int().positive(), amount: z.coerce.number().positive().max(999999999), paidAt: dateOnly, method: paymentMethod, reference: z.string().trim().max(128).optional(), note: z.string().trim().max(2000).optional(), reason: z.string().trim().min(3).max(255) })).mutation(({ ctx, input }) => db.replacePayment(ctx.user.id, { ...input, paidAt: parseDateOnly(input.paidAt, true) })),
  createReceiptDraft: protectedProcedure.input(z.object({ receivableId: z.number().int().positive() })).mutation(({ ctx, input }) => db.createReceiptDraft(ctx.user.id, input.receivableId)),
});

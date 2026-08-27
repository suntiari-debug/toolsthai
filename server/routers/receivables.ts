import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { parseDateOnly } from "../receivables";

const paymentMethod = z.enum(["cash", "transfer", "card", "cheque", "other"]);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD");

export const receivablesRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.listReceivables(ctx.user.id)),
  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const result = await db.getReceivableDetails(ctx.user.id, input.id);
    if (!result) throw new Error("ไม่พบรายการลูกหนี้");
    return result;
  }),
  createFromInvoice: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive() })).mutation(({ ctx, input }) => db.createReceivableFromInvoice(ctx.user.id, input.invoiceId)),
  recordPayment: protectedProcedure.input(z.object({ receivableId: z.number().int().positive(), amount: z.coerce.number().positive().max(999999999), paidAt: dateOnly, method: paymentMethod, reference: z.string().trim().max(128).optional(), note: z.string().trim().max(2000).optional() })).mutation(({ ctx, input }) => db.recordPayment(ctx.user.id, { receivableId: input.receivableId, amount: input.amount, paidAt: parseDateOnly(input.paidAt, true), method: input.method, reference: input.reference, note: input.note })),
});

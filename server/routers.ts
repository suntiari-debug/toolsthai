import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";

const documentKind = z.enum(["quotation", "invoice", "receipt", "delivery-note", "tax-invoice"]);
const documentStatus = z.enum(["draft", "sent", "paid", "overdue"]);
const documentListInput = z.object({
  query: z.string().trim().max(120).optional(),
  kind: documentKind.optional(),
  status: documentStatus.optional(),
  includeArchived: z.boolean().optional(),
}).optional();
const companyProfileInput = z.object({
  name: z.string().trim().min(1).max(255),
  address: z.string().trim().max(2000).optional(),
  taxId: z.string().trim().max(32).optional(),
  phone: z.string().trim().max(64).optional(),
  email: z.string().trim().email().max(320).or(z.literal("")).optional(),
  logoDataUrl: z.string().max(750_000).optional(),
  existingLogoUrl: z.string().max(1024).optional(),
  signatureDataUrl: z.string().max(750_000).optional(),
  existingSignatureUrl: z.string().max(1024).optional(),
  stampDataUrl: z.string().max(750_000).optional(),
  existingStampUrl: z.string().max(1024).optional(),
  signerName: z.string().trim().max(255).optional(),
  signerPosition: z.string().trim().max(255).optional(),
  defaultDocumentTemplate: z.enum(["modern", "classic", "minimal"]).optional(),
  defaultAccentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  defaultFontFamily: z.enum(["sarabun", "noto-sans", "noto-serif"]).optional(),
  defaultFontSize: z.enum(["small", "medium", "large"]).optional(),
});

function getImageUpload(imageDataUrl: string, label: string) {
  const match = imageDataUrl.match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/);
  if (!match) throw new Error("รองรับเฉพาะไฟล์ PNG, JPG และ WEBP");
  const mimeType = match[1];
  const extension = match[2] === "jpeg" ? "jpg" : match[2];
  const buffer = Buffer.from(match[3], "base64");
  if (buffer.length > 500_000) throw new Error(`ไฟล์${label}ต้องมีขนาดไม่เกิน 500 KB`);
  return { mimeType, extension, buffer };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  companyProfile: router({
    get: protectedProcedure.query(async ({ ctx }) => (await db.getCompanyProfile(ctx.user.id)) ?? null),
    save: protectedProcedure.input(companyProfileInput).mutation(async ({ ctx, input }) => {
      let logoUrl = input.existingLogoUrl || null;
      let signatureUrl = input.existingSignatureUrl || null;
      let stampUrl = input.existingStampUrl || null;
      if (input.logoDataUrl) {
        const upload = getImageUpload(input.logoDataUrl, "โลโก้");
        const result = await storagePut(`company-logos/${ctx.user.id}/${Date.now()}.${upload.extension}`, upload.buffer, upload.mimeType);
        logoUrl = result.url;
      }
      if (input.signatureDataUrl) {
        const upload = getImageUpload(input.signatureDataUrl, "ลายเซ็น");
        const result = await storagePut(`company-signatures/${ctx.user.id}/${Date.now()}.${upload.extension}`, upload.buffer, upload.mimeType);
        signatureUrl = result.url;
      }
      if (input.stampDataUrl) {
        const upload = getImageUpload(input.stampDataUrl, "ตรายาง");
        const result = await storagePut(`company-stamps/${ctx.user.id}/${Date.now()}.${upload.extension}`, upload.buffer, upload.mimeType);
        stampUrl = result.url;
      }
      return db.saveCompanyProfile({ userId: ctx.user.id, name: input.name, address: input.address || null, taxId: input.taxId || null, phone: input.phone || null, email: input.email || null, logoUrl, signatureUrl, stampUrl, signerName: input.signerName || null, signerPosition: input.signerPosition || null, defaultDocumentTemplate: input.defaultDocumentTemplate || null, defaultAccentColor: input.defaultAccentColor || null, defaultFontFamily: input.defaultFontFamily || null, defaultFontSize: input.defaultFontSize || null });
    }),
  }),
  documents: router({
    list: protectedProcedure.input(documentListInput).query(({ ctx, input }) => db.listSavedDocuments(ctx.user.id, input)),
    save: protectedProcedure.input(z.object({ kind: documentKind, documentNumber: z.string().trim().min(1).max(64), customerName: z.string().trim().max(255).optional(), payload: z.string().min(2).max(60_000), status: documentStatus.optional() })).mutation(async ({ ctx, input }) => {
      await db.saveDocument({ userId: ctx.user.id, ...input });
      return { success: true } as const;
    }),
    updateStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: documentStatus })).mutation(async ({ ctx, input }) => {
      await db.setDocumentStatus(ctx.user.id, input.id, input.status);
      return { success: true } as const;
    }),
    setArchived: protectedProcedure.input(z.object({ id: z.number().int().positive(), archived: z.boolean() })).mutation(async ({ ctx, input }) => {
      await db.setDocumentArchived(ctx.user.id, input.id, input.archived);
      return { success: true } as const;
    }),
    duplicate: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => db.duplicateSavedDocument(ctx.user.id, input.id)),
    recordExport: protectedProcedure.input(z.object({ kind: documentKind, documentNumber: z.string().trim().min(1).max(64), customerName: z.string().trim().max(255).optional(), payload: z.string().min(2).max(60_000), filename: z.string().trim().min(5).max(255).regex(/\.pdf$/i) })).mutation(({ ctx, input }) => db.recordDocumentExport({ userId: ctx.user.id, ...input })),
    listExports: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).query(({ ctx, input }) => db.listDocumentExports(ctx.user.id, input.documentId)),
  }),
});

export type AppRouter = typeof appRouter;

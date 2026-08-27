export const MAX_PAYMENT_ATTACHMENT_BYTES = 5_000_000;
export const paymentAttachmentMimeTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
export type PaymentAttachmentMimeType = typeof paymentAttachmentMimeTypes[number];
const allowedMimeTypes = new Set<string>(paymentAttachmentMimeTypes);

export function validatePaymentAttachmentFile(file: Pick<File, "type" | "size"> | undefined) {
  if (!file) return { valid: false as const, message: "กรุณาเลือกไฟล์หลักฐานการรับชำระ" };
  if (!allowedMimeTypes.has(file.type)) return { valid: false as const, message: "รองรับเฉพาะ PNG, JPG, WEBP และ PDF" };
  if (!Number.isFinite(file.size) || file.size <= 0) return { valid: false as const, message: "ไม่สามารถอ่านขนาดไฟล์ได้" };
  if (file.size > MAX_PAYMENT_ATTACHMENT_BYTES) return { valid: false as const, message: "ไฟล์หลักฐานต้องมีขนาดไม่เกิน 5 MB" };
  return { valid: true as const };
}

export function parsePaymentAttachmentDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !allowedMimeTypes.has(match[1])) throw new Error("รองรับเฉพาะ PNG, JPG, WEBP และ PDF");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length) throw new Error("ไฟล์หลักฐานว่างเปล่า");
  if (bytes.length > MAX_PAYMENT_ATTACHMENT_BYTES) throw new Error("ไฟล์หลักฐานต้องมีขนาดไม่เกิน 5 MB");
  return { mimeType: match[1] as PaymentAttachmentMimeType, bytes };
}

export function sanitizePaymentAttachmentFilename(filename: string) {
  const cleaned = filename.normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim();
  return (cleaned || "payment-proof").slice(0, 255);
}

export function buildPaymentAttachmentStorageName(filename: string, mimeType: PaymentAttachmentMimeType) {
  const extension = mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1]!.replace("jpeg", "jpg");
  const safe = sanitizePaymentAttachmentFilename(filename).replace(/\.[^.]+$/, "");
  return `${safe || "payment-proof"}.${extension}`;
}

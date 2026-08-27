export const MAX_PAYMENT_ATTACHMENT_BYTES = 5_000_000;
export const paymentAttachmentAccept = "image/png,image/jpeg,image/webp,application/pdf";
const paymentAttachmentTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

export function validatePaymentAttachmentFile(file: Pick<File, "type" | "size"> | undefined) {
  if (!file) return { valid: false as const, message: "กรุณาเลือกไฟล์หลักฐานการรับชำระ" };
  if (!paymentAttachmentTypes.has(file.type)) return { valid: false as const, message: "รองรับเฉพาะ PNG, JPG, WEBP และ PDF" };
  if (file.size <= 0) return { valid: false as const, message: "ไฟล์หลักฐานว่างเปล่า" };
  if (file.size > MAX_PAYMENT_ATTACHMENT_BYTES) return { valid: false as const, message: "ไฟล์หลักฐานต้องมีขนาดไม่เกิน 5 MB" };
  return { valid: true as const };
}

export function readPaymentAttachmentAsDataUrl(file: File, onProgress?: (progress: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์หลักฐานได้"));
    reader.onprogress = (event) => { if (event.lengthComputable) onProgress?.(15 + Math.round((event.loaded / event.total) * 55)); };
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function formatAttachmentSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

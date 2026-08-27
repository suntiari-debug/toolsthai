import { describe, expect, it } from "vitest";
import { MAX_PAYMENT_ATTACHMENT_BYTES, buildPaymentAttachmentStorageName, parsePaymentAttachmentDataUrl, sanitizePaymentAttachmentFilename, validatePaymentAttachmentFile } from "./paymentAttachments";

describe("payment attachment validation", () => {
  it("allows only bounded image/PDF proofs and normalizes a display filename", () => {
    expect(validatePaymentAttachmentFile({ type: "image/png", size: 1_000 })).toEqual({ valid: true });
    expect(validatePaymentAttachmentFile({ type: "application/pdf", size: MAX_PAYMENT_ATTACHMENT_BYTES })).toEqual({ valid: true });
    expect(validatePaymentAttachmentFile({ type: "image/gif", size: 1_000 })).toMatchObject({ valid: false, message: "รองรับเฉพาะ PNG, JPG, WEBP และ PDF" });
    expect(validatePaymentAttachmentFile({ type: "image/jpeg", size: MAX_PAYMENT_ATTACHMENT_BYTES + 1 })).toMatchObject({ valid: false, message: "ไฟล์หลักฐานต้องมีขนาดไม่เกิน 5 MB" });
    expect(() => parsePaymentAttachmentDataUrl("data:image/gif;base64,cHJvb2Y=")).toThrow("รองรับเฉพาะ PNG, JPG, WEBP และ PDF");
    expect(() => parsePaymentAttachmentDataUrl(`data:application/pdf;base64,${Buffer.alloc(MAX_PAYMENT_ATTACHMENT_BYTES + 1).toString("base64")}`)).toThrow("ไฟล์หลักฐานต้องมีขนาดไม่เกิน 5 MB");
    expect(sanitizePaymentAttachmentFilename('  สลิป:โอน/เงิน?.png  ')).toBe("สลิป-โอน-เงิน-.png");
    expect(buildPaymentAttachmentStorageName("หลักฐาน.png", "application/pdf")).toBe("หลักฐาน.pdf");
  });
});

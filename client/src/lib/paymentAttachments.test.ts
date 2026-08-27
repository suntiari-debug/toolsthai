import { describe, expect, it } from "vitest";
import { MAX_PAYMENT_ATTACHMENT_BYTES, formatAttachmentSize, validatePaymentAttachmentFile } from "./paymentAttachments";

describe("payment attachment client validation", () => {
  it("accepts bounded proof image/PDF files and rejects unsupported or oversized inputs before upload", () => {
    expect(validatePaymentAttachmentFile({ type: "image/webp", size: 100 })).toEqual({ valid: true });
    expect(validatePaymentAttachmentFile({ type: "application/pdf", size: MAX_PAYMENT_ATTACHMENT_BYTES })).toEqual({ valid: true });
    expect(validatePaymentAttachmentFile({ type: "text/plain", size: 100 })).toMatchObject({ valid: false, message: "รองรับเฉพาะ PNG, JPG, WEBP และ PDF" });
    expect(validatePaymentAttachmentFile({ type: "application/pdf", size: MAX_PAYMENT_ATTACHMENT_BYTES + 1 })).toMatchObject({ valid: false, message: "ไฟล์หลักฐานต้องมีขนาดไม่เกิน 5 MB" });
    expect(formatAttachmentSize(999)).toBe("999 B");
    expect(formatAttachmentSize(2_048)).toBe("2.0 KB");
    expect(formatAttachmentSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

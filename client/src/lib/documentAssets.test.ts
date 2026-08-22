import { describe, expect, it } from "vitest";
import { isTemporaryDocumentAssetUrl, MAX_DOCUMENT_ASSET_BYTES, validateDocumentAssetFile } from "./documentAssets";

describe("document asset validation", () => {
  it("accepts a PNG, JPG, or WEBP image no larger than 500 KB", () => {
    expect(validateDocumentAssetFile({ type: "image/png", size: MAX_DOCUMENT_ASSET_BYTES }, "ลายเซ็น")).toEqual({ valid: true });
    expect(validateDocumentAssetFile({ type: "image/jpeg", size: 1 }, "ตรายาง")).toEqual({ valid: true });
    expect(validateDocumentAssetFile({ type: "image/webp", size: 1 }, "ตรายาง")).toEqual({ valid: true });
  });

  it("rejects unsupported image types and oversized files", () => {
    expect(validateDocumentAssetFile({ type: "image/gif", size: 1 }, "ลายเซ็น")).toEqual({ valid: false, message: "ลายเซ็นรองรับเฉพาะ PNG, JPG และ WEBP" });
    expect(validateDocumentAssetFile({ type: "image/png", size: MAX_DOCUMENT_ASSET_BYTES + 1 }, "ตรายาง")).toEqual({ valid: false, message: "ไฟล์ตรายางต้องมีขนาดไม่เกิน 500 KB" });
  });

  it("identifies only browser-generated object URLs as temporary assets", () => {
    expect(isTemporaryDocumentAssetUrl("blob:https://toolsthai.test/logo-1")).toBe(true);
    expect(isTemporaryDocumentAssetUrl("https://cdn.example.com/logo.png")).toBe(false);
    expect(isTemporaryDocumentAssetUrl("")).toBe(false);
    expect(isTemporaryDocumentAssetUrl(undefined)).toBe(false);
  });
});

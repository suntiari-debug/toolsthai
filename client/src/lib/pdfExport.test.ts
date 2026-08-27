import { describe, expect, it } from "vitest";
import { sanitizePdfFilename } from "./pdfExport";

describe("PDF filename sanitizer", () => {
  it("keeps one PDF extension and strips characters rejected by common file systems", () => {
    expect(sanitizePdfFilename("  ใบแจ้งหนี้: ACME/01.pdf  ", "invoice")).toBe("ใบแจ้งหนี้- ACME-01.pdf");
  });

  it("uses a safe fallback for empty or invalid filenames", () => {
    expect(sanitizePdfFilename("<>:*?", "IV-202608-001")).toBe("IV-202608-001.pdf");
    expect(sanitizePdfFilename("", "")).toBe("tools-thai-document.pdf");
  });
});

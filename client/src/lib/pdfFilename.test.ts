import { describe, expect, it } from "vitest";
import { buildPdfFilename } from "./pdfFilename";

describe("buildPdfFilename", () => {
  it("adds one PDF extension and replaces unsafe filename characters", () => {
    expect(buildPdfFilename("ใบเสนอราคา: ACME.pdf", "QT-001")).toBe("ใบเสนอราคา- ACME.pdf");
  });

  it("uses the fallback when the user enters no usable filename", () => {
    expect(buildPdfFilename("   ", "QT-001")).toBe("QT-001.pdf");
  });
});

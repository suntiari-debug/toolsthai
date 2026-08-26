import { businessDocumentTemplates, defaultDocumentDesign, normalizeDocumentAccentColor, normalizeDocumentFontFamily, normalizeDocumentFontSize, normalizeDocumentTemplate } from "./documentDesign";
import { describe, expect, it } from "vitest";

describe("document design settings", () => {
  it("defines categorized business templates with valid document design values", () => {
    expect(businessDocumentTemplates.map((template) => template.category)).toEqual(expect.arrayContaining(["ทั่วไป", "บริการ", "สินค้า", "รับเหมา", "วิชาชีพ"]));
    expect(businessDocumentTemplates.every((template) => /^#[0-9a-f]{6}$/i.test(template.accentColor))).toBe(true);
  });

  it("normalizes unknown stored design values to safe defaults", () => {
    expect(normalizeDocumentTemplate("unknown")).toBe(defaultDocumentDesign.template);
    expect(normalizeDocumentFontFamily("unknown")).toBe(defaultDocumentDesign.fontFamily);
    expect(normalizeDocumentFontSize("unknown")).toBe(defaultDocumentDesign.fontSize);
    expect(normalizeDocumentAccentColor("teal")).toBe(defaultDocumentDesign.accentColor);
  });

  it("keeps allowed font and template settings", () => {
    expect(normalizeDocumentTemplate("minimal")).toBe("minimal");
    expect(normalizeDocumentFontFamily("noto-serif")).toBe("noto-serif");
    expect(normalizeDocumentFontSize("large")).toBe("large");
    expect(normalizeDocumentAccentColor("#2563d9")).toBe("#2563d9");
  });
});

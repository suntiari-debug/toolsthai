import { describe, expect, it } from "vitest";
import { amountToThaiWords, calculateDocumentTotals, convertDocument, createInitialDocument, restoreDocument } from "./document";

describe("document calculations", () => {
  it("calculates an excluded VAT document with discount", () => {
    const document = createInitialDocument("quotation");
    document.items = [
      { id: "one", name: "บริการภาษาไทย", description: "", quantity: 2, unit: "รายการ", unitPrice: 1000 },
      { id: "two", name: "สินค้า", description: "", quantity: 1, unit: "ชิ้น", unitPrice: 500 },
    ];
    document.discount = 100;
    document.vatRate = 7;
    document.vatMode = "excluded";
    const totals = calculateDocumentTotals(document);
    expect(totals.subtotal).toBe(2500);
    expect(totals.discount).toBe(100);
    expect(totals.beforeVat).toBe(2400);
    expect(totals.vat).toBe(168);
    expect(totals.total).toBe(2568);
  });

  it("extracts VAT from VAT-inclusive document total", () => {
    const document = createInitialDocument("invoice");
    document.items = [{ id: "one", name: "สินค้า", description: "", quantity: 1, unit: "ชิ้น", unitPrice: 1070 }];
    document.vatRate = 7;
    document.vatMode = "included";
    const totals = calculateDocumentTotals(document);
    expect(totals.beforeVat).toBeCloseTo(1000, 6);
    expect(totals.vat).toBeCloseTo(70, 6);
    expect(totals.total).toBe(1070);
  });

  it("spells Thai baht amount including satang", () => {
    expect(amountToThaiWords(125.5)).toBe("หนึ่งร้อยยี่สิบห้าบาทห้าสิบสตางค์");
    expect(amountToThaiWords(0)).toBe("ศูนย์บาทถ้วน");
  });

  it("converts a quotation to every downstream document while preserving company, customer, and items", () => {
    const quotation = createInitialDocument("quotation");
    quotation.documentNumber = "QT-202608-008";
    quotation.company.name = "บริษัท ทดสอบ จำกัด";
    quotation.customer.name = "ลูกค้าทดสอบ";
    quotation.signatureUrl = "/manus-storage/company-signatures/signature.png";
    quotation.stampUrl = "/manus-storage/company-stamps/stamp.png";
    quotation.items = [{ id: "item-1", name: "บริการออกแบบ", description: "งานเดือนสิงหาคม", quantity: 2, unit: "ชั่วโมง", unitPrice: 1500 }];
    const targets = [
      ["invoice", "IV"],
      ["receipt", "RC"],
      ["delivery-note", "DN"],
    ] as const;
    for (const [target, prefix] of targets) {
      const converted = convertDocument(quotation, target);
      expect(converted.kind).toBe(target);
      expect(converted.documentNumber).toMatch(new RegExp(`^${prefix}-`));
      expect(converted.company).toEqual(quotation.company);
      expect(converted.customer).toEqual(quotation.customer);
      expect(converted.items).toEqual(quotation.items);
      expect(converted.items).not.toBe(quotation.items);
      expect(converted.signatureUrl).toBe(quotation.signatureUrl);
      expect(converted.stampUrl).toBe(quotation.stampUrl);
    }
  });

  it("restores a converted document payload with its number and data intact", () => {
    const quotation = createInitialDocument("quotation");
    quotation.company.name = "บริษัท ทดสอบ จำกัด";
    quotation.customer.name = "ลูกค้าทดสอบ";
    quotation.signatureUrl = "/manus-storage/company-signatures/signature.png";
    quotation.stampUrl = "/manus-storage/company-stamps/stamp.png";
    quotation.items = [{ id: "item-2", name: "บริการรายเดือน", description: "สิงหาคม", quantity: 1, unit: "เดือน", unitPrice: 2500 }];
    const converted = convertDocument(quotation, "receipt");
    const restored = restoreDocument(JSON.stringify(converted), "receipt");
    expect(restored).toEqual(converted);
    expect(restored.documentNumber).toMatch(/^RC-/);
    expect(restored.signatureUrl).toBe("/manus-storage/company-signatures/signature.png");
    expect(restored.stampUrl).toBe("/manus-storage/company-stamps/stamp.png");
  });
});

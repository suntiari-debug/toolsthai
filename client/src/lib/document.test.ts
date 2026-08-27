import { describe, expect, it } from "vitest";
import { amountToThaiWords, boundedLogoCrop, boundedLogoPosition, boundedLogoScale, boundedStampPosition, boundedStampRotation, boundedStampScale, calculateDocumentTotals, convertDocument, createHydrationSafeInitialDocument, createInitialDocument, restoreDocument } from "./document";

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

  it("limits the stamp transform to the signature artwork area", () => {
    expect(boundedStampPosition({ x: -20, y: 120 })).toEqual({ x: 16, y: 82 });
    expect(boundedStampPosition({ x: 52.34, y: 46.66 })).toEqual({ x: 52.3, y: 46.7 });
    expect(boundedStampScale(.1)).toBe(.6);
    expect(boundedStampScale(2.5)).toBe(1.7);
    expect(boundedStampRotation(-90)).toBe(-35);
    expect(boundedStampRotation(90)).toBe(35);
    expect(boundedStampRotation(12.4)).toBe(12.4);
  });

  it("limits logo crop, scale, and position to the printable header range", () => {
    expect(boundedLogoPosition({ x: -90, y: 80 })).toEqual({ x: -24, y: 18 });
    expect(boundedLogoScale(.1)).toBe(.65);
    expect(boundedLogoScale(9)).toBe(1.45);
    expect(boundedLogoCrop({ zoom: 7, x: -80, y: 80, brightness: 1, contrast: 500 })).toEqual({ zoom: 2.4, x: -34, y: 34, brightness: 70, contrast: 130 });
  });

  it("creates, converts, and restores the selected document font and size", () => {
    const document = createInitialDocument("quotation");
    expect(document.template).toBe("classic");
    expect(document.fontFamily).toBe("sarabun");
    expect(document.fontSize).toBe("medium");
    document.template = "minimal";
    document.accentColor = "#7c3aed";
    document.fontFamily = "noto-serif";
    document.fontSize = "large";
    const restored = restoreDocument(JSON.stringify(convertDocument(document, "invoice")), "invoice");
    expect(restored).toMatchObject({ template: "minimal", accentColor: "#7c3aed", fontFamily: "noto-serif", fontSize: "large" });
  });

  it("uses a deterministic placeholder during SSR hydration before live document dates are restored", () => {
    expect(createHydrationSafeInitialDocument("quotation")).toEqual(createHydrationSafeInitialDocument("quotation"));
    expect(createHydrationSafeInitialDocument("quotation")).toMatchObject({ documentNumber: "QT-200001-001", issueDate: "2000-01-01", dueDate: "2000-01-31", items: [{ id: "hydration-quotation-item" }] });
  });

  it("converts a quotation to every downstream document while preserving company, customer, and items", () => {
    const quotation = createInitialDocument("quotation");
    quotation.documentNumber = "QT-202608-008";
    quotation.company.name = "บริษัท ทดสอบ จำกัด";
    quotation.customer.name = "ลูกค้าทดสอบ";
    quotation.signatureUrl = "/manus-storage/company-signatures/signature.png";
    quotation.stampUrl = "/manus-storage/company-stamps/stamp.png";
    quotation.signerName = "นางสาวมานี มีงานทำ";
    quotation.signerPosition = "กรรมการผู้จัดการ";
    quotation.stampPosition = { x: 60, y: 44 };
    quotation.stampScale = 1.35;
    quotation.stampRotation = 12;
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
      expect(converted.signerName).toBe("นางสาวมานี มีงานทำ");
      expect(converted.signerPosition).toBe("กรรมการผู้จัดการ");
      expect(converted.stampPosition).toEqual({ x: 60, y: 44 });
      expect(converted.stampScale).toBe(1.35);
      expect(converted.stampRotation).toBe(12);
    }
  });

  it("restores a converted document payload with its number and data intact", () => {
    const quotation = createInitialDocument("quotation");
    quotation.company.name = "บริษัท ทดสอบ จำกัด";
    quotation.customer.name = "ลูกค้าทดสอบ";
    quotation.signatureUrl = "/manus-storage/company-signatures/signature.png";
    quotation.stampUrl = "/manus-storage/company-stamps/stamp.png";
    quotation.signerName = "นางสาวมานี มีงานทำ";
    quotation.signerPosition = "กรรมการผู้จัดการ";
    quotation.stampPosition = { x: 60, y: 44 };
    quotation.stampScale = 1.35;
    quotation.stampRotation = -12;
    quotation.items = [{ id: "item-2", name: "บริการรายเดือน", description: "สิงหาคม", quantity: 1, unit: "เดือน", unitPrice: 2500 }];
    const converted = convertDocument(quotation, "receipt");
    const restored = restoreDocument(JSON.stringify(converted), "receipt");
    expect(restored).toEqual(converted);
    expect(restored.documentNumber).toMatch(/^RC-/);
    expect(restored.signatureUrl).toBe("/manus-storage/company-signatures/signature.png");
    expect(restored.stampUrl).toBe("/manus-storage/company-stamps/stamp.png");
    expect(restored.signerName).toBe("นางสาวมานี มีงานทำ");
    expect(restored.signerPosition).toBe("กรรมการผู้จัดการ");
    expect(restored.stampPosition).toEqual({ x: 60, y: 44 });
    expect(restored.stampScale).toBe(1.35);
    expect(restored.stampRotation).toBe(-12);
  });

  it("keeps legacy payloads without a customer master link editable while preserving an optional customerId for new documents", () => {
    const legacy = createInitialDocument("invoice");
    const legacyPayload = JSON.stringify({ ...legacy, customer: { name: "ลูกค้าเดิม", address: "ที่อยู่เดิม", taxId: "", contact: "คุณเก่า" } });
    const restoredLegacy = restoreDocument(legacyPayload, "invoice");
    expect(restoredLegacy.customer).toEqual({ name: "ลูกค้าเดิม", address: "ที่อยู่เดิม", taxId: "", contact: "คุณเก่า" });
    expect(restoredLegacy.customerId).toBeUndefined();
    restoredLegacy.customerId = 44;
    expect(convertDocument(restoredLegacy, "receipt").customerId).toBe(44);
  });
});

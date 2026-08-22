import { describe, expect, it } from "vitest";
import { createInitialDocument } from "./document";
import { getDocumentValidationIssues } from "./documentValidation";

describe("document validation before PDF export", () => {
  it("identifies the essential fields that are absent from a new business document", () => {
    const document = createInitialDocument("quotation");
    expect(getDocumentValidationIssues(document).map((issue) => issue.id)).toEqual(["company-name", "customer-name"]);
  });

  it("requires a due date for documents that use one but not for receipts", () => {
    const quotation = createInitialDocument("quotation");
    quotation.company.name = "บริษัท ทดสอบ จำกัด";
    quotation.customer.name = "ลูกค้าทดสอบ";
    quotation.dueDate = "";
    expect(getDocumentValidationIssues(quotation).map((issue) => issue.id)).toContain("due-date");

    const receipt = createInitialDocument("receipt");
    receipt.company.name = "บริษัท ทดสอบ จำกัด";
    receipt.customer.name = "ลูกค้าทดสอบ";
    receipt.dueDate = "";
    expect(getDocumentValidationIssues(receipt).map((issue) => issue.id)).not.toContain("due-date");
  });

  it("reports incomplete item names and accepts a complete document", () => {
    const document = createInitialDocument("invoice");
    document.company.name = "บริษัท ทดสอบ จำกัด";
    document.customer.name = "ลูกค้าทดสอบ";
    document.items[0].name = "";
    expect(getDocumentValidationIssues(document).map((issue) => issue.id)).toContain("items");

    document.items[0].name = "บริการออกแบบ";
    expect(getDocumentValidationIssues(document)).toEqual([]);
  });
});

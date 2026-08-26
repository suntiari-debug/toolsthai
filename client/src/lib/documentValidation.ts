import type { BusinessDocument } from "./document";

export type DocumentValidationIssue = { id: string; label: string; message: string };

export function getDocumentValidationIssues(document: BusinessDocument): DocumentValidationIssue[] {
  const issues: DocumentValidationIssue[] = [];
  if (!document.documentNumber.trim()) issues.push({ id: "document-number", label: "เลขที่เอกสาร", message: "กรุณาระบุเลขที่เอกสาร" });
  if (!document.issueDate) issues.push({ id: "issue-date", label: "วันที่ออกเอกสาร", message: "กรุณาระบุวันที่ออกเอกสาร" });
  if (document.kind !== "receipt" && !document.dueDate) issues.push({ id: "due-date", label: "วันครบกำหนด", message: "กรุณาระบุวันครบกำหนดหรือวันใช้ได้ถึง" });
  if (!document.company.name.trim()) issues.push({ id: "company-name", label: "ชื่อบริษัท / ร้าน", message: "กรุณาระบุชื่อผู้ขายหรือผู้ออกเอกสาร" });
  if (!document.customer.name.trim()) issues.push({ id: "customer-name", label: "ชื่อลูกค้า", message: "กรุณาระบุชื่อลูกค้าหรือผู้รับเอกสาร" });
  if (document.items.length === 0 || document.items.some((item) => !item.name.trim())) issues.push({ id: "items", label: "รายการสินค้า / บริการ", message: "กรุณาระบุชื่อรายการสินค้า หรือบริการให้ครบ" });
  return issues;
}

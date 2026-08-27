export const DEFAULT_DOCUMENT_REVISION_PAGE_SIZE = 10;
export const MAX_DOCUMENT_REVISION_PAGE_SIZE = 20;
export const DOCUMENT_REVISION_RETENTION = "non-destructive" as const;

type RevisionSnapshot = { documentNumber?: unknown; customerId?: unknown; customer?: { name?: unknown; address?: unknown; taxId?: unknown }; issueDate?: unknown; dueDate?: unknown; items?: unknown[]; total?: unknown };

function parseSnapshot(payload: string): RevisionSnapshot | null {
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === "object" ? parsed as RevisionSnapshot : null;
  } catch {
    return null;
  }
}

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export function clampDocumentRevisionPage(input: { page?: number; pageSize?: number }) {
  const page = Math.max(1, Math.floor(input.page || 1));
  const pageSize = Math.min(MAX_DOCUMENT_REVISION_PAGE_SIZE, Math.max(1, Math.floor(input.pageSize || DEFAULT_DOCUMENT_REVISION_PAGE_SIZE)));
  return { page, pageSize };
}

export function summarizeDocumentRevision(previousPayload: string | null, nextPayload: string, fallbackDocumentNumber: string) {
  const previous = previousPayload ? parseSnapshot(previousPayload) : null;
  const next = parseSnapshot(nextPayload);
  if (!next) return "บันทึก snapshot เอกสาร";
  if (!previous) return `บันทึกครั้งแรก · ${text(next.documentNumber) || fallbackDocumentNumber}`.slice(0, 500);
  const changes: string[] = [];
  const compare = (label: string, before: unknown, after: unknown) => { if (text(before) !== text(after)) changes.push(label); };
  compare("เลขที่เอกสาร", previous.documentNumber, next.documentNumber);
  compare("ชื่อลูกค้า", previous.customer?.name, next.customer?.name);
  compare("ที่อยู่ลูกค้า", previous.customer?.address, next.customer?.address);
  compare("เลขภาษีลูกค้า", previous.customer?.taxId, next.customer?.taxId);
  compare("วันที่เอกสาร", previous.issueDate, next.issueDate);
  compare("วันครบกำหนด", previous.dueDate, next.dueDate);
  if ((previous.items?.length || 0) !== (next.items?.length || 0)) changes.push("จำนวนรายการ");
  compare("ยอดรวม", previous.total, next.total);
  return (changes.length ? `แก้ไข ${changes.join(" · ")}` : "บันทึกข้อมูลเอกสาร") .slice(0, 500);
}

export function getRestoredDocumentFields(payload: string, fallback: { documentNumber: string; customerName: string | null; customerId: number | null }) {
  const snapshot = parseSnapshot(payload);
  if (!snapshot) throw new Error("snapshot ของ revision ไม่ถูกต้อง");
  const customerId = typeof snapshot.customerId === "number" && Number.isInteger(snapshot.customerId) && snapshot.customerId > 0 ? snapshot.customerId : null;
  return { documentNumber: text(snapshot.documentNumber).slice(0, 64) || fallback.documentNumber, customerName: text(snapshot.customer?.name).slice(0, 255) || fallback.customerName, customerId };
}

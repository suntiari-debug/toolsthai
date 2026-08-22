export type DocumentKind = "quotation" | "invoice" | "receipt" | "delivery-note" | "tax-invoice";

export type LineItem = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type StampPosition = { x: number; y: number };
export const defaultStampPosition: StampPosition = { x: 78, y: 72 };
export const defaultStampScale = 1;

export function boundedStampPosition(position: StampPosition): StampPosition {
  return { x: Math.round(Math.min(88, Math.max(16, Number(position.x) || defaultStampPosition.x)) * 10) / 10, y: Math.round(Math.min(82, Math.max(18, Number(position.y) || defaultStampPosition.y)) * 10) / 10 };
}

export function boundedStampScale(scale: number) {
  return Math.round(Math.min(1.7, Math.max(.6, Number(scale) || defaultStampScale)) * 100) / 100;
}

export type BusinessDocument = {
  kind: DocumentKind;
  documentNumber: string;
  issueDate: string;
  dueDate: string;
  company: {
    name: string;
    address: string;
    taxId: string;
    phone: string;
    email: string;
    logoUrl: string;
  };
  customer: {
    name: string;
    address: string;
    taxId: string;
    contact: string;
  };
  items: LineItem[];
  discount: number;
  vatRate: number;
  vatMode: "excluded" | "included" | "none";
  note: string;
  signerName?: string;
  signatureUrl?: string;
  stampUrl?: string;
  stampPosition?: StampPosition;
  stampScale?: number;
  watermark: boolean;
};

export const documentMeta: Record<DocumentKind, { title: string; english: string; prefix: string; intro: string }> = {
  quotation: { title: "ใบเสนอราคา", english: "QUOTATION", prefix: "QT", intro: "เริ่มงานอย่างมืออาชีพด้วยใบเสนอราคาที่ชัดเจน" },
  invoice: { title: "ใบแจ้งหนี้ / ใบวางบิล", english: "INVOICE", prefix: "IV", intro: "ออกใบแจ้งหนี้และกำหนดวันครบกำหนดชำระได้ในเอกสารเดียว" },
  receipt: { title: "ใบเสร็จรับเงิน", english: "RECEIPT", prefix: "RC", intro: "ปิดการรับชำระด้วยใบเสร็จที่พร้อมส่งให้ลูกค้า" },
  "delivery-note": { title: "ใบส่งของ", english: "DELIVERY NOTE", prefix: "DN", intro: "จัดทำเอกสารแนบการส่งมอบสินค้าให้ครบถ้วน" },
  "tax-invoice": { title: "ใบกำกับภาษี", english: "TAX INVOICE", prefix: "TI", intro: "จัดรูปแบบใบกำกับภาษีเพื่อช่วยเตรียมเอกสารธุรกิจ" },
};

function todayISO() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function nextDateISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function makeDocumentNumber(kind: DocumentKind) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${documentMeta[kind].prefix}-${year}${month}-001`;
}

export function createInitialDocument(kind: DocumentKind): BusinessDocument {
  return {
    kind,
    documentNumber: makeDocumentNumber(kind),
    issueDate: todayISO(),
    dueDate: nextDateISO(kind === "quotation" ? 30 : 7),
    company: { name: "", address: "", taxId: "", phone: "", email: "", logoUrl: "" },
    customer: { name: "", address: "", taxId: "", contact: "" },
    items: [{ id: crypto.randomUUID(), name: "สินค้า / บริการ", description: "", quantity: 1, unit: "รายการ", unitPrice: 0 }],
    discount: 0,
    vatRate: 7,
    vatMode: "excluded",
    note: "ขอบพระคุณที่ไว้วางใจใช้บริการ",
    signerName: "",
    signatureUrl: "",
    stampUrl: "",
    stampPosition: { ...defaultStampPosition },
    stampScale: defaultStampScale,
    watermark: false,
  };
}

export function convertDocument(document: BusinessDocument, targetKind: DocumentKind): BusinessDocument {
  return {
    ...document,
    kind: targetKind,
    documentNumber: makeDocumentNumber(targetKind),
    company: { ...document.company },
    customer: { ...document.customer },
    items: document.items.map((item) => ({ ...item })),
  };
}

export function restoreDocument(payload: string, activeKind: DocumentKind): BusinessDocument {
  const document = JSON.parse(payload) as BusinessDocument;
  return {
    ...document,
    kind: activeKind,
    signerName: document.signerName || "",
    signatureUrl: document.signatureUrl || "",
    stampUrl: document.stampUrl || "",
    stampPosition: boundedStampPosition(document.stampPosition || defaultStampPosition),
    stampScale: boundedStampScale(document.stampScale || defaultStampScale),
    company: { ...document.company },
    customer: { ...document.customer },
    items: document.items.map((item) => ({ ...item })),
  };
}

export function calculateDocumentTotals(document: BusinessDocument) {
  const subtotal = document.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const discount = Math.max(0, Math.min(Number(document.discount) || 0, subtotal));
  const base = subtotal - discount;
  if (document.vatMode === "none") return { subtotal, discount, beforeVat: base, vat: 0, total: base };
  if (document.vatMode === "included") {
    const vat = base * (Number(document.vatRate) || 0) / (100 + (Number(document.vatRate) || 0));
    return { subtotal, discount, beforeVat: base - vat, vat, total: base };
  }
  const vat = base * (Number(document.vatRate) || 0) / 100;
  return { subtotal, discount, beforeVat: base, vat, total: base + vat };
}

export function formatTHB(value: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

export function formatThaiDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function amountToThaiWords(amount: number) {
  const value = Math.round((Number(amount) || 0) * 100);
  if (value === 0) return "ศูนย์บาทถ้วน";
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const places = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  const toWords = (number: number) => {
    if (number === 0) return "";
    let text = "";
    const stringNumber = String(number);
    for (let index = 0; index < stringNumber.length; index += 1) {
      const digit = Number(stringNumber[index]);
      const position = stringNumber.length - index - 1;
      if (digit === 0) continue;
      if (position === 1 && digit === 1) text += "สิบ";
      else if (position === 1 && digit === 2) text += "ยี่สิบ";
      else if (position === 0 && digit === 1 && stringNumber.length > 1) text += "เอ็ด";
      else text += `${digits[digit]}${places[position]}`;
    }
    return text;
  };
  const baht = Math.floor(value / 100);
  const satang = value % 100;
  return `${toWords(baht)}บาท${satang === 0 ? "ถ้วน" : `${toWords(satang)}สตางค์`}`;
}

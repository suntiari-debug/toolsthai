export const documentTemplates = ["modern", "classic", "minimal"] as const;
export type DocumentTemplate = (typeof documentTemplates)[number];

export const documentFontFamilies = ["sarabun", "noto-sans", "noto-serif"] as const;
export type DocumentFontFamily = (typeof documentFontFamilies)[number];

export const documentFontSizes = ["small", "medium", "large"] as const;
export type DocumentFontSize = (typeof documentFontSizes)[number];

export type DocumentDesignSettings = {
  template: DocumentTemplate;
  accentColor: string;
  fontFamily: DocumentFontFamily;
  fontSize: DocumentFontSize;
};

export const defaultDocumentDesign: DocumentDesignSettings = {
  template: "classic",
  accentColor: "#0d7a75",
  fontFamily: "sarabun",
  fontSize: "medium",
};

export const documentFontChoices: Array<{ id: DocumentFontFamily; title: string; description: string }> = [
  { id: "sarabun", title: "Sarabun", description: "มาตรฐาน อ่านง่าย" },
  { id: "noto-sans", title: "Noto Sans Thai", description: "โมเดิร์นและคมชัด" },
  { id: "noto-serif", title: "Noto Serif Thai", description: "ทางการ มีหัวเชิง" },
];

export const documentFontSizeChoices: Array<{ id: DocumentFontSize; title: string; description: string }> = [
  { id: "small", title: "เล็ก", description: "ประหยัดพื้นที่" },
  { id: "medium", title: "กลาง", description: "สมดุล" },
  { id: "large", title: "ใหญ่", description: "อ่านสบาย" },
];

export const businessDocumentTemplates: Array<DocumentDesignSettings & { id: string; category: string; title: string; description: string }> = [
  { id: "general", category: "ทั่วไป", title: "ธุรกิจทั่วไป", description: "สุภาพ ใช้ได้กับทุกงาน", template: "classic", accentColor: "#0d7a75", fontFamily: "sarabun", fontSize: "medium" },
  { id: "service", category: "บริการ", title: "งานบริการ", description: "ร่วมสมัย เน้นความน่าเชื่อถือ", template: "modern", accentColor: "#2563d9", fontFamily: "noto-sans", fontSize: "medium" },
  { id: "retail", category: "สินค้า", title: "ร้านค้าและค้าปลีก", description: "ชัดเจน ดูรายการง่าย", template: "modern", accentColor: "#d97706", fontFamily: "sarabun", fontSize: "medium" },
  { id: "contractor", category: "รับเหมา", title: "ก่อสร้างและรับเหมา", description: "ตัวอักษรใหญ่ ดูหน้างานง่าย", template: "classic", accentColor: "#17191c", fontFamily: "noto-sans", fontSize: "large" },
  { id: "professional", category: "วิชาชีพ", title: "สำนักงานวิชาชีพ", description: "เรียบทางการ สำหรับลูกค้าองค์กร", template: "minimal", accentColor: "#7c3aed", fontFamily: "noto-serif", fontSize: "medium" },
];

export function normalizeDocumentTemplate(value: unknown): DocumentTemplate {
  return documentTemplates.includes(value as DocumentTemplate) ? value as DocumentTemplate : defaultDocumentDesign.template;
}

export function normalizeDocumentFontFamily(value: unknown): DocumentFontFamily {
  return documentFontFamilies.includes(value as DocumentFontFamily) ? value as DocumentFontFamily : defaultDocumentDesign.fontFamily;
}

export function normalizeDocumentFontSize(value: unknown): DocumentFontSize {
  return documentFontSizes.includes(value as DocumentFontSize) ? value as DocumentFontSize : defaultDocumentDesign.fontSize;
}

export function normalizeDocumentAccentColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : defaultDocumentDesign.accentColor;
}

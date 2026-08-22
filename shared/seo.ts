export type DocumentSeoKind = "quotation" | "invoice";

export type DocumentSeoProfile = {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  howToTitle: string;
  steps: string[];
  checklistTitle: string;
  checklist: string[];
  faqs: { question: string; answer: string }[];
  related: { href: string; label: string; description: string }[];
};

export type SsrHead = {
  title: string;
  description: string;
  canonicalPath: string;
  jsonLd: unknown[];
};

export type HomeSeoProfile = {
  path: "/";
  title: string;
  description: string;
  h1: string;
  intro: string;
};

export const SITE_NAME = "Tools Thai";
export const CANONICAL_ORIGIN = "https://toolsthai-gzgjhprz.manus.space";

export const homeSeo: HomeSeoProfile = {
  path: "/",
  title: "Tools Thai: สร้างใบเสนอราคา ใบแจ้งหนี้ และเอกสารธุรกิจออนไลน์ฟรี",
  description: "สร้างใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จรับเงิน ใบกำกับภาษี และใบส่งของออนไลน์ฟรี พร้อมดาวน์โหลด PDF ภาษาไทย และเครื่องคำนวณธุรกิจสำหรับ SME ไทย",
  h1: "สร้างเอกสารธุรกิจออนไลน์ฟรี สำหรับธุรกิจไทย",
  intro: "ออกใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จรับเงิน และคำนวณต้นทุนได้จากที่เดียว พร้อม PDF ภาษาไทย ไม่ต้องสมัคร",
};

export const documentSeo: Record<DocumentSeoKind, DocumentSeoProfile> = {
  quotation: {
    path: "/quotation",
    title: "สร้างใบเสนอราคาออนไลน์ฟรี ไม่ต้องสมัคร — PDF พร้อมโลโก้ | Tools Thai",
    description: "สร้างใบเสนอราคาออนไลน์ได้ฟรี ไม่ต้องสมัครสมาชิก ใส่ข้อมูลบริษัท โลโก้ รายการสินค้า ส่วนลด และ VAT แล้วดาวน์โหลด PDF ภาษาไทยได้ทันที",
    h1: "สร้างใบเสนอราคาออนไลน์ฟรี ไม่ต้องสมัคร",
    intro: "จัดทำใบเสนอราคาที่ดูเป็นมืออาชีพ ใส่โลโก้ รายการสินค้า ส่วนลด และ VAT ได้ครบ แล้วดาวน์โหลด PDF ภาษาไทยได้ทันที",
    howToTitle: "สร้างใบเสนอราคา PDF ฟรีใน 4 ขั้นตอน",
    steps: ["กรอกเลขที่เอกสาร วันที่ และข้อมูลบริษัทหรือร้านค้าของคุณ", "ระบุชื่อลูกค้า รายการสินค้า/บริการ จำนวน และราคาต่อหน่วย", "เลือกรูปแบบ VAT เพิ่มส่วนลด หมายเหตุ และลายน้ำได้ตามต้องการ", "ตรวจตัวอย่างเอกสาร แล้วดาวน์โหลด PDF หรือแปลงเป็นใบแจ้งหนี้เมื่อเริ่มวางบิล"],
    checklistTitle: "ใบเสนอราคาที่ดีควรมีอะไรบ้าง",
    checklist: ["ข้อมูลผู้ขายและผู้ซื้อที่ติดต่อได้ชัดเจน", "เลขที่เอกสาร วันที่ออกเอกสาร และวันครบกำหนดชำระ", "รายการสินค้า/บริการ จำนวน หน่วย ราคา ส่วนลด และ VAT", "หมายเหตุ เงื่อนไขงาน หรือข้อกำหนดการชำระเงินที่ผู้รับเอกสารเข้าใจตรงกัน"],
    faqs: [
      { question: "สร้างใบเสนอราคาต้องสมัครสมาชิกไหม?", answer: "ไม่ต้องสมัครสมาชิกสำหรับการสร้างเอกสารพื้นฐานและดาวน์โหลด PDF การเข้าสู่ระบบใช้เฉพาะกรณีที่ต้องการบันทึก template บริษัทหรือเก็บประวัติเอกสาร" },
      { question: "ใส่โลโก้บริษัทในใบเสนอราคาได้ไหม?", answer: "ได้ คุณสามารถอัปโหลดโลโก้ PNG, JPG หรือ WEBP เพื่อแสดงในหัวเอกสารก่อนดาวน์โหลด PDF" },
      { question: "ใบเสนอราคาแปลงเป็นใบแจ้งหนี้ได้ไหม?", answer: "ได้ ปุ่มทำเอกสารต่อเนื่องจะนำข้อมูลบริษัท ลูกค้า และรายการเดิมไปสร้างใบแจ้งหนี้ เพื่อลดการกรอกข้อมูลซ้ำ" },
      { question: "คำนวณ VAT และส่วนลดในใบเสนอราคาได้หรือไม่?", answer: "ได้ เลือกได้ทั้งแยก VAT รวม VAT แล้ว หรือไม่มี VAT พร้อมเพิ่มส่วนลดเป็นจำนวนเงินบาท" },
    ],
    related: [
      { href: "/invoice", label: "สร้างใบแจ้งหนี้จากใบเสนอราคา", description: "นำข้อมูลเดิมไปวางบิลต่อได้ทันที" },
      { href: "/pricing-calculator", label: "คำนวณต้นทุนและราคาขาย", description: "ตรวจราคาและกำไรก่อนออกใบเสนอราคา" },
      { href: "/vat-calculator", label: "คำนวณ VAT ออนไลน์", description: "ตรวจยอดก่อนหรือหลัง VAT 7%" },
    ],
  },
  invoice: {
    path: "/invoice",
    title: "สร้างใบแจ้งหนี้ออนไลน์ฟรี ไม่ต้องสมัคร — PDF และใบวางบิล | Tools Thai",
    description: "สร้างใบแจ้งหนี้หรือใบวางบิลออนไลน์ฟรี ไม่ต้องสมัคร ใส่ข้อมูลบริษัท ลูกค้า รายการสินค้า VAT และดาวน์โหลด PDF ได้ทันที หรือแปลงจากใบเสนอราคา",
    h1: "สร้างใบแจ้งหนี้และใบวางบิลออนไลน์ฟรี",
    intro: "ออกใบแจ้งหนี้หรือใบวางบิลจากข้อมูลของคุณได้ทันที ใส่เครดิตเทอม VAT และดาวน์โหลด PDF ภาษาไทยโดยไม่ต้องสมัครสมาชิก",
    howToTitle: "สร้างใบแจ้งหนี้ PDF ฟรีใน 4 ขั้นตอน",
    steps: ["กรอกเลขที่เอกสาร วันที่ออก และวันครบกำหนดชำระ", "ใส่ข้อมูลบริษัท ลูกค้า และรายละเอียดสินค้า/บริการที่เรียกเก็บเงิน", "กำหนดส่วนลด รูปแบบ VAT และหมายเหตุหรือเงื่อนไขการชำระเงิน", "ตรวจตัวอย่างใบแจ้งหนี้ แล้วดาวน์โหลด PDF หรือสร้างใบเสร็จรับเงินหลังรับชำระ"],
    checklistTitle: "ข้อมูลสำคัญในใบแจ้งหนี้หรือใบวางบิล",
    checklist: ["เลขที่ใบแจ้งหนี้ วันที่ออกเอกสาร และวันครบกำหนดชำระ", "ข้อมูลผู้ขาย ผู้ซื้อ และช่องทางติดต่อที่ตรวจสอบได้", "รายการที่เรียกเก็บ จำนวน ราคา ส่วนลด ภาษีมูลค่าเพิ่ม และยอดรวม", "เงื่อนไขการชำระเงินหรือเครดิตเทอมที่ตกลงกับลูกค้า"],
    faqs: [
      { question: "สร้างใบแจ้งหนี้ต้องสมัครสมาชิกไหม?", answer: "ไม่ต้องสมัครสมาชิกสำหรับเครื่องมือพื้นฐาน คุณสามารถสร้างและดาวน์โหลด PDF ได้ทันที การเข้าสู่ระบบจำเป็นเฉพาะการบันทึกข้อมูลไว้ใช้ซ้ำ" },
      { question: "ใบแจ้งหนี้ต่างจากใบวางบิลอย่างไร?", answer: "ใบแจ้งหนี้ใช้แจ้งยอดที่ต้องชำระ ส่วนใบวางบิลมักใช้เรียกเก็บเงินตามรอบวางบิลจริง เอกสารควรระบุชื่อและเงื่อนไขให้ตรงกับข้อตกลงของคู่ค้า" },
      { question: "แปลงใบเสนอราคาเป็นใบแจ้งหนี้ได้ไหม?", answer: "ได้ หากเริ่มจากใบเสนอราคาใน Tools Thai คุณสามารถนำข้อมูลบริษัท ลูกค้า และรายการเดิมมาสร้างใบแจ้งหนี้ต่อเนื่องได้" },
      { question: "ตั้งวันครบกำหนดชำระในใบแจ้งหนี้ได้หรือไม่?", answer: "ได้ คุณสามารถกำหนดวันครบกำหนดชำระตามเครดิตเทอมที่ตกลงกับลูกค้า และตรวจวันด้วยเครื่องคำนวณเครดิตเทอมของ Tools Thai" },
    ],
    related: [
      { href: "/quotation", label: "สร้างใบเสนอราคาออนไลน์", description: "เริ่มด้วยข้อเสนอราคาแล้วแปลงเป็นใบแจ้งหนี้" },
      { href: "/receipt", label: "สร้างใบเสร็จรับเงิน", description: "ออกเอกสารปิดการรับชำระเงิน" },
      { href: "/payment-terms", label: "คำนวณวันครบกำหนดชำระ", description: "ตรวจเครดิตเทอมก่อนออกใบแจ้งหนี้" },
    ],
  },
};

function structuredData(kind: DocumentSeoKind): unknown[] {
  const page = documentSeo[kind];
  return [
    { "@context": "https://schema.org", "@type": "WebApplication", name: page.h1, applicationCategory: "BusinessApplication", operatingSystem: "Web", isAccessibleForFree: true, description: page.description, offers: { "@type": "Offer", price: "0", priceCurrency: "THB" } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Tools Thai", item: CANONICAL_ORIGIN }, { "@type": "ListItem", position: 2, name: "เครื่องมือทั้งหมด", item: `${CANONICAL_ORIGIN}/tools` }, { "@type": "ListItem", position: 3, name: page.h1, item: `${CANONICAL_ORIGIN}${page.path}` }] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: page.faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) },
  ];
}

function homeStructuredData(): unknown[] {
  return [{ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: CANONICAL_ORIGIN, inLanguage: "th-TH" }];
}

export function getDocumentSeo(kind: string) { return kind === "quotation" || kind === "invoice" ? documentSeo[kind] : undefined; }
export function getDocumentStructuredData(kind: string) { return kind === "quotation" || kind === "invoice" ? structuredData(kind) : undefined; }
export function getSeoHead(path: string): SsrHead {
  if (path === homeSeo.path) return { title: homeSeo.title, description: homeSeo.description, canonicalPath: homeSeo.path, jsonLd: homeStructuredData() };
  const kind = path.replace(/^\//, "") as DocumentSeoKind;
  const page = getDocumentSeo(kind);
  if (!page) throw new Error(`Unsupported SEO SSR route: ${path}`);
  return { title: page.title, description: page.description, canonicalPath: page.path, jsonLd: structuredData(kind) };
}

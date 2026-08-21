import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Download, FileDown, FilePlus2, Info, Plus, Save, ShieldCheck, Trash2, Upload, WandSparkles } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import DocumentPreview from "@/components/DocumentPreview";
import DocumentSeoContent from "@/components/DocumentSeoContent";
import { BusinessDocument, DocumentKind, LineItem, calculateDocumentTotals, convertDocument, createInitialDocument, documentMeta, formatTHB, makeDocumentNumber, restoreDocument } from "@/lib/document";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import SeoMeta from "@/components/SeoMeta";
import { getDocumentSeo, getDocumentStructuredData } from "@shared/seo";

type DocumentToolProps = { kind: DocumentKind };

const convertTargets: Record<DocumentKind, DocumentKind[]> = {
  quotation: ["invoice", "receipt", "delivery-note"],
  invoice: ["receipt", "delivery-note"],
  receipt: ["delivery-note"],
  "delivery-note": ["invoice", "receipt"],
  "tax-invoice": ["receipt", "delivery-note"],
};

export default function DocumentTool({ kind }: DocumentToolProps) {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [document, setDocument] = useState<BusinessDocument>(() => createInitialDocument(kind));
  const [notice, setNotice] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const profileQuery = trpc.companyProfile.get.useQuery(undefined, { enabled: isAuthenticated });
  const flashNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  };
  const saveDocument = trpc.documents.save.useMutation({
    onSuccess: () => flashNotice("บันทึกเอกสารเข้าบัญชีของคุณแล้ว"),
    onError: () => flashNotice("ไม่สามารถบันทึกเอกสารได้ กรุณาลองใหม่อีกครั้ง"),
  });
  const meta = documentMeta[kind];
  const seo = getDocumentSeo(kind);
  const totals = useMemo(() => calculateDocumentTotals(document), [document]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem("toolsThai.convertedDocument");
    if (saved) {
      try {
        setDocument(restoreDocument(saved, kind));
        window.sessionStorage.removeItem("toolsThai.convertedDocument");
        return;
      } catch {
        window.sessionStorage.removeItem("toolsThai.convertedDocument");
      }
    }
    setDocument(createInitialDocument(kind));
  }, [kind]);

  const updateDocument = <K extends keyof BusinessDocument>(key: K, value: BusinessDocument[K]) => setDocument((current) => ({ ...current, [key]: value }));
  const updateParty = (party: "company" | "customer", key: string, value: string) => setDocument((current) => ({ ...current, [party]: { ...current[party], [key]: value } }));
  const updateItem = (id: string, key: keyof LineItem, value: string | number) => setDocument((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, [key]: value } : item) }));
  const addItem = () => setDocument((current) => ({ ...current, items: [...current.items, { id: crypto.randomUUID(), name: "สินค้า / บริการ", description: "", quantity: 1, unit: "รายการ", unitPrice: 0 }] }));
  const removeItem = (id: string) => setDocument((current) => current.items.length === 1 ? current : { ...current, items: current.items.filter((item) => item.id !== id) });

  const handleLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    updateParty("company", "logoUrl", URL.createObjectURL(file));
  };

  const handlePdfExport = async () => {
    const printable = window.document.getElementById("printable-document");
    if (!printable || isExporting) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(printable, {
        backgroundColor: "#ffffff",
        scale: 2.5,
        useCORS: true,
        logging: false,
        windowWidth: printable.scrollWidth,
      });
      const imageData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageWidth = 210;
      const pageHeight = 297;
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imageHeight;
      let position = 0;
      pdf.addImage(imageData, "JPEG", 0, position, pageWidth, imageHeight, undefined, "FAST");
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imageHeight;
        pdf.addPage();
        pdf.addImage(imageData, "JPEG", 0, position, pageWidth, imageHeight, undefined, "FAST");
        heightLeft -= pageHeight;
      }
      pdf.save(`${document.documentNumber || documentMeta[kind].prefix}.pdf`);
    } catch {
      flashNotice("ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsExporting(false);
    }
  };
  const handleConvert = (target: DocumentKind) => {
    window.sessionStorage.setItem("toolsThai.convertedDocument", JSON.stringify(convertDocument(document, target)));
    setLocation(`/${target}`);
  };
  const handleDraft = () => {
    window.localStorage.setItem("toolsThai.localDraft", JSON.stringify(document));
    flashNotice("บันทึกฉบับร่างไว้ในอุปกรณ์นี้แล้ว");
  };
  const applySavedCompany = () => {
    const profile = profileQuery.data;
    if (!profile) return;
    setDocument((current) => ({ ...current, company: { name: profile.name, address: profile.address || "", taxId: profile.taxId || "", phone: profile.phone || "", email: profile.email || "", logoUrl: profile.logoUrl || "" } }));
  };
  const handleAccountSave = () => {
    if (!isAuthenticated) { startLogin(); return; }
    const profileLogo = profileQuery.data?.logoUrl || "";
    const persistable = { ...document, company: { ...document.company, logoUrl: document.company.logoUrl.startsWith("blob:") ? profileLogo : document.company.logoUrl } };
    saveDocument.mutate({ kind: document.kind, documentNumber: document.documentNumber || makeDocumentNumber(kind), customerName: document.customer.name || undefined, payload: JSON.stringify(persistable) });
  };

  return (
    <div className="app-page document-tool-page">
      <SeoMeta title={seo?.title || `${meta.title} ออนไลน์ฟรี`} description={seo?.description || `${meta.intro} สร้างและดาวน์โหลดเป็น PDF ได้ฟรีด้วย Tools Thai`} canonicalPath={seo?.path || `/${kind}`} structuredData={getDocumentStructuredData(kind)} />
      <PublicHeader />
      <main className="document-workspace">
        <div className="shell document-topbar print-hide">
          <div><Link href="/tools" className="back-link"><ArrowLeft size={16} /> เครื่องมือทั้งหมด</Link><p className="page-kicker">DOCUMENT BUILDER</p><h1>{seo?.h1 || meta.title}</h1><p>{seo?.intro || `${meta.intro} ใช้งานฟรีโดยไม่ต้องสมัครสมาชิก`}</p></div>
          <div className="document-top-actions"><button type="button" className="text-icon-button" onClick={handleAccountSave} disabled={saveDocument.isPending}><Save size={16} /> {isAuthenticated ? (saveDocument.isPending ? "กำลังบันทึก..." : "บันทึกเข้าบัญชี") : "เข้าสู่ระบบเพื่อบันทึก"}</button><button type="button" className="button button-primary" onClick={handlePdfExport} disabled={isExporting}><FileDown size={17} /> {isExporting ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}</button></div>
        </div>
        {notice && <div className="draft-toast print-hide"><ShieldCheck size={17} /> {notice}</div>}
        <div className="shell document-grid">
          <section className="document-form-card print-hide">
            <div className="form-intro"><span className="form-step">01</span><div><h2>ข้อมูลเอกสาร</h2><p>กรอกข้อมูลที่ต้องการแสดงบนเอกสาร</p></div></div>
            <div className="form-section">
              <div className="field-grid two-columns"><FormField label="เลขที่เอกสาร"><input value={document.documentNumber} onChange={(event) => updateDocument("documentNumber", event.target.value)} /></FormField><FormField label="วันที่ออกเอกสาร"><input type="date" value={document.issueDate} onChange={(event) => updateDocument("issueDate", event.target.value)} /></FormField></div>
              {kind !== "receipt" && <FormField label="วันครบกำหนดชำระ"><input type="date" value={document.dueDate} onChange={(event) => updateDocument("dueDate", event.target.value)} /></FormField>}
            </div>
            <div className="form-section"><SectionTitle number="02" title="ข้อมูลผู้ขาย / บริษัท" hint="ข้อมูลนี้จะแสดงบริเวณหัวเอกสาร" />
              <div className="logo-upload-row"><div className="logo-preview">{document.company.logoUrl ? <img src={document.company.logoUrl} alt="ตัวอย่างโลโก้" /> : <WandSparkles size={20} />}</div><label className="upload-label"><Upload size={15} /> อัปโหลดโลโก้<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} /></label>{profileQuery.data && <button type="button" className="apply-template-button" onClick={applySavedCompany}>ใช้ template ที่บันทึก</button>}<span>PNG, JPG หรือ WEBP</span></div>
              <div className="field-grid"><FormField label="ชื่อบริษัท / ร้านค้า"><input placeholder="เช่น บริษัท เอ บี ซี จำกัด" value={document.company.name} onChange={(event) => updateParty("company", "name", event.target.value)} /></FormField><FormField label="ที่อยู่"><textarea rows={2} placeholder="เลขที่ อาคาร ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" value={document.company.address} onChange={(event) => updateParty("company", "address", event.target.value)} /></FormField><div className="field-grid two-columns"><FormField label="เลขประจำตัวผู้เสียภาษี"><input value={document.company.taxId} onChange={(event) => updateParty("company", "taxId", event.target.value)} /></FormField><FormField label="โทรศัพท์"><input value={document.company.phone} onChange={(event) => updateParty("company", "phone", event.target.value)} /></FormField></div><FormField label="อีเมล"><input type="email" value={document.company.email} onChange={(event) => updateParty("company", "email", event.target.value)} /></FormField></div>
            </div>
            <div className="form-section"><SectionTitle number="03" title="ข้อมูลลูกค้า" />
              <div className="field-grid"><FormField label="ชื่อลูกค้า / บริษัทลูกค้า"><input value={document.customer.name} onChange={(event) => updateParty("customer", "name", event.target.value)} /></FormField><FormField label="ที่อยู่"><textarea rows={2} value={document.customer.address} onChange={(event) => updateParty("customer", "address", event.target.value)} /></FormField><div className="field-grid two-columns"><FormField label="เลขประจำตัวผู้เสียภาษี"><input value={document.customer.taxId} onChange={(event) => updateParty("customer", "taxId", event.target.value)} /></FormField><FormField label="ผู้ติดต่อ"><input value={document.customer.contact} onChange={(event) => updateParty("customer", "contact", event.target.value)} /></FormField></div></div>
            </div>
            <div className="form-section"><SectionTitle number="04" title="รายการสินค้า / บริการ" />
              <div className="item-editor-list">{document.items.map((item, index) => <div className="item-editor" key={item.id}><div className="item-editor-top"><span>รายการ {index + 1}</span>{document.items.length > 1 && <button type="button" aria-label="ลบรายการ" onClick={() => removeItem(item.id)}><Trash2 size={15} /></button>}</div><div className="field-grid"><FormField label="ชื่อสินค้า / บริการ"><input value={item.name} onChange={(event) => updateItem(item.id, "name", event.target.value)} /></FormField><FormField label="รายละเอียดเพิ่มเติม"><input value={item.description} onChange={(event) => updateItem(item.id, "description", event.target.value)} /></FormField><div className="field-grid three-columns"><FormField label="จำนวน"><input type="number" min="0" value={item.quantity} onChange={(event) => updateItem(item.id, "quantity", Number(event.target.value))} /></FormField><FormField label="หน่วย"><input value={item.unit} onChange={(event) => updateItem(item.id, "unit", event.target.value)} /></FormField><FormField label="ราคาต่อหน่วย"><input type="number" min="0" value={item.unitPrice} onChange={(event) => updateItem(item.id, "unitPrice", Number(event.target.value))} /></FormField></div></div><div className="item-line-total">รวม {formatTHB(item.quantity * item.unitPrice)}</div></div>)}</div>
              <button type="button" className="add-item-button" onClick={addItem}><Plus size={16} /> เพิ่มรายการ</button>
            </div>
            <div className="form-section"><SectionTitle number="05" title="ส่วนลด ภาษี และหมายเหตุ" />
              {kind === "tax-invoice" && <div className="tax-notice"><Info size={15} /><span>เอกสารนี้เป็น template เพื่อช่วยจัดรูปแบบข้อมูล กรุณาตรวจสอบความครบถ้วนของรายการ อัตราภาษี และเงื่อนไขทางกฎหมายกับผู้เชี่ยวชาญก่อนนำไปใช้งานจริง</span></div>}
              <div className="field-grid two-columns"><FormField label="ส่วนลด (บาท)"><input type="number" min="0" value={document.discount} onChange={(event) => updateDocument("discount", Number(event.target.value))} /></FormField><FormField label="รูปแบบ VAT"><select value={document.vatMode} onChange={(event) => updateDocument("vatMode", event.target.value as BusinessDocument["vatMode"])}><option value="excluded">แยก VAT</option><option value="included">รวม VAT แล้ว</option><option value="none">ไม่มี VAT</option></select></FormField></div>
              {document.vatMode !== "none" && <FormField label="อัตรา VAT (%)"><input type="number" min="0" max="100" value={document.vatRate} onChange={(event) => updateDocument("vatRate", Number(event.target.value))} /></FormField>}
              <FormField label="หมายเหตุ"><textarea rows={3} value={document.note} onChange={(event) => updateDocument("note", event.target.value)} /></FormField>
              <label className="watermark-toggle"><input type="checkbox" checked={document.watermark} onChange={(event) => updateDocument("watermark", event.target.checked)} /><span /><div><strong>ใส่ลายน้ำ Tools Thai</strong><small>เพิ่มลายน้ำแบบโปร่งใสในเอกสาร</small></div></label>
            </div>
            <div className="form-summary"><span>ยอดรวมสุทธิ</span><strong>{formatTHB(totals.total)}</strong><small>{document.vatMode !== "none" ? `รวม VAT ${document.vatRate}% แล้ว` : "ไม่คิด VAT"}</small></div>
            <div className="mobile-preview-action"><button type="button" className="button button-ink" onClick={handlePdfExport} disabled={isExporting}><FileDown size={16} /> {isExporting ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}</button></div>
          </section>
          <aside className="document-preview-column">
            <div className="preview-toolbar print-hide"><span><Info size={15} /> ตัวอย่างเอกสาร</span><div><button type="button" onClick={handlePdfExport} disabled={isExporting}><Download size={15} /> {isExporting ? "กำลังสร้าง" : "PDF"}</button></div></div>
            <div className="preview-paper-wrap" tabIndex={0} aria-label="ตัวอย่างเอกสาร สามารถเลื่อนดูเอกสารด้วยแป้นพิมพ์ได้"><DocumentPreview document={document} /></div>
            <div className="convert-card print-hide"><div><FilePlus2 size={20} /><span><strong>ทำเอกสารต่อเนื่อง</strong><small>นำข้อมูลชุดนี้ไปสร้างเอกสารถัดไปได้ทันที</small></span></div><div className="convert-buttons">{convertTargets[kind].map((target) => <button type="button" key={target} onClick={() => handleConvert(target)}>{documentMeta[target].title}<ArrowRight size={14} /></button>)}</div></div>
          </aside>
        </div>
        <DocumentSeoContent kind={kind} />
      </main>
      <PublicFooter />
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="form-field"><span>{label}</span>{children}</label>; }
function SectionTitle({ number, title, hint }: { number: string; title: string; hint?: string }) { return <div className="section-title"><span>{number}</span><div><h3>{title}</h3>{hint && <p>{hint}</p>}</div></div>; }

import { ChangeEvent, TouchEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Download, FileDown, FilePlus2, Info, Plus, Printer, RotateCcw, Save, ShieldCheck, Trash2, Upload, WandSparkles, ZoomIn, ZoomOut } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import DocumentPreview from "@/components/DocumentPreview";
import DocumentSeoContent from "@/components/DocumentSeoContent";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BusinessDocument, DocumentKind, LineItem, calculateDocumentTotals, convertDocument, createInitialDocument, documentMeta, formatTHB, makeDocumentNumber, restoreDocument } from "@/lib/document";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import SeoMeta from "@/components/SeoMeta";
import { getDocumentSeo, getDocumentStructuredData } from "@shared/seo";
import { validateDocumentAssetFile } from "@/lib/documentAssets";
import "../styles/document-typography.css";
import { boundedPreviewZoom, clampPreviewPan, getAllPreviewZoomStorageKeys, getLegacyPreviewZoomStorageKey, getPreviewScrollIndicator, getPreviewZoomDevice, getPreviewZoomStorageKey, isDoubleTap, parseStoredPreviewZoom, pinchZoomStep, PreviewPan, PreviewZoom, PreviewZoomDevice, TapPoint } from "@/lib/previewZoom";

type DocumentToolProps = { kind: DocumentKind };
type DocumentTemplate = "modern" | "classic" | "minimal";

const convertTargets: Record<DocumentKind, DocumentKind[]> = {
  quotation: ["invoice", "receipt", "delivery-note"],
  invoice: ["receipt", "delivery-note"],
  receipt: ["delivery-note"],
  "delivery-note": ["invoice", "receipt"],
  "tax-invoice": ["receipt", "delivery-note"],
};

const templateChoices: Array<{ id: DocumentTemplate; title: string; description: string }> = [
  { id: "modern", title: "Modern", description: "โทนร่วมสมัย อ่านง่าย" },
  { id: "classic", title: "Classic", description: "หัวตารางสีดำ เรียบทางการ" },
  { id: "minimal", title: "Minimal", description: "ขาวสะอาด ใช้เส้นบาง" },
];

const accentChoices = ["#0d7a75", "#2563d9", "#bd1f2d", "#7c3aed", "#17191c", "#d97706"];

export default function DocumentTool({ kind }: DocumentToolProps) {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [document, setDocument] = useState<BusinessDocument>(() => createInitialDocument(kind));
  const [notice, setNotice] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [template, setTemplate] = useState<DocumentTemplate>("classic");
  const [accentColor, setAccentColor] = useState("#0d7a75");
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>(0);
  const [previewPan, setPreviewPan] = useState<PreviewPan>({ x: 0, y: 0 });
  const [isPreviewZoomRestored, setIsPreviewZoomRestored] = useState(false);
  const [isPreviewResetAnimating, setIsPreviewResetAnimating] = useState(false);
  const [previewZoomDevice, setPreviewZoomDevice] = useState<PreviewZoomDevice>(() => typeof window === "undefined" ? "desktop" : getPreviewZoomDevice(window.innerWidth));
  const pinchState = useRef<{ distance: number; zoom: PreviewZoom } | null>(null);
  const panState = useRef<{ clientX: number; clientY: number; pan: PreviewPan } | null>(null);
  const singleTouchState = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastTap = useRef<TapPoint | null>(null);
  const skipPreviewZoomPersistence = useRef<string | null>(null);
  const previewResetAnimationTimer = useRef<number | null>(null);
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
  const previewZoomLabel = previewZoom === -1 ? "90%" : previewZoom === 1 ? "110%" : "100%";
  const previewHint = previewZoom === 1 ? "ลากหนึ่งนิ้วเพื่อเลื่อน · แตะสองครั้งเพื่อรีเซ็ต" : "ถ่างหรือหุบนิ้วสองนิ้วเพื่อซูม · แตะสองครั้งเพื่อรีเซ็ต";
  const previewScrollIndicator = previewZoom === 1 ? getPreviewScrollIndicator(previewPan.y, 188) : null;
  const previewZoomStorageKey = getPreviewZoomStorageKey(kind, previewZoomDevice);
  const updatePreviewZoom = (value: number) => setPreviewZoom(boundedPreviewZoom(value));
  useEffect(() => {
    const syncPreviewZoomDevice = () => setPreviewZoomDevice(getPreviewZoomDevice(window.innerWidth));
    syncPreviewZoomDevice();
    window.addEventListener("resize", syncPreviewZoomDevice);
    return () => window.removeEventListener("resize", syncPreviewZoomDevice);
  }, []);
  useEffect(() => {
    setIsPreviewZoomRestored(false);
    try {
      skipPreviewZoomPersistence.current = previewZoomStorageKey;
      const storedZoom = window.localStorage.getItem(previewZoomStorageKey);
      const legacyZoom = storedZoom === null ? window.localStorage.getItem(getLegacyPreviewZoomStorageKey(kind)) : null;
      if (storedZoom === null && legacyZoom !== null) window.localStorage.setItem(previewZoomStorageKey, legacyZoom);
      setPreviewZoom(parseStoredPreviewZoom(storedZoom ?? legacyZoom));
    } catch {
      setPreviewZoom(0);
    } finally {
      setIsPreviewZoomRestored(true);
    }
  }, [kind, previewZoomStorageKey]);
  useEffect(() => {
    if (!isPreviewZoomRestored) return;
    if (skipPreviewZoomPersistence.current === previewZoomStorageKey) {
      skipPreviewZoomPersistence.current = null;
      return;
    }
    try {
      window.localStorage.setItem(previewZoomStorageKey, String(previewZoom));
    } catch {
      // The preview remains usable if browser storage is blocked.
    }
  }, [isPreviewZoomRestored, previewZoom, previewZoomStorageKey]);
  const resetPreviewView = () => {
    if (previewResetAnimationTimer.current !== null) window.clearTimeout(previewResetAnimationTimer.current);
    setIsPreviewResetAnimating(true);
    setPreviewZoom(0);
    setPreviewPan({ x: 0, y: 0 });
    previewResetAnimationTimer.current = window.setTimeout(() => {
      setIsPreviewResetAnimating(false);
      previewResetAnimationTimer.current = null;
    }, 280);
  };
  useEffect(() => () => { if (previewResetAnimationTimer.current !== null) window.clearTimeout(previewResetAnimationTimer.current); }, []);
  const resetSavedPreviewZoom = () => {
    try {
      skipPreviewZoomPersistence.current = previewZoomStorageKey;
      window.localStorage.removeItem(previewZoomStorageKey);
    } catch {
      // Resetting the current view still works if browser storage is blocked.
    }
    resetPreviewView();
    flashNotice(`รีเซ็ตค่าซูมที่จำไว้ของ${meta.title}บน${previewZoomDevice === "mobile" ? "มือถือ" : "คอมพิวเตอร์"}แล้ว`);
  };
  const resetAllSavedPreviewZooms = () => {
    try {
      skipPreviewZoomPersistence.current = previewZoomStorageKey;
      getAllPreviewZoomStorageKeys(previewZoomDevice).forEach((storageKey) => window.localStorage.removeItem(storageKey));
    } catch {
      // Resetting the current view still works if browser storage is blocked.
    }
    resetPreviewView();
    flashNotice(`ล้างค่าซูมของเอกสารทุกประเภทบน${previewZoomDevice === "mobile" ? "มือถือ" : "คอมพิวเตอร์"}เครื่องนี้แล้ว`);
  };
  useEffect(() => { if (previewZoom !== 1) setPreviewPan({ x: 0, y: 0 }); }, [previewZoom]);
  const handlePreviewTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      panState.current = null;
      singleTouchState.current = null;
      pinchState.current = { distance: getTouchDistance(event.touches), zoom: previewZoom };
      return;
    }
    if (event.touches.length === 1 && previewZoom === 1) {
      pinchState.current = null;
      panState.current = { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY, pan: previewPan };
      singleTouchState.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, moved: false };
      return;
    }
    if (event.touches.length === 1) singleTouchState.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, moved: false };
    pinchState.current = null;
    panState.current = null;
  };
  const handlePreviewTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2 && pinchState.current) {
      event.preventDefault();
      const nextZoom = pinchZoomStep(pinchState.current.distance, getTouchDistance(event.touches), pinchState.current.zoom);
      if (nextZoom !== previewZoom) {
        setPreviewZoom(nextZoom);
        pinchState.current = { distance: getTouchDistance(event.touches), zoom: nextZoom };
      }
      return;
    }
    if (event.touches.length === 1 && panState.current && previewZoom === 1) {
      event.preventDefault();
      if (singleTouchState.current && Math.hypot(event.touches[0].clientX - singleTouchState.current.x, event.touches[0].clientY - singleTouchState.current.y) > 8) singleTouchState.current.moved = true;
      const nextPan = clampPreviewPan({ x: panState.current.pan.x + event.touches[0].clientX - panState.current.clientX, y: panState.current.pan.y + event.touches[0].clientY - panState.current.clientY }, { x: 72, y: 188 });
      setPreviewPan(nextPan);
    }
  };
  const handlePreviewTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touch = singleTouchState.current;
    if (event.touches.length === 0 && touch && !touch.moved) {
      const currentTap = { x: touch.x, y: touch.y, timestamp: Date.now() };
      if (isDoubleTap(lastTap.current, currentTap)) {
        resetPreviewView();
        lastTap.current = null;
      } else {
        lastTap.current = currentTap;
      }
    }
    pinchState.current = null;
    panState.current = null;
    singleTouchState.current = null;
  };
  const clearPreviewTouch = () => { pinchState.current = null; panState.current = null; singleTouchState.current = null; };

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
    if (!file || !file.type.startsWith("image/")) return;
    updateParty("company", "logoUrl", URL.createObjectURL(file));
  };
  const handleDocumentAsset = (event: ChangeEvent<HTMLInputElement>, field: "signatureUrl" | "stampUrl", label: string) => {
    const file = event.target.files?.[0];
    const validation = validateDocumentAssetFile(file, label);
    if (!validation.valid) { flashNotice(validation.message); return; }
    if (!file) return;
    updateDocument(field, URL.createObjectURL(file));
    event.target.value = "";
  };

  const handlePdfExport = async () => {
    const printable = window.document.getElementById("printable-document");
    if (!printable || isExporting) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(printable, { backgroundColor: "#ffffff", scale: 2.5, useCORS: true, logging: false, windowWidth: printable.scrollWidth });
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
  const handleReset = () => {
    setDocument(createInitialDocument(kind));
    flashNotice("รีเซ็ตแบบฟอร์มเป็นข้อมูลเริ่มต้นแล้ว");
  };
  const applySavedCompany = () => {
    const profile = profileQuery.data;
    if (!profile) return;
    setDocument((current) => ({ ...current, company: { name: profile.name, address: profile.address || "", taxId: profile.taxId || "", phone: profile.phone || "", email: profile.email || "", logoUrl: profile.logoUrl || "" }, signatureUrl: profile.signatureUrl || "", stampUrl: profile.stampUrl || "" }));
  };
  const handleAccountSave = () => {
    if (!isAuthenticated) { startLogin(); return; }
    const profileLogo = profileQuery.data?.logoUrl || "";
    const persistable = { ...document, company: { ...document.company, logoUrl: document.company.logoUrl.startsWith("blob:") ? profileLogo : document.company.logoUrl }, signatureUrl: document.signatureUrl?.startsWith("blob:") ? profileQuery.data?.signatureUrl || "" : document.signatureUrl, stampUrl: document.stampUrl?.startsWith("blob:") ? profileQuery.data?.stampUrl || "" : document.stampUrl };
    saveDocument.mutate({ kind: document.kind, documentNumber: document.documentNumber || makeDocumentNumber(kind), customerName: document.customer.name || undefined, payload: JSON.stringify(persistable) });
  };

  return (
    <div className="app-page document-tool-page">
      <SeoMeta title={seo?.title || `${meta.title} ออนไลน์ฟรี`} description={seo?.description || `${meta.intro} สร้างและดาวน์โหลดเป็น PDF ได้ฟรีด้วย Tools Thai`} canonicalPath={seo?.path || `/${kind}`} structuredData={getDocumentStructuredData(kind)} />
      <PublicHeader />
      <main className="document-workspace reference-document-workspace">
        <div className="shell document-topbar reference-topbar print-hide">
          <div className="workspace-context"><Link href="/tools" className="back-link"><ArrowLeft size={16} /> เครื่องมือทั้งหมด</Link><h1 className="sr-only">{seo?.h1 || meta.title}</h1></div>
          <div className="document-top-actions reference-actions">
            <button type="button" className="button button-download" onClick={handlePdfExport} disabled={isExporting}><FileDown size={17} /> {isExporting ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}</button>
            <button type="button" className="workspace-action" onClick={() => window.print()}><Printer size={16} /> พิมพ์</button>
            <button type="button" className="workspace-action text-action" onClick={handleReset}><RotateCcw size={16} /> รีเซ็ต</button>
            <button type="button" className="workspace-action save-action" onClick={handleAccountSave} disabled={saveDocument.isPending}><Save size={16} /> {isAuthenticated ? (saveDocument.isPending ? "กำลังบันทึก" : "บันทึก") : "บันทึก"}</button>
          </div>
          <span className="autosave-status"><span>✓</span> บันทึกอัตโนมัติในอุปกรณ์</span>
        </div>
        {notice && <div className="draft-toast print-hide"><ShieldCheck size={17} /> {notice}</div>}
        <div className="shell document-grid reference-document-grid">
          <section className="document-form-card reference-form-panel print-hide">
            <section className="form-section document-design-section">
              <CardHeading title="ดีไซน์เอกสาร" />
              <p className="design-label">เทมเพลต</p>
              <div className="template-choice-grid">
                {templateChoices.map((choice) => <button type="button" key={choice.id} className={`template-choice ${template === choice.id ? "is-selected" : ""}`} onClick={() => setTemplate(choice.id)}><strong>{choice.title}</strong><small>{choice.description}</small></button>)}
              </div>
              <p className="design-label">สีหลัก</p>
              <div className="accent-picker" aria-label="เลือกสีหลักของเอกสาร">{accentChoices.map((color) => <button type="button" key={color} className={accentColor === color ? "is-selected" : ""} onClick={() => setAccentColor(color)} style={{ backgroundColor: color }} aria-label={`เลือกสี ${color}`} />)}</div>
              <div className="document-assets-row">
                <label className="asset-upload-tile"><span className="asset-preview">{document.company.logoUrl ? <img src={document.company.logoUrl} alt="ตัวอย่างโลโก้" /> : <WandSparkles size={18} />}</span><strong>โลโก้</strong><span><Upload size={13} /> อัปโหลด</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} /></label>
                <label className="asset-upload-tile"><span className="asset-preview">{document.signatureUrl ? <img src={document.signatureUrl} alt="ตัวอย่างลายเซ็น" /> : <WandSparkles size={18} />}</span><strong>ลายเซ็น</strong><span><Upload size={13} /> อัปโหลด</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleDocumentAsset(event, "signatureUrl", "ลายเซ็น")} /></label>
                <label className="asset-upload-tile"><span className="asset-preview">{document.stampUrl ? <img src={document.stampUrl} alt="ตัวอย่างตรายาง" /> : <WandSparkles size={18} />}</span><strong>ตรายาง</strong><span><Upload size={13} /> อัปโหลด</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleDocumentAsset(event, "stampUrl", "ตรายาง")} /></label>
              </div>
              {profileQuery.data && <button type="button" className="apply-template-button" onClick={applySavedCompany}>ใช้ template บริษัทที่บันทึก</button>}
              <p className="design-hint">แนะนำ: ใช้ไฟล์ PNG พื้นหลังโปร่งใสสำหรับลายเซ็นและตรายาง ขนาดไม่เกิน 500 KB เพื่อให้ดูคมชัดใน PDF</p>
            </section>

            <section className="form-section">
              <CardHeading title="ข้อมูลเอกสาร" />
              <div className="field-grid">
                <FormField label="เลขที่เอกสาร"><input value={document.documentNumber} onChange={(event) => updateDocument("documentNumber", event.target.value)} /></FormField>
                <div className="field-grid two-columns keep-on-mobile"><FormField label="วันที่ออก"><input type="date" value={document.issueDate} onChange={(event) => updateDocument("issueDate", event.target.value)} /></FormField>{kind !== "receipt" && <FormField label="กำหนดชำระ / ใช้ได้ถึง"><input type="date" value={document.dueDate} onChange={(event) => updateDocument("dueDate", event.target.value)} /></FormField>}</div>
              </div>
            </section>

            <section className="form-section">
              <CardHeading title="ผู้ขาย / ผู้ออกเอกสาร" />
              <div className="field-grid"><FormField label="ชื่อบริษัท / ร้าน"><input placeholder="เช่น บริษัท เอ บี ซี จำกัด" value={document.company.name} onChange={(event) => updateParty("company", "name", event.target.value)} /></FormField><FormField label="ที่อยู่"><textarea rows={2} placeholder="เลขที่ อาคาร ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" value={document.company.address} onChange={(event) => updateParty("company", "address", event.target.value)} /></FormField><div className="field-grid two-columns keep-on-mobile"><FormField label="เลขผู้เสียภาษี (13 หลัก)"><input value={document.company.taxId} onChange={(event) => updateParty("company", "taxId", event.target.value)} /></FormField><FormField label="โทรศัพท์"><input value={document.company.phone} onChange={(event) => updateParty("company", "phone", event.target.value)} /></FormField></div><FormField label="อีเมล"><input type="email" value={document.company.email} onChange={(event) => updateParty("company", "email", event.target.value)} /></FormField></div>
            </section>

            <section className="form-section">
              <CardHeading title="ลูกค้า / ผู้รับเอกสาร" />
              <div className="field-grid"><FormField label="ชื่อ"><input value={document.customer.name} onChange={(event) => updateParty("customer", "name", event.target.value)} /></FormField><FormField label="ที่อยู่"><textarea rows={2} value={document.customer.address} onChange={(event) => updateParty("customer", "address", event.target.value)} /></FormField><div className="field-grid two-columns keep-on-mobile"><FormField label="เลขผู้เสียภาษี"><input value={document.customer.taxId} onChange={(event) => updateParty("customer", "taxId", event.target.value)} /></FormField><FormField label="ผู้ติดต่อ"><input value={document.customer.contact} onChange={(event) => updateParty("customer", "contact", event.target.value)} /></FormField></div></div>
            </section>

            <section className="form-section items-section">
              <div className="card-heading-row"><CardHeading title="รายการสินค้า / บริการ" /><button type="button" className="add-item-button" onClick={addItem}><Plus size={16} /> เพิ่ม</button></div>
              <div className="item-editor-list">{document.items.map((item, index) => <div className="item-editor" key={item.id}><div className="item-editor-top"><span>รายการที่ {index + 1}</span>{document.items.length > 1 && <button type="button" aria-label="ลบรายการ" onClick={() => removeItem(item.id)}><Trash2 size={15} /></button>}</div><div className="field-grid"><FormField label="รายการสินค้า / บริการ"><textarea rows={2} value={item.name} onChange={(event) => updateItem(item.id, "name", event.target.value)} /></FormField><FormField label="รายละเอียดเพิ่มเติม"><input value={item.description} onChange={(event) => updateItem(item.id, "description", event.target.value)} /></FormField><div className="field-grid two-columns keep-on-mobile"><FormField label="จำนวน"><input type="number" min="0" value={item.quantity} onChange={(event) => updateItem(item.id, "quantity", Number(event.target.value))} /></FormField><FormField label="ราคาต่อหน่วย (บาท)"><input type="number" min="0" value={item.unitPrice} onChange={(event) => updateItem(item.id, "unitPrice", Number(event.target.value))} /></FormField></div><FormField label="หน่วย"><input value={item.unit} onChange={(event) => updateItem(item.id, "unit", event.target.value)} /></FormField></div><div className="item-line-total">รวม {formatTHB(item.quantity * item.unitPrice)}</div></div>)}</div>
            </section>

            <section className="form-section tax-section">
              <CardHeading title="ภาษี" />
              {kind === "tax-invoice" && <div className="tax-notice"><Info size={15} /><span>เอกสารนี้เป็น template เพื่อช่วยจัดรูปแบบข้อมูล กรุณาตรวจสอบความครบถ้วนของรายการ อัตราภาษี และเงื่อนไขทางกฎหมายกับผู้เชี่ยวชาญก่อนนำไปใช้งานจริง</span></div>}
              <label className="tax-toggle-row"><span><strong>คิดภาษีมูลค่าเพิ่ม (VAT)</strong><small>มาตรฐานอยู่ที่ 7%</small></span><input type="checkbox" checked={document.vatMode !== "none"} onChange={(event) => updateDocument("vatMode", event.target.checked ? "excluded" : "none")} /><i /></label>
              {document.vatMode !== "none" && <div className="field-grid two-columns keep-on-mobile vat-input-grid"><FormField label="อัตรา VAT %"><input type="number" min="0" max="100" value={document.vatRate} onChange={(event) => updateDocument("vatRate", Number(event.target.value))} /></FormField><FormField label="รูปแบบ VAT"><select value={document.vatMode} onChange={(event) => updateDocument("vatMode", event.target.value as BusinessDocument["vatMode"])}><option value="excluded">แยก VAT</option><option value="included">รวม VAT แล้ว</option></select></FormField></div>}
              <div className="tax-divider" />
              <div className="tax-static-row"><span><strong>หักภาษี ณ ที่จ่าย</strong><small>เพิ่มข้อมูลในหมายเหตุได้ตามเงื่อนไขของธุรกิจ</small></span><i aria-hidden="true" /></div>
            </section>

            <section className="form-section">
              <CardHeading title="อื่นๆ" />
              <div className="field-grid"><FormField label="หมายเหตุ"><textarea rows={3} value={document.note} onChange={(event) => updateDocument("note", event.target.value)} /></FormField><FormField label="ชื่อผู้มีอำนาจลงนาม"><input value={document.signerName || ""} onChange={(event) => updateDocument("signerName", event.target.value)} /></FormField></div>
              <label className="watermark-toggle"><input type="checkbox" checked={document.watermark} onChange={(event) => updateDocument("watermark", event.target.checked)} /><span /><div><strong>ใส่ลายน้ำ Tools Thai</strong><small>เพิ่มลายน้ำแบบโปร่งใสในเอกสาร</small></div></label>
              <button type="button" className="draft-link" onClick={handleDraft}>บันทึกฉบับร่างไว้ในอุปกรณ์นี้</button>
            </section>
            <div className="form-summary"><span>ยอดรวมสุทธิ</span><strong>{formatTHB(totals.total)}</strong><small>{document.vatMode !== "none" ? `รวม VAT ${document.vatRate}% แล้ว` : "ไม่คิด VAT"}</small></div>
            <div className="mobile-preview-action"><button type="button" className="button button-download" onClick={handlePdfExport} disabled={isExporting}><FileDown size={16} /> {isExporting ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}</button></div>
          </section>

          <aside className="document-preview-column">
            <div className="preview-toolbar print-hide"><span><Info size={15} /> ตัวอย่างเอกสาร</span><div className="preview-toolbar-actions"><div className="preview-zoom-controls" role="group" aria-label="ปรับขนาดตัวอย่างเอกสาร"><button type="button" onClick={() => updatePreviewZoom(previewZoom - 1)} disabled={previewZoom === -1} aria-label="ซูมออก" title="ซูมออก"><ZoomOut size={15} /></button><output className="preview-zoom-percentage" aria-live="polite" aria-label={`ระดับซูมปัจจุบัน ${previewZoomLabel}`}>{previewZoomLabel}</output><button type="button" onClick={() => updatePreviewZoom(previewZoom + 1)} disabled={previewZoom === 1} aria-label="ซูมเข้า" title="ซูมเข้า"><ZoomIn size={15} /></button><button type="button" className="zoom-reset-button" onClick={resetPreviewView} disabled={previewZoom === 0} aria-label="รีเซ็ตขนาดตัวอย่าง" title="รีเซ็ตขนาด"><RotateCcw size={14} /></button></div><AlertDialog><AlertDialogTrigger asChild><button type="button" className="zoom-storage-reset-button" aria-label="ล้างค่าซูมที่จำไว้สำหรับอุปกรณ์นี้" title="ล้างค่าซูมที่จำไว้"><RotateCcw size={14} /> ล้างค่าซูม</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>ล้างค่าซูมที่จำไว้?</AlertDialogTitle><AlertDialogDescription>การดำเนินการนี้จะคืนตัวอย่าง{meta.title}บน{previewZoomDevice === "mobile" ? "มือถือ" : "คอมพิวเตอร์"}เครื่องนี้เป็น 100% โดยไม่กระทบเอกสารหรืออุปกรณ์อื่น</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ยกเลิก</AlertDialogCancel><AlertDialogAction onClick={resetSavedPreviewZoom}>ล้างค่าซูม</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><AlertDialog><AlertDialogTrigger asChild><button type="button" className="zoom-storage-reset-all-button" aria-label="ล้างค่าซูมทุกเอกสารบนอุปกรณ์นี้" title="ล้างค่าซูมทุกเอกสาร"><RotateCcw size={14} /> ล้างทั้งหมด</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>ล้างค่าซูมทุกเอกสาร?</AlertDialogTitle><AlertDialogDescription>การดำเนินการนี้จะล้างค่าซูมที่จำไว้ของเอกสารทุกประเภทบน{previewZoomDevice === "mobile" ? "มือถือ" : "คอมพิวเตอร์"}เครื่องนี้ และคืนตัวอย่างปัจจุบันเป็น 100% โดยไม่กระทบค่าบนอุปกรณ์อื่น</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ยกเลิก</AlertDialogCancel><AlertDialogAction onClick={resetAllSavedPreviewZooms}>ล้างทุกเอกสาร</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><button type="button" onClick={handlePdfExport} disabled={isExporting}><Download size={15} /> {isExporting ? "กำลังสร้าง" : "PDF"}</button></div></div>
            <div className={`preview-paper-wrap ${previewZoom === 1 ? "preview-pan-enabled" : ""} ${isPreviewResetAnimating ? "is-zoom-resetting" : ""}`} tabIndex={0} aria-label="ตัวอย่างเอกสาร รองรับการถ่างหรือหุบนิ้วเพื่อซูมบนมือถือ" onTouchStart={handlePreviewTouchStart} onTouchMove={handlePreviewTouchMove} onTouchEnd={handlePreviewTouchEnd} onTouchCancel={clearPreviewTouch}>{previewScrollIndicator && <div className="document-scroll-indicator print-hide" aria-live="polite"><span>กำลังดู</span><strong>{previewScrollIndicator.section}</strong><div className="scroll-indicator-track" aria-hidden="true"><i style={{ left: `${previewScrollIndicator.progress}%` }} /></div></div>}<span className="pinch-zoom-hint print-hide">{previewHint}</span><DocumentPreview document={document} accentColor={accentColor} template={template} screenZoom={previewZoom} screenPan={previewPan} /></div>
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
function CardHeading({ title }: { title: string }) { return <div className="card-heading"><h2>{title}</h2></div>; }
function getTouchDistance(touches: TouchEvent<HTMLDivElement>["touches"]) { return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY); }

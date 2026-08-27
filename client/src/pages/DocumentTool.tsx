import { ChangeEvent, type CSSProperties, TouchEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Download, Eye, EyeOff, FileDown, FilePlus2, Info, Plus, Printer, RotateCcw, Save, Search, ShieldCheck, Tags, Trash2, Undo2, Upload, WandSparkles, ZoomIn, ZoomOut } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import DocumentPreview from "@/components/DocumentPreview";
import DocumentSeoContent from "@/components/DocumentSeoContent";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BusinessDocument, DocumentKind, LineItem, boundedLogoCrop, boundedLogoPosition, boundedLogoScale, boundedStampPosition, boundedStampRotation, boundedStampScale, calculateDocumentTotals, convertDocument, createHydrationSafeInitialDocument, createInitialDocument, defaultLogoCrop, defaultLogoPosition, defaultLogoScale, defaultStampPosition, defaultStampRotation, defaultStampScale, documentMeta, formatTHB, makeDocumentNumber, restoreDocument } from "@/lib/document";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import SeoMeta from "@/components/SeoMeta";
import { getDocumentSeo, getDocumentStructuredData } from "@shared/seo";
import { isTemporaryDocumentAssetUrl, readDocumentAssetAsDataUrl, validateDocumentAssetFile } from "@/lib/documentAssets";
import { getDocumentValidationIssues } from "@/lib/documentValidation";
import { businessDocumentTemplates, documentFontChoices, documentFontSizeChoices, normalizeDocumentAccentColor, normalizeDocumentFontFamily, normalizeDocumentFontSize, normalizeDocumentTemplate, type DocumentDesignSettings, type DocumentTemplate } from "@/lib/documentDesign";
import { createLogoPresetExport, filterLogoPresets, LEGACY_LOGO_PRESETS_STORAGE_KEY, LOGO_PRESETS_STORAGE_KEY, logoPresetCategories, MAX_LOGO_PRESET_IMPORT_BYTES, MAX_LOGO_PRESETS, mergeLogoPresets, parseLogoPresetImport, parseStoredPreviewHighlight, PREVIEW_HIGHLIGHT_PREFERENCE_STORAGE_KEY, sanitizeLogoPresets, serializeLogoPresets, type LogoPreset, type LogoPresetCategory } from "@/lib/documentPreferences";
import { getItemPreviewHighlightTarget, getPreviewHighlightTarget, type PreviewHighlightTarget } from "@/lib/previewHighlight";
import { sanitizePdfFilename } from "@/lib/pdfExport";
import { parseReceiptSourceContext } from "@/lib/receiptDraft";
import "../styles/document-typography.css";
import { boundedPreviewZoom, clampPreviewPan, getAllPreviewZoomStorageKeys, getLegacyPreviewZoomStorageKey, getPreviewScrollBehavior, getPreviewScrollIndicator, getPreviewZoomDevice, getPreviewZoomStorageKey, isDoubleTap, parseStoredPreviewZoom, pinchZoomStep, PreviewPan, PreviewZoom, PreviewZoomDevice, TapPoint } from "@/lib/previewZoom";

type DocumentToolProps = { kind: DocumentKind };
type RemovedLogo = { logoUrl: string; position: { x: number; y: number }; scale: number; crop: NonNullable<BusinessDocument["logoCrop"]> };
type PdfExportStage = "preparing" | "rendering" | "downloading";

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
  const [document, setDocument] = useState<BusinessDocument>(() => createHydrationSafeInitialDocument(kind));
  const [notice, setNotice] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [pdfExportStage, setPdfExportStage] = useState<PdfExportStage | null>(null);
  const [isPdfConfirmationOpen, setIsPdfConfirmationOpen] = useState(false);
  const [pdfFilename, setPdfFilename] = useState("");
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>(0);
  const [previewPan, setPreviewPan] = useState<PreviewPan>({ x: 0, y: 0 });
  const [isPreviewZoomRestored, setIsPreviewZoomRestored] = useState(false);
  const [isPreviewResetAnimating, setIsPreviewResetAnimating] = useState(false);
  const [previewZoomDevice, setPreviewZoomDevice] = useState<PreviewZoomDevice>(() => typeof window === "undefined" ? "desktop" : getPreviewZoomDevice(window.innerWidth));
  const [activePreviewHighlight, setActivePreviewHighlight] = useState<PreviewHighlightTarget | null>(null);
  const [isPreviewHighlightEnabled, setIsPreviewHighlightEnabled] = useState(true);
  const [isPreviewHighlightRestored, setIsPreviewHighlightRestored] = useState(false);
  const [isPdfValidationOpen, setIsPdfValidationOpen] = useState(false);
  const [isLogoRemoveOpen, setIsLogoRemoveOpen] = useState(false);
  const [isLogoEditorOpen, setIsLogoEditorOpen] = useState(false);
  const [lastRemovedLogo, setLastRemovedLogo] = useState<RemovedLogo | null>(null);
  const [logoPresets, setLogoPresets] = useState<LogoPreset[]>([]);
  const [logoPresetName, setLogoPresetName] = useState("");
  const [logoPresetCategory, setLogoPresetCategory] = useState<LogoPresetCategory>("ทั่วไป");
  const [logoPresetSearch, setLogoPresetSearch] = useState("");
  const [logoPresetFilter, setLogoPresetFilter] = useState<LogoPresetCategory | "all">("all");
  const [isLogoPresetsRestored, setIsLogoPresetsRestored] = useState(false);
  const pinchState = useRef<{ distance: number; zoom: PreviewZoom } | null>(null);
  const panState = useRef<{ clientX: number; clientY: number; pan: PreviewPan } | null>(null);
  const singleTouchState = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const lastTap = useRef<TapPoint | null>(null);
  const skipPreviewZoomPersistence = useRef<string | null>(null);
  const previewResetAnimationTimer = useRef<number | null>(null);
  const previewColumnRef = useRef<HTMLElement | null>(null);
  const companyDefaultsApplied = useRef(false);
  const profileQuery = trpc.companyProfile.get.useQuery(undefined, { enabled: isAuthenticated });
  const saveCompanyDesign = trpc.companyProfile.save.useMutation({ onSuccess: () => { void profileQuery.refetch(); flashNotice("บันทึกดีไซน์เริ่มต้นของบริษัทแล้ว"); }, onError: () => flashNotice("ไม่สามารถบันทึกดีไซน์เริ่มต้นของบริษัทได้") });
  const flashNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  };
  const saveDocument = trpc.documents.save.useMutation({
    onSuccess: () => flashNotice("บันทึกเอกสารเข้าบัญชีของคุณแล้ว"),
    onError: () => flashNotice("ไม่สามารถบันทึกเอกสารได้ กรุณาลองใหม่อีกครั้ง"),
  });
  const recordDocumentExport = trpc.documents.recordExportForDocument.useMutation();
  const meta = documentMeta[kind];
  const seo = getDocumentSeo(kind);
  const totals = useMemo(() => calculateDocumentTotals(document), [document]);
  const template = normalizeDocumentTemplate(document.template);
  const accentColor = normalizeDocumentAccentColor(document.accentColor);
  const fontFamily = normalizeDocumentFontFamily(document.fontFamily);
  const fontSize = normalizeDocumentFontSize(document.fontSize);
  const pdfValidationIssues = useMemo(() => getDocumentValidationIssues(document), [document]);
  const receiptSource = useMemo(() => kind === "receipt" ? parseReceiptSourceContext(JSON.stringify(document)) : null, [document, kind]);
  const receiptSourceQuery = trpc.receivables.receiptEligibility.useQuery({ receivableId: receiptSource?.sourceReceivableId || 1 }, { enabled: isAuthenticated && receiptSource !== null, retry: false });
  const logoCrop = boundedLogoCrop(document.logoCrop);
  const previewZoomLabel = previewZoom === -1 ? "90%" : previewZoom === 1 ? "110%" : "100%";
  const previewHint = previewZoom === 1 ? "ลากหนึ่งนิ้วเพื่อเลื่อน · แตะสองครั้งเพื่อรีเซ็ต" : "ถ่างหรือหุบนิ้วสองนิ้วเพื่อซูม · แตะสองครั้งเพื่อรีเซ็ต";
  const previewScrollIndicator = previewZoom === 1 ? getPreviewScrollIndicator(previewPan.y, 188) : null;
  const previewZoomStorageKey = getPreviewZoomStorageKey(kind, previewZoomDevice);
  const updatePreviewZoom = (value: number) => setPreviewZoom(boundedPreviewZoom(value));
  const visibleLogoPresets = useMemo(() => filterLogoPresets(logoPresets, logoPresetSearch, logoPresetFilter), [logoPresetFilter, logoPresetSearch, logoPresets]);
  const applyDesign = (design: Partial<DocumentDesignSettings>) => setDocument((current) => ({
    ...current,
    template: normalizeDocumentTemplate(design.template ?? current.template),
    accentColor: normalizeDocumentAccentColor(design.accentColor ?? current.accentColor),
    fontFamily: normalizeDocumentFontFamily(design.fontFamily ?? current.fontFamily),
    fontSize: normalizeDocumentFontSize(design.fontSize ?? current.fontSize),
  }));
  const scrollToPreview = () => {
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    previewColumnRef.current?.scrollIntoView({ behavior: getPreviewScrollBehavior(prefersReducedMotion), block: "start" });
  };
  useEffect(() => {
    const syncPreviewZoomDevice = () => setPreviewZoomDevice(getPreviewZoomDevice(window.innerWidth));
    syncPreviewZoomDevice();
    window.addEventListener("resize", syncPreviewZoomDevice);
    return () => window.removeEventListener("resize", syncPreviewZoomDevice);
  }, []);
  useEffect(() => {
    try {
      setIsPreviewHighlightEnabled(parseStoredPreviewHighlight(window.localStorage.getItem(PREVIEW_HIGHLIGHT_PREFERENCE_STORAGE_KEY)));
    } catch {
      // The default stays enabled if browser storage is unavailable.
    } finally {
      setIsPreviewHighlightRestored(true);
    }
  }, []);
  useEffect(() => {
    if (!isPreviewHighlightRestored) return;
    try {
      window.localStorage.setItem(PREVIEW_HIGHLIGHT_PREFERENCE_STORAGE_KEY, String(isPreviewHighlightEnabled));
    } catch {
      // The current preview remains usable if browser storage is blocked.
    }
  }, [isPreviewHighlightEnabled, isPreviewHighlightRestored]);
  useEffect(() => {
    try {
      const current = window.localStorage.getItem(LOGO_PRESETS_STORAGE_KEY);
      const legacy = current === null ? window.localStorage.getItem(LEGACY_LOGO_PRESETS_STORAGE_KEY) : null;
      const restored = sanitizeLogoPresets(current ?? legacy);
      setLogoPresets(restored);
      if (current === null && legacy !== null && restored.length) window.localStorage.setItem(LOGO_PRESETS_STORAGE_KEY, serializeLogoPresets(restored));
    } catch {
      setLogoPresets([]);
    } finally {
      setIsLogoPresetsRestored(true);
    }
  }, []);
  useEffect(() => {
    if (!isLogoPresetsRestored) return;
    try {
      window.localStorage.setItem(LOGO_PRESETS_STORAGE_KEY, serializeLogoPresets(logoPresets));
    } catch {
      flashNotice("ไม่สามารถบันทึก preset โลโก้ในอุปกรณ์นี้ได้");
    }
  }, [isLogoPresetsRestored, logoPresets]);
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

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile || companyDefaultsApplied.current) return;
    companyDefaultsApplied.current = true;
    if (profile.defaultDocumentTemplate || profile.defaultAccentColor || profile.defaultFontFamily || profile.defaultFontSize) {
      applyDesign({ template: profile.defaultDocumentTemplate as DocumentTemplate | undefined, accentColor: profile.defaultAccentColor || undefined, fontFamily: profile.defaultFontFamily as DocumentDesignSettings["fontFamily"] | undefined, fontSize: profile.defaultFontSize as DocumentDesignSettings["fontSize"] | undefined });
    }
  }, [profileQuery.data]);

  const updateDocument = <K extends keyof BusinessDocument>(key: K, value: BusinessDocument[K]) => setDocument((current) => ({ ...current, [key]: value }));
  const updateParty = (party: "company" | "customer", key: string, value: string) => setDocument((current) => ({ ...current, [party]: { ...current[party], [key]: value } }));
  const updateItem = (id: string, key: keyof LineItem, value: string | number) => setDocument((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, [key]: value } : item) }));
  const addItem = () => setDocument((current) => ({ ...current, items: [...current.items, { id: crypto.randomUUID(), name: "สินค้า / บริการ", description: "", quantity: 1, unit: "รายการ", unitPrice: 0 }] }));
  const removeItem = (id: string) => setDocument((current) => current.items.length === 1 ? current : { ...current, items: current.items.filter((item) => item.id !== id) });

  const handleLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const validation = validateDocumentAssetFile(file, "โลโก้");
    if (!validation.valid) { flashNotice(validation.message); return; }
    if (!file) return;
    setLastRemovedLogo((previous) => {
      if (previous && isTemporaryDocumentAssetUrl(previous.logoUrl)) URL.revokeObjectURL(previous.logoUrl);
      return null;
    });
    if (isTemporaryDocumentAssetUrl(document.company.logoUrl)) URL.revokeObjectURL(document.company.logoUrl);
    try {
      const logoUrl = await readDocumentAssetAsDataUrl(file);
      setDocument((current) => ({ ...current, company: { ...current.company, logoUrl }, logoPosition: { ...defaultLogoPosition }, logoScale: defaultLogoScale, logoCrop: { ...defaultLogoCrop } }));
      setIsLogoEditorOpen(true);
    } catch {
      flashNotice("ไม่สามารถอ่านไฟล์โลโก้ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      event.target.value = "";
    }
  };
  const removeLogo = () => {
    const removedLogo: RemovedLogo = { logoUrl: document.company.logoUrl, position: boundedLogoPosition(document.logoPosition || defaultLogoPosition), scale: boundedLogoScale(document.logoScale || defaultLogoScale), crop: boundedLogoCrop(document.logoCrop) };
    setLastRemovedLogo((previous) => {
      if (previous && previous.logoUrl !== removedLogo.logoUrl && isTemporaryDocumentAssetUrl(previous.logoUrl)) URL.revokeObjectURL(previous.logoUrl);
      return removedLogo;
    });
    setDocument((current) => ({ ...current, company: { ...current.company, logoUrl: "" }, logoPosition: { ...defaultLogoPosition }, logoScale: defaultLogoScale, logoCrop: { ...defaultLogoCrop } }));
    setIsLogoRemoveOpen(false);
    flashNotice("ลบโลโก้ออกจากเอกสารนี้แล้ว คุณสามารถกู้คืนได้ทันที");
  };
  const undoRemoveLogo = () => {
    if (!lastRemovedLogo) return;
    setDocument((current) => ({ ...current, company: { ...current.company, logoUrl: lastRemovedLogo.logoUrl }, logoPosition: lastRemovedLogo.position, logoScale: lastRemovedLogo.scale, logoCrop: lastRemovedLogo.crop }));
    setLastRemovedLogo(null);
    flashNotice("กู้คืนโลโก้และการปรับแต่งเดิมแล้ว");
  };
  const saveLogoPreset = () => {
    const name = logoPresetName.trim();
    if (!document.company.logoUrl || !name) return;
    const preset: LogoPreset = { id: crypto.randomUUID(), name, logoUrl: document.company.logoUrl, crop: boundedLogoCrop(document.logoCrop), position: boundedLogoPosition(document.logoPosition || defaultLogoPosition), scale: boundedLogoScale(document.logoScale || defaultLogoScale), category: logoPresetCategory, company: { name: document.company.name, address: document.company.address, taxId: document.company.taxId, phone: document.company.phone, email: document.company.email } };
    setLogoPresets((current) => [preset, ...current.filter((item) => item.name.toLocaleLowerCase("th-TH") !== name.toLocaleLowerCase("th-TH"))].slice(0, MAX_LOGO_PRESETS));
    setLogoPresetName("");
    flashNotice(`บันทึก “${name}” เป็น preset โลโก้แล้ว`);
  };
  const applyLogoPreset = (preset: LogoPreset) => {
    setLastRemovedLogo((previous) => {
      if (previous && isTemporaryDocumentAssetUrl(previous.logoUrl)) URL.revokeObjectURL(previous.logoUrl);
      return null;
    });
    if (isTemporaryDocumentAssetUrl(document.company.logoUrl)) URL.revokeObjectURL(document.company.logoUrl);
    setDocument((current) => ({ ...current, company: { ...current.company, name: preset.company.name || current.company.name, address: preset.company.address || current.company.address, taxId: preset.company.taxId || current.company.taxId, phone: preset.company.phone || current.company.phone, email: preset.company.email || current.company.email, logoUrl: preset.logoUrl }, logoCrop: preset.crop, logoPosition: preset.position, logoScale: preset.scale }));
    flashNotice(`ใช้แบรนด์ “${preset.name}” พร้อมข้อมูลบริษัทแล้ว`);
  };
  const removeLogoPreset = (presetId: string) => {
    setLogoPresets((current) => current.filter((preset) => preset.id !== presetId));
    flashNotice("ลบ preset โลโก้ออกจากอุปกรณ์นี้แล้ว");
  };
  const exportLogoPresets = () => {
    const payload = JSON.stringify(createLogoPresetExport(logoPresets), null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "tools-thai-logo-presets.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    flashNotice("ส่งออก preset โลโก้เป็นไฟล์แล้ว");
  };
  const importLogoPresets = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_PRESET_IMPORT_BYTES) { flashNotice("ไฟล์ preset ต้องมีขนาดไม่เกิน 3 MB"); event.target.value = ""; return; }
    try {
      const imported = parseLogoPresetImport(await file.text());
      if (!imported.length) { flashNotice("ไม่พบ preset ที่นำเข้าได้ กรุณาเลือกไฟล์ Tools Thai ที่ถูกต้อง"); return; }
      setLogoPresets((current) => mergeLogoPresets(current, imported));
      flashNotice(`นำเข้า preset โลโก้ ${imported.length} รายการแล้ว`);
    } catch {
      flashNotice("ไม่สามารถอ่านไฟล์ preset ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      event.target.value = "";
    }
  };
  const updateLogoCrop = (update: Partial<BusinessDocument["logoCrop"]>) => setDocument((current) => ({ ...current, logoCrop: boundedLogoCrop({ ...current.logoCrop, ...update }) }));
  const handleDocumentAsset = (event: ChangeEvent<HTMLInputElement>, field: "signatureUrl" | "stampUrl", label: string) => {
    const file = event.target.files?.[0];
    const validation = validateDocumentAssetFile(file, label);
    if (!validation.valid) { flashNotice(validation.message); return; }
    if (!file) return;
    if (document[field]?.startsWith("blob:")) URL.revokeObjectURL(document[field]);
    updateDocument(field, URL.createObjectURL(file));
    event.target.value = "";
  };
  const removeDocumentAsset = (field: "signatureUrl" | "stampUrl", label: string) => {
    if (document[field]?.startsWith("blob:")) URL.revokeObjectURL(document[field]);
    updateDocument(field, "");
    flashNotice(`ลบ${label}ออกจากเอกสารนี้แล้ว`);
  };
  const updateStampTransform = (transform: { position: { x: number; y: number }; scale: number; rotation?: number }) => setDocument((current) => ({ ...current, stampPosition: boundedStampPosition(transform.position), stampScale: boundedStampScale(transform.scale), stampRotation: boundedStampRotation(transform.rotation ?? current.stampRotation ?? defaultStampRotation) }));
  const resetStampTransform = () => updateStampTransform({ position: defaultStampPosition, scale: defaultStampScale, rotation: defaultStampRotation });
  const updateLogoTransform = (transform: { position: { x: number; y: number }; scale: number }) => setDocument((current) => ({ ...current, logoPosition: boundedLogoPosition(transform.position), logoScale: boundedLogoScale(transform.scale) }));
  const resetLogoTransform = () => updateLogoTransform({ position: defaultLogoPosition, scale: defaultLogoScale });
  const updatePreviewHighlightFromTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const highlight = getPreviewHighlightTarget(target.closest<HTMLElement>("[data-preview-highlight]")?.dataset.previewHighlight);
    if (highlight) setActivePreviewHighlight(highlight);
  };
  const handleFormFocus = (event: React.FocusEvent<HTMLElement>) => updatePreviewHighlightFromTarget(event.target);
  const handleFormClick = (event: React.MouseEvent<HTMLElement>) => updatePreviewHighlightFromTarget(event.target);
  const handleFormBlur = (event: React.FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActivePreviewHighlight(null);
  };

  const makePersistableDocument = () => {
    const profileLogo = profileQuery.data?.logoUrl || "";
    return { ...document, company: { ...document.company, logoUrl: document.company.logoUrl.startsWith("blob:") ? profileLogo : document.company.logoUrl }, signatureUrl: document.signatureUrl?.startsWith("blob:") ? profileQuery.data?.signatureUrl || "" : document.signatureUrl, stampUrl: document.stampUrl?.startsWith("blob:") ? profileQuery.data?.stampUrl || "" : document.stampUrl };
  };

  const exportPdf = async (requestedFilename: string) => {
    const printable = window.document.getElementById("printable-document");
    if (!printable || isExporting) return;
    setIsExporting(true);
    setIsPdfConfirmationOpen(false);
    setPdfExportStage("preparing");
    setActivePreviewHighlight(null);
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await window.document.fonts?.ready;
      setPdfExportStage("rendering");
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
      const filename = sanitizePdfFilename(requestedFilename, document.documentNumber || documentMeta[kind].prefix);
      setPdfExportStage("downloading");
      pdf.save(filename);
      if (isAuthenticated) {
        try {
          const persistable = makePersistableDocument();
          await recordDocumentExport.mutateAsync({ kind: document.kind, documentNumber: document.documentNumber || makeDocumentNumber(kind), customerName: document.customer.name || undefined, payload: JSON.stringify(persistable), filename });
          flashNotice("เริ่มดาวน์โหลด PDF และบันทึกประวัติในคลังเอกสารแล้ว");
        } catch {
          flashNotice("เริ่มดาวน์โหลด PDF แล้ว แต่ยังบันทึกประวัติไม่สำเร็จ");
        }
      }
    } catch {
      flashNotice("ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      window.setTimeout(() => { setIsExporting(false); setPdfExportStage(null); }, 480);
    }
  };

  const openPdfConfirmation = () => {
    setPdfFilename(sanitizePdfFilename(document.documentNumber || documentMeta[kind].prefix, documentMeta[kind].prefix));
    setIsPdfConfirmationOpen(true);
  };

  const requestPdfExport = () => {
    if (pdfValidationIssues.length > 0) {
      setIsPdfValidationOpen(true);
      return;
    }
    openPdfConfirmation();
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
    setDocument((current) => ({ ...current, company: { name: profile.name, address: profile.address || "", taxId: profile.taxId || "", phone: profile.phone || "", email: profile.email || "", logoUrl: profile.logoUrl || "" }, signerName: profile.signerName || "", signerPosition: profile.signerPosition || "", signatureUrl: profile.signatureUrl || "", stampUrl: profile.stampUrl || "" }));
    applyDesign({ template: profile.defaultDocumentTemplate as DocumentTemplate | undefined, accentColor: profile.defaultAccentColor || undefined, fontFamily: profile.defaultFontFamily as DocumentDesignSettings["fontFamily"] | undefined, fontSize: profile.defaultFontSize as DocumentDesignSettings["fontSize"] | undefined });
    flashNotice("ใช้ template และดีไซน์เริ่มต้นของบริษัทแล้ว");
  };
  const saveCurrentDesignAsCompanyDefault = () => {
    const profile = profileQuery.data;
    if (!profile) { startLogin(); return; }
    saveCompanyDesign.mutate({ name: profile.name, address: profile.address || undefined, taxId: profile.taxId || undefined, phone: profile.phone || undefined, email: profile.email || undefined, existingLogoUrl: profile.logoUrl || undefined, existingSignatureUrl: profile.signatureUrl || undefined, existingStampUrl: profile.stampUrl || undefined, signerName: profile.signerName || undefined, signerPosition: profile.signerPosition || undefined, defaultDocumentTemplate: template, defaultAccentColor: accentColor, defaultFontFamily: fontFamily, defaultFontSize: fontSize });
  };
  const handleAccountSave = () => {
    if (!isAuthenticated) { startLogin(); return; }
    const persistable = makePersistableDocument();
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
            <button type="button" className="button button-download" onClick={requestPdfExport} disabled={isExporting}><FileDown size={17} /> {isExporting ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}</button>
            <button type="button" className="workspace-action" onClick={() => window.print()}><Printer size={16} /> พิมพ์</button>
            <button type="button" className="workspace-action text-action" onClick={handleReset}><RotateCcw size={16} /> รีเซ็ต</button>
            <button type="button" className="workspace-action save-action" onClick={handleAccountSave} disabled={saveDocument.isPending}><Save size={16} /> {isAuthenticated ? (saveDocument.isPending ? "กำลังบันทึก" : "บันทึก") : "บันทึก"}</button>
          </div>
          <span className="autosave-status"><span>✓</span> บันทึกอัตโนมัติในอุปกรณ์</span>
        </div>
        {receiptSource && <section className={receiptSourceQuery.data?.sourceChanged ? "receipt-source-context is-warning print-hide" : "receipt-source-context print-hide"} role={receiptSourceQuery.data?.sourceChanged ? "status" : undefined}><div><ShieldCheck size={18} /><span><strong>สร้างจากใบแจ้งหนี้ {receiptSource.sourceInvoiceNumber}</strong><small>รับชำระครบ {formatTHB(Number(receiptSource.paymentTotalAtCreation))} · {receiptSource.activePaymentIds.length} รายการรับชำระ</small></span></div>{receiptSourceQuery.data?.sourceChanged ? <div className="receipt-source-context-warning"><Info size={16} /> ข้อมูลการรับชำระเปลี่ยนแล้ว <Link href="/receivables">ตรวจ timeline</Link></div> : <Link href="/receivables" className="receipt-source-context-link">ดูรายการรับชำระ</Link>}</section>}
        {notice && <div className="draft-toast print-hide"><ShieldCheck size={17} /> {notice}</div>}
        {pdfExportStage && <div className="pdf-export-status" role="status" aria-live="polite"><div className="pdf-export-orbit" aria-hidden="true"><i /><i /><i /></div><div><strong>{pdfExportStage === "preparing" ? "กำลังเตรียมเอกสาร" : pdfExportStage === "rendering" ? "กำลังเรนเดอร์ PDF" : "กำลังเริ่มดาวน์โหลด"}</strong><span>{pdfExportStage === "preparing" ? "ตรวจสอบรูปแบบและข้อมูลเอกสาร" : pdfExportStage === "rendering" ? "กำลังจัดวางเอกสารให้พร้อมดาวน์โหลด" : "ไฟล์ PDF จะถูกบันทึกลงในอุปกรณ์ของคุณ"}</span></div></div>}
        <AlertDialog open={isPdfValidationOpen} onOpenChange={setIsPdfValidationOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>ตรวจข้อมูลสำคัญก่อนดาวน์โหลด PDF</AlertDialogTitle><AlertDialogDescription>พบข้อมูลที่ควรตรวจทานก่อนสร้าง PDF คุณสามารถกลับไปแก้ไข หรือดาวน์โหลดต่อได้หากยืนยันว่าข้อมูลถูกต้องแล้ว</AlertDialogDescription></AlertDialogHeader><ul className="pdf-validation-list">{pdfValidationIssues.map((issue) => <li key={issue.id}><strong>{issue.label}</strong><span>{issue.message}</span></li>)}</ul><AlertDialogFooter><AlertDialogCancel>กลับไปแก้ไข</AlertDialogCancel><AlertDialogAction onClick={() => { setIsPdfValidationOpen(false); openPdfConfirmation(); }}>ตรวจ preview และดาวน์โหลด</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        <Dialog open={isPdfConfirmationOpen} onOpenChange={setIsPdfConfirmationOpen}><DialogContent className="pdf-export-confirmation"><DialogHeader><DialogTitle>ตรวจ preview และตั้งชื่อไฟล์ PDF</DialogTitle><DialogDescription>ตรวจเอกสารฉบับย่อด้านล่าง แล้วตั้งชื่อไฟล์ก่อนยืนยันดาวน์โหลด</DialogDescription></DialogHeader><label className="pdf-filename-field"><span>ชื่อไฟล์</span><input value={pdfFilename} onChange={(event) => setPdfFilename(event.target.value)} onBlur={() => setPdfFilename((current) => sanitizePdfFilename(current, document.documentNumber || documentMeta[kind].prefix))} maxLength={184} aria-label="ชื่อไฟล์ PDF" /></label><div className="pdf-confirmation-thumbnail" aria-label="ตัวอย่างเอกสารก่อนดาวน์โหลด"><DocumentPreview document={document} previewId="pdf-confirmation-preview" accentColor={accentColor} template={template} fontFamily={fontFamily} fontSize={fontSize} /></div><DialogFooter><button type="button" className="workspace-action" onClick={() => setIsPdfConfirmationOpen(false)}>กลับไปแก้ไข</button><button type="button" className="button button-download" onClick={() => void exportPdf(pdfFilename)}><Download size={16} /> ยืนยันและดาวน์โหลด</button></DialogFooter></DialogContent></Dialog>
        <Dialog open={isLogoEditorOpen} onOpenChange={setIsLogoEditorOpen}><DialogContent className="logo-editor-dialog"><DialogHeader><DialogTitle>ครอปและปรับแต่งโลโก้</DialogTitle><DialogDescription>ปรับมุมมองโลโก้ก่อนใช้ในหัวเอกสาร การเปลี่ยนแปลงจะแสดงใน preview และ PDF ทันที</DialogDescription></DialogHeader>{document.company.logoUrl && <><div className="logo-crop-preview"><img src={document.company.logoUrl} alt="ตัวอย่างการครอปโลโก้" style={{ "--logo-crop-x": `${logoCrop.x}%`, "--logo-crop-y": `${logoCrop.y}%`, "--logo-crop-zoom": String(logoCrop.zoom), "--logo-brightness": `${logoCrop.brightness}%`, "--logo-contrast": `${logoCrop.contrast}%` } as CSSProperties} /></div><div className="logo-editor-controls"><label>ซูม <input type="range" min="1" max="2.4" step="0.05" value={logoCrop.zoom} onChange={(event) => updateLogoCrop({ zoom: Number(event.target.value) })} /><output>{Math.round(logoCrop.zoom * 100)}%</output></label><label>เลื่อนซ้าย–ขวา <input type="range" min="-34" max="34" step="1" value={logoCrop.x} onChange={(event) => updateLogoCrop({ x: Number(event.target.value) })} /><output>{logoCrop.x}</output></label><label>เลื่อนขึ้น–ลง <input type="range" min="-34" max="34" step="1" value={logoCrop.y} onChange={(event) => updateLogoCrop({ y: Number(event.target.value) })} /><output>{logoCrop.y}</output></label><label>ความสว่าง <input type="range" min="70" max="130" step="1" value={logoCrop.brightness} onChange={(event) => updateLogoCrop({ brightness: Number(event.target.value) })} /><output>{logoCrop.brightness}%</output></label><label>ความคมชัด <input type="range" min="70" max="130" step="1" value={logoCrop.contrast} onChange={(event) => updateLogoCrop({ contrast: Number(event.target.value) })} /><output>{logoCrop.contrast}%</output></label></div></>}<DialogFooter><button type="button" className="workspace-action" onClick={() => updateDocument("logoCrop", { ...defaultLogoCrop })}>รีเซ็ตการปรับแต่ง</button><button type="button" className="button button-download" onClick={() => setIsLogoEditorOpen(false)}>ใช้กับเอกสาร</button></DialogFooter></DialogContent></Dialog>
        <div className="shell document-grid reference-document-grid">
          <section className="document-form-card reference-form-panel print-hide" onFocusCapture={handleFormFocus} onBlurCapture={handleFormBlur} onClickCapture={handleFormClick}>
            <section className="form-section document-design-section">
              <CardHeading title="ดีไซน์เอกสาร" />
              <p className="design-label">เทมเพลตตามประเภทธุรกิจ</p>
              <div className="business-template-grid" aria-label="เลือกเทมเพลตตามประเภทธุรกิจ">
                {businessDocumentTemplates.map((choice) => <button type="button" key={choice.id} className={`business-template-choice ${template === choice.template && accentColor === choice.accentColor && fontFamily === choice.fontFamily && fontSize === choice.fontSize ? "is-selected" : ""}`} data-preview-highlight="document" onClick={() => applyDesign(choice)}><span>{choice.category}</span><strong>{choice.title}</strong><small>{choice.description}</small></button>)}
              </div>
              <p className="design-label">เทมเพลต</p>
              <div className="template-choice-grid">
                {templateChoices.map((choice) => <button type="button" key={choice.id} className={`template-choice ${template === choice.id ? "is-selected" : ""}`} data-preview-highlight="document" onClick={() => applyDesign({ template: choice.id })}><strong>{choice.title}</strong><small>{choice.description}</small></button>)}
              </div>
              <p className="design-label">สีหลัก</p>
              <div className="accent-picker" aria-label="เลือกสีหลักของเอกสาร">{accentChoices.map((color) => <button type="button" key={color} className={accentColor === color ? "is-selected" : ""} data-preview-highlight="document" onClick={() => applyDesign({ accentColor: color })} style={{ backgroundColor: color }} aria-label={`เลือกสี ${color}`} />)}</div>
              <p className="design-label">แบบฟอนต์เอกสาร</p>
              <div className="font-choice-grid" role="group" aria-label="เลือกแบบฟอนต์เอกสาร">{documentFontChoices.map((choice) => <button type="button" key={choice.id} className={fontFamily === choice.id ? "is-selected" : ""} data-preview-highlight="document" onClick={() => applyDesign({ fontFamily: choice.id })}><strong>{choice.title}</strong><small>{choice.description}</small></button>)}</div>
              <p className="design-label">ขนาดฟอนต์ในเอกสาร</p>
              <div className="font-size-choice-grid" role="group" aria-label="เลือกขนาดฟอนต์เอกสาร">{documentFontSizeChoices.map((choice) => <button type="button" key={choice.id} className={fontSize === choice.id ? "is-selected" : ""} data-preview-highlight="document" onClick={() => applyDesign({ fontSize: choice.id })}><strong>{choice.title}</strong><small>{choice.description}</small></button>)}</div>
                <div className="document-assets-row">
                  <div className="asset-upload-tile" data-preview-highlight="company"><span className="asset-preview">{document.company.logoUrl ? <img src={document.company.logoUrl} alt="ตัวอย่างโลโก้" /> : <WandSparkles size={18} />}</span><strong>โลโก้</strong><label className="asset-upload-action"><Upload size={13} /> {document.company.logoUrl ? "เปลี่ยนรูป" : "อัปโหลด"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} /></label>{document.company.logoUrl && <><button type="button" className="asset-edit-button" onClick={() => setIsLogoEditorOpen(true)}>ปรับแต่ง</button><AlertDialog open={isLogoRemoveOpen} onOpenChange={setIsLogoRemoveOpen}><AlertDialogTrigger asChild><button type="button" className="asset-remove-button">ลบรูป</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>ลบโลโก้ออกจากเอกสารนี้?</AlertDialogTitle><AlertDialogDescription>โลโก้จะหายจากตัวอย่างเอกสารและ PDF ปัจจุบัน แต่จะไม่ลบไฟล์ต้นฉบับที่เก็บอยู่ใน template บริษัท</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ยกเลิก</AlertDialogCancel><AlertDialogAction onClick={removeLogo}>ลบโลโก้</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>}</div>
                  <DocumentAssetTile label="ลายเซ็น" previewUrl={document.signatureUrl || ""} previewHighlight="signature" onChange={(event) => handleDocumentAsset(event, "signatureUrl", "ลายเซ็น")} onRemove={() => removeDocumentAsset("signatureUrl", "ลายเซ็น")} />
	                  <DocumentAssetTile label="ตรายาง" previewUrl={document.stampUrl || ""} previewHighlight="signature" onChange={(event) => handleDocumentAsset(event, "stampUrl", "ตรายาง")} onRemove={() => removeDocumentAsset("stampUrl", "ตรายาง")} />
	                </div>
	                <section className="logo-presets" data-preview-highlight="company" aria-label="โลโก้ที่ใช้บ่อย">
	                  <div className="logo-presets-heading"><div><strong>โลโก้ที่ใช้บ่อย</strong><span>บันทึกได้สูงสุด {MAX_LOGO_PRESETS} แบรนด์ในอุปกรณ์นี้</span></div><div className="logo-preset-transport"><button type="button" onClick={exportLogoPresets} disabled={!logoPresets.length}><Download size={13} /> ส่งออก</button><label><Upload size={13} /> นำเข้า<input type="file" accept="application/json,.json" onChange={importLogoPresets} /></label></div></div>
	                  {document.company.logoUrl && <><div className="save-logo-preset"><input value={logoPresetName} onChange={(event) => setLogoPresetName(event.target.value)} maxLength={40} placeholder="ชื่อแบรนด์ เช่น ร้าน A" aria-label="ชื่อ preset โลโก้" /><select value={logoPresetCategory} onChange={(event) => setLogoPresetCategory(event.target.value as LogoPresetCategory)} aria-label="หมวดหมู่ preset">{logoPresetCategories.map((category) => <option value={category} key={category}>{category}</option>)}</select><button type="button" disabled={!logoPresetName.trim()} onClick={saveLogoPreset}><Save size={14} /> บันทึก preset</button></div><p className="logo-preset-company-hint">บันทึกโลโก้พร้อมชื่อบริษัท ที่อยู่ เลขภาษี โทรศัพท์ และอีเมลปัจจุบัน เพื่อเติมให้อัตโนมัติเมื่อเลือกแบรนด์</p></>}
	                  {logoPresets.length ? <><div className="logo-preset-filter-row"><label><Search size={14} /><input value={logoPresetSearch} onChange={(event) => setLogoPresetSearch(event.target.value)} placeholder="ค้นหาชื่อแบรนด์" aria-label="ค้นหา preset โลโก้" /></label><label><Tags size={14} /><select value={logoPresetFilter} onChange={(event) => setLogoPresetFilter(event.target.value as LogoPresetCategory | "all")} aria-label="กรองหมวดหมู่ preset"><option value="all">ทุกหมวดหมู่</option>{logoPresetCategories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label></div>{visibleLogoPresets.length ? <div className="logo-preset-list">{visibleLogoPresets.map((preset) => <div className="logo-preset-card" key={preset.id}><button type="button" className="logo-preset-select" onClick={() => applyLogoPreset(preset)}><span><img src={preset.logoUrl} alt="" /></span><span className="logo-preset-copy"><strong>{preset.name}</strong><small>{preset.company.name || "โลโก้และการจัดวางที่บันทึก"}</small><em>{preset.category}</em></span></button><button type="button" className="logo-preset-remove" onClick={() => removeLogoPreset(preset.id)} aria-label={`ลบ preset ${preset.name}`} title={`ลบ ${preset.name}`}><Trash2 size={14} /></button></div>)}</div> : <p className="logo-preset-empty">ไม่พบ preset ที่ตรงกับคำค้นหาหรือหมวดหมู่นี้</p>}</> : <p className="logo-preset-empty">ยังไม่มี preset — อัปโหลดหรือเลือกโลโก้ แล้วตั้งชื่อเพื่อบันทึกไว้ใช้ครั้งถัดไป</p>}
	                </section>
	                {lastRemovedLogo && <button type="button" className="undo-logo-button" data-preview-highlight="company" onClick={undoRemoveLogo}><Undo2 size={15} /> เลิกทำการลบโลโก้</button>}
	                {document.company.logoUrl && <div className="logo-transform-controls" data-preview-highlight="company"><div><strong>ขนาดและตำแหน่งโลโก้</strong><span>ปรับผลที่แสดงในหัวเอกสารและ PDF ได้ทันที</span></div><label>ขนาด <input type="range" min="0.65" max="1.45" step="0.05" value={boundedLogoScale(document.logoScale || defaultLogoScale)} onChange={(event) => updateLogoTransform({ position: document.logoPosition || defaultLogoPosition, scale: Number(event.target.value) })} /><output>{Math.round(boundedLogoScale(document.logoScale || defaultLogoScale) * 100)}%</output></label><label>แนวนอน <input type="range" min="-24" max="24" step="1" value={boundedLogoPosition(document.logoPosition || defaultLogoPosition).x} onChange={(event) => updateLogoTransform({ position: { ...boundedLogoPosition(document.logoPosition || defaultLogoPosition), x: Number(event.target.value) }, scale: document.logoScale || defaultLogoScale })} /><output>{boundedLogoPosition(document.logoPosition || defaultLogoPosition).x}</output></label><label>แนวตั้ง <input type="range" min="-18" max="18" step="1" value={boundedLogoPosition(document.logoPosition || defaultLogoPosition).y} onChange={(event) => updateLogoTransform({ position: { ...boundedLogoPosition(document.logoPosition || defaultLogoPosition), y: Number(event.target.value) }, scale: document.logoScale || defaultLogoScale })} /><output>{boundedLogoPosition(document.logoPosition || defaultLogoPosition).y}</output></label><div className="logo-align-actions"><button type="button" onClick={() => updateLogoTransform({ position: { x: -16, y: 0 }, scale: document.logoScale || defaultLogoScale })}>ชิดซ้าย</button><button type="button" onClick={() => updateLogoTransform({ position: defaultLogoPosition, scale: document.logoScale || defaultLogoScale })}>กึ่งกลาง</button><button type="button" onClick={() => updateLogoTransform({ position: { x: 16, y: 0 }, scale: document.logoScale || defaultLogoScale })}>ชิดขวา</button></div><button type="button" className="reset-logo-transform" onClick={resetLogoTransform}>รีเซ็ตขนาดและตำแหน่ง</button></div>}
                {document.stampUrl && <div className="stamp-transform-controls" data-preview-highlight="signature"><div><strong>จัดวางตรายาง</strong><span>ลากตรายางบนตัวอย่างเอกสารเพื่อย้ายตำแหน่ง หรือลากจุดมุมเพื่อปรับขนาด</span></div><label>ขนาด <input type="range" min="0.6" max="1.7" step="0.05" value={boundedStampScale(document.stampScale || defaultStampScale)} onChange={(event) => updateStampTransform({ position: document.stampPosition || defaultStampPosition, scale: Number(event.target.value) })} /><output>{Math.round(boundedStampScale(document.stampScale || defaultStampScale) * 100)}%</output></label><button type="button" onClick={resetStampTransform}>จัดวางใหม่</button></div>}
                {document.stampUrl && <div className="stamp-rotation-controls" data-preview-highlight="signature"><div><strong>องศาตรายาง</strong><span>ปรับเอียงเล็กน้อยให้ดูเป็นธรรมชาติใน Preview และ PDF</span></div><label>หมุน <input type="range" min="-35" max="35" step="1" value={boundedStampRotation(document.stampRotation ?? defaultStampRotation)} onChange={(event) => updateStampTransform({ position: document.stampPosition || defaultStampPosition, scale: document.stampScale || defaultStampScale, rotation: Number(event.target.value) })} /><output>{boundedStampRotation(document.stampRotation ?? defaultStampRotation)}°</output></label><div className="stamp-rotation-presets"><button type="button" onClick={() => updateStampTransform({ position: document.stampPosition || defaultStampPosition, scale: document.stampScale || defaultStampScale, rotation: -12 })}>เอียงซ้าย</button><button type="button" onClick={() => updateStampTransform({ position: document.stampPosition || defaultStampPosition, scale: document.stampScale || defaultStampScale, rotation: 0 })}>ตรง</button><button type="button" onClick={() => updateStampTransform({ position: document.stampPosition || defaultStampPosition, scale: document.stampScale || defaultStampScale, rotation: 12 })}>เอียงขวา</button></div></div>}
              {profileQuery.data && <div className="company-design-actions" data-preview-highlight="document"><button type="button" className="apply-template-button" onClick={applySavedCompany}>ใช้ template บริษัทที่บันทึก</button><button type="button" className="save-company-design-button" onClick={saveCurrentDesignAsCompanyDefault} disabled={saveCompanyDesign.isPending}><Save size={15} /> {saveCompanyDesign.isPending ? "กำลังบันทึก..." : "ตั้งเป็นค่าเริ่มต้นบริษัท"}</button></div>}
              <p className="design-hint">แนะนำ: ใช้ไฟล์ PNG พื้นหลังโปร่งใสสำหรับลายเซ็นและตรายาง ขนาดไม่เกิน 500 KB เพื่อให้ดูคมชัดใน PDF</p>
              <button type="button" className="design-preview-link" onClick={scrollToPreview}><Eye size={15} /> ดูตัวอย่างที่อัปเดต</button>
            </section>

            <section className="form-section">
              <CardHeading title="ข้อมูลเอกสาร" />
              <div className="field-grid">
                <FormField label="เลขที่เอกสาร"><input data-preview-highlight="document-meta" value={document.documentNumber} onChange={(event) => updateDocument("documentNumber", event.target.value)} /></FormField>
                <div className="field-grid two-columns keep-on-mobile"><FormField label="วันที่ออก"><input data-preview-highlight="document-meta" type="date" value={document.issueDate} onChange={(event) => updateDocument("issueDate", event.target.value)} /></FormField>{kind !== "receipt" && <FormField label="กำหนดชำระ / ใช้ได้ถึง"><input data-preview-highlight="document-meta" type="date" value={document.dueDate} onChange={(event) => updateDocument("dueDate", event.target.value)} /></FormField>}</div>
              </div>
            </section>

            <section className="form-section">
              <CardHeading title="ผู้ขาย / ผู้ออกเอกสาร" />
              <div className="field-grid"><FormField label="ชื่อบริษัท / ร้าน"><input data-preview-highlight="company" placeholder="เช่น บริษัท เอ บี ซี จำกัด" value={document.company.name} onChange={(event) => updateParty("company", "name", event.target.value)} /></FormField><FormField label="ที่อยู่"><textarea data-preview-highlight="company" rows={2} placeholder="เลขที่ อาคาร ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" value={document.company.address} onChange={(event) => updateParty("company", "address", event.target.value)} /></FormField><div className="field-grid two-columns keep-on-mobile"><FormField label="เลขผู้เสียภาษี (13 หลัก)"><input data-preview-highlight="company" value={document.company.taxId} onChange={(event) => updateParty("company", "taxId", event.target.value)} /></FormField><FormField label="โทรศัพท์"><input data-preview-highlight="company" value={document.company.phone} onChange={(event) => updateParty("company", "phone", event.target.value)} /></FormField></div><FormField label="อีเมล"><input data-preview-highlight="company" type="email" value={document.company.email} onChange={(event) => updateParty("company", "email", event.target.value)} /></FormField></div>
            </section>

            <section className="form-section">
              <CardHeading title="ลูกค้า / ผู้รับเอกสาร" />
              <div className="field-grid"><FormField label="ชื่อ"><input data-preview-highlight="customer" value={document.customer.name} onChange={(event) => updateParty("customer", "name", event.target.value)} /></FormField><FormField label="ที่อยู่"><textarea data-preview-highlight="customer" rows={2} value={document.customer.address} onChange={(event) => updateParty("customer", "address", event.target.value)} /></FormField><div className="field-grid two-columns keep-on-mobile"><FormField label="เลขผู้เสียภาษี"><input data-preview-highlight="customer" value={document.customer.taxId} onChange={(event) => updateParty("customer", "taxId", event.target.value)} /></FormField><FormField label="ผู้ติดต่อ"><input data-preview-highlight="customer" value={document.customer.contact} onChange={(event) => updateParty("customer", "contact", event.target.value)} /></FormField></div></div>
            </section>

            <section className="form-section items-section">
              <div className="card-heading-row"><CardHeading title="รายการสินค้า / บริการ" /><button type="button" className="add-item-button" onClick={addItem}><Plus size={16} /> เพิ่ม</button></div>
              <div className="item-editor-list">{document.items.map((item, index) => <div className="item-editor" key={item.id} data-preview-highlight={getItemPreviewHighlightTarget(item.id)}><div className="item-editor-top"><span>รายการที่ {index + 1}</span>{document.items.length > 1 && <button type="button" aria-label="ลบรายการ" onClick={() => removeItem(item.id)}><Trash2 size={15} /></button>}</div><div className="field-grid"><FormField label="รายการสินค้า / บริการ"><textarea rows={2} value={item.name} onChange={(event) => updateItem(item.id, "name", event.target.value)} /></FormField><FormField label="รายละเอียดเพิ่มเติม"><input value={item.description} onChange={(event) => updateItem(item.id, "description", event.target.value)} /></FormField><div className="field-grid two-columns keep-on-mobile"><FormField label="จำนวน"><input type="number" min="0" value={item.quantity} onChange={(event) => updateItem(item.id, "quantity", Number(event.target.value))} /></FormField><FormField label="ราคาต่อหน่วย (บาท)"><input type="number" min="0" value={item.unitPrice} onChange={(event) => updateItem(item.id, "unitPrice", Number(event.target.value))} /></FormField></div><FormField label="หน่วย"><input value={item.unit} onChange={(event) => updateItem(item.id, "unit", event.target.value)} /></FormField></div><div className="item-line-total">รวม {formatTHB(item.quantity * item.unitPrice)}</div></div>)}</div>
            </section>

            <section className="form-section tax-section">
              <CardHeading title="ภาษี" />
              {kind === "tax-invoice" && <div className="tax-notice"><Info size={15} /><span>เอกสารนี้เป็น template เพื่อช่วยจัดรูปแบบข้อมูล กรุณาตรวจสอบความครบถ้วนของรายการ อัตราภาษี และเงื่อนไขทางกฎหมายกับผู้เชี่ยวชาญก่อนนำไปใช้งานจริง</span></div>}
              <label className="tax-toggle-row" data-preview-highlight="totals"><span><strong>คิดภาษีมูลค่าเพิ่ม (VAT)</strong><small>มาตรฐานอยู่ที่ 7%</small></span><input type="checkbox" checked={document.vatMode !== "none"} onChange={(event) => updateDocument("vatMode", event.target.checked ? "excluded" : "none")} /><i /></label>
              {document.vatMode !== "none" && <div className="field-grid two-columns keep-on-mobile vat-input-grid" data-preview-highlight="totals"><FormField label="อัตรา VAT %"><input type="number" min="0" max="100" value={document.vatRate} onChange={(event) => updateDocument("vatRate", Number(event.target.value))} /></FormField><FormField label="รูปแบบ VAT"><select value={document.vatMode} onChange={(event) => updateDocument("vatMode", event.target.value as BusinessDocument["vatMode"])}><option value="excluded">แยก VAT</option><option value="included">รวม VAT แล้ว</option></select></FormField></div>}
              <div className="tax-divider" />
              <div className="tax-static-row"><span><strong>หักภาษี ณ ที่จ่าย</strong><small>เพิ่มข้อมูลในหมายเหตุได้ตามเงื่อนไขของธุรกิจ</small></span><i aria-hidden="true" /></div>
            </section>

            <section className="form-section">
              <CardHeading title="อื่นๆ" />
              <div className="field-grid"><FormField label="หมายเหตุ"><textarea data-preview-highlight="note" rows={3} value={document.note} onChange={(event) => updateDocument("note", event.target.value)} /></FormField><div className="field-grid two-columns"><FormField label="ชื่อผู้มีอำนาจลงนาม"><input data-preview-highlight="signature" value={document.signerName || ""} onChange={(event) => updateDocument("signerName", event.target.value)} /></FormField><FormField label="ตำแหน่งผู้ลงนาม"><input data-preview-highlight="signature" value={document.signerPosition || ""} onChange={(event) => updateDocument("signerPosition", event.target.value)} placeholder="เช่น กรรมการผู้จัดการ" /></FormField></div></div>
              <label className="watermark-toggle" data-preview-highlight="document"><input type="checkbox" checked={document.watermark} onChange={(event) => updateDocument("watermark", event.target.checked)} /><span /><div><strong>ใส่ลายน้ำ Tools Thai</strong><small>เพิ่มลายน้ำแบบโปร่งใสในเอกสาร</small></div></label>
              <button type="button" className="draft-link" onClick={handleDraft}>บันทึกฉบับร่างไว้ในอุปกรณ์นี้</button>
            </section>
            <div className="form-summary"><span>ยอดรวมสุทธิ</span><strong>{formatTHB(totals.total)}</strong><small>{document.vatMode !== "none" ? `รวม VAT ${document.vatRate}% แล้ว` : "ไม่คิด VAT"}</small></div>
            <div className="mobile-preview-action"><button type="button" className="button button-download" onClick={requestPdfExport} disabled={isExporting}><FileDown size={16} /> {isExporting ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}</button></div>
          </section>

          <aside ref={previewColumnRef} className="document-preview-column">
            <div className="preview-toolbar print-hide"><span><Info size={15} /> ตัวอย่างเอกสาร</span><div className="preview-toolbar-actions"><button type="button" className={`preview-highlight-toggle ${isPreviewHighlightEnabled ? "is-active" : ""}`} aria-pressed={isPreviewHighlightEnabled} onClick={() => setIsPreviewHighlightEnabled((enabled) => !enabled)} title={isPreviewHighlightEnabled ? "ปิดเอฟเฟกต์ไฮไลท์" : "เปิดเอฟเฟกต์ไฮไลท์"}>{isPreviewHighlightEnabled ? <Eye size={15} /> : <EyeOff size={15} />} <span>ไฮไลท์</span></button><div className="preview-zoom-controls" role="group" aria-label="ปรับขนาดตัวอย่างเอกสาร"><button type="button" onClick={() => updatePreviewZoom(previewZoom - 1)} disabled={previewZoom === -1} aria-label="ซูมออก" title="ซูมออก"><ZoomOut size={15} /></button><output className="preview-zoom-percentage" aria-live="polite" aria-label={`ระดับซูมปัจจุบัน ${previewZoomLabel}`}>{previewZoomLabel}</output><button type="button" onClick={() => updatePreviewZoom(previewZoom + 1)} disabled={previewZoom === 1} aria-label="ซูมเข้า" title="ซูมเข้า"><ZoomIn size={15} /></button><button type="button" className="zoom-reset-button" onClick={resetPreviewView} disabled={previewZoom === 0} aria-label="รีเซ็ตขนาดตัวอย่าง" title="รีเซ็ตขนาด"><RotateCcw size={14} /></button></div><AlertDialog><AlertDialogTrigger asChild><button type="button" className="zoom-storage-reset-button" aria-label="ล้างค่าซูมที่จำไว้สำหรับอุปกรณ์นี้" title="ล้างค่าซูมที่จำไว้"><RotateCcw size={14} /> ล้างค่าซูม</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>ล้างค่าซูมที่จำไว้?</AlertDialogTitle><AlertDialogDescription>การดำเนินการนี้จะคืนตัวอย่าง{meta.title}บน{previewZoomDevice === "mobile" ? "มือถือ" : "คอมพิวเตอร์"}เครื่องนี้เป็น 100% โดยไม่กระทบเอกสารหรืออุปกรณ์อื่น</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ยกเลิก</AlertDialogCancel><AlertDialogAction onClick={resetSavedPreviewZoom}>ล้างค่าซูม</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><AlertDialog><AlertDialogTrigger asChild><button type="button" className="zoom-storage-reset-all-button" aria-label="ล้างค่าซูมทุกเอกสารบนอุปกรณ์นี้" title="ล้างค่าซูมทุกเอกสาร"><RotateCcw size={14} /> ล้างทั้งหมด</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>ล้างค่าซูมทุกเอกสาร?</AlertDialogTitle><AlertDialogDescription>การดำเนินการนี้จะล้างค่าซูมที่จำไว้ของเอกสารทุกประเภทบน{previewZoomDevice === "mobile" ? "มือถือ" : "คอมพิวเตอร์"}เครื่องนี้ และคืนตัวอย่างปัจจุบันเป็น 100% โดยไม่กระทบค่าบนอุปกรณ์อื่น</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ยกเลิก</AlertDialogCancel><AlertDialogAction onClick={resetAllSavedPreviewZooms}>ล้างทุกเอกสาร</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><button type="button" onClick={requestPdfExport} disabled={isExporting}><Download size={15} /> {isExporting ? "กำลังสร้าง" : "PDF"}</button></div></div>
            <div className={`preview-paper-wrap ${previewZoom === 1 ? "preview-pan-enabled" : ""} ${isPreviewResetAnimating ? "is-zoom-resetting" : ""}`} tabIndex={0} aria-label="ตัวอย่างเอกสาร รองรับการถ่างหรือหุบนิ้วเพื่อซูมบนมือถือ" onTouchStart={handlePreviewTouchStart} onTouchMove={handlePreviewTouchMove} onTouchEnd={handlePreviewTouchEnd} onTouchCancel={clearPreviewTouch}>{previewScrollIndicator && <div className="document-scroll-indicator print-hide" aria-live="polite"><span>กำลังดู</span><strong>{previewScrollIndicator.section}</strong><div className="scroll-indicator-track" aria-hidden="true"><i style={{ left: `${previewScrollIndicator.progress}%` }} /></div></div>}<span className="pinch-zoom-hint print-hide">{previewHint}</span><DocumentPreview document={document} accentColor={accentColor} template={template} fontFamily={fontFamily} fontSize={fontSize} screenZoom={previewZoom} screenPan={previewPan} activeHighlight={isPreviewHighlightEnabled ? activePreviewHighlight : null} isStampEditable={Boolean(document.stampUrl)} onStampTransformChange={updateStampTransform} /></div>
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
function DocumentAssetTile({ label, previewUrl, previewHighlight, onChange, onRemove }: { label: string; previewUrl: string; previewHighlight: PreviewHighlightTarget; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) { return <div className="asset-upload-tile" data-preview-highlight={previewHighlight}><span className="asset-preview">{previewUrl ? <img src={previewUrl} alt={`ตัวอย่าง${label}`} /> : <WandSparkles size={18} />}</span><strong>{label}</strong><label className="asset-upload-action"><Upload size={13} /> {previewUrl ? "เปลี่ยนรูป" : "อัปโหลด"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onChange} /></label>{previewUrl && <button type="button" className="asset-remove-button" onClick={onRemove}>ลบรูป</button>}</div>; }
function getTouchDistance(touches: TouchEvent<HTMLDivElement>["touches"]) { return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY); }

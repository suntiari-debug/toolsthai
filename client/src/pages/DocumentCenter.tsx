import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Archive, ArrowLeft, CheckCircle2, ChevronRight, Copy, FilePlus2, FileText, FolderArchive, LogIn, RotateCcw, Search, Send, WalletCards } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import SeoMeta from "@/components/SeoMeta";
import { persistDocumentResume } from "@/lib/documentCenterNavigation";
import { trpc } from "@/lib/trpc";
import { summarizeDocumentStatuses, type DocumentStatus as SharedDocumentStatus } from "@shared/documentCenter";

type DocumentKindFilter = "all" | "quotation" | "invoice" | "receipt" | "delivery-note" | "tax-invoice";
type DocumentStatus = SharedDocumentStatus;
type StatusFilter = "all" | DocumentStatus;

const kindLabels: Record<Exclude<DocumentKindFilter, "all">, string> = {
  quotation: "ใบเสนอราคา",
  invoice: "ใบแจ้งหนี้",
  receipt: "ใบเสร็จรับเงิน",
  "delivery-note": "ใบส่งของ",
  "tax-invoice": "ใบกำกับภาษี",
};

const statusLabels: Record<DocumentStatus, string> = {
  draft: "ร่าง",
  sent: "ส่งแล้ว",
  paid: "ชำระแล้ว",
  overdue: "เกินกำหนด",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default function DocumentCenter() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<DocumentKindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [notice, setNotice] = useState("");

  const listInput = useMemo(() => ({
    query: query.trim() || undefined,
    kind: kind === "all" ? undefined : kind,
    status: status === "all" ? undefined : status,
    includeArchived,
  }), [query, kind, status, includeArchived]);
  const documentsQuery = trpc.documents.list.useQuery(listInput, { enabled: isAuthenticated });
  const refresh = async () => { await utils.documents.list.invalidate(); };
  const updateStatus = trpc.documents.updateStatus.useMutation({ onSuccess: refresh, onError: () => setNotice("ไม่สามารถอัปเดตสถานะเอกสารได้") });
  const setArchived = trpc.documents.setArchived.useMutation({ onSuccess: refresh, onError: () => setNotice("ไม่สามารถเปลี่ยนสถานะการเก็บเอกสารได้") });
  const duplicate = trpc.documents.duplicate.useMutation({ onSuccess: async (result) => { setNotice(`สร้างสำเนา ${result.documentNumber} แล้ว`); await refresh(); }, onError: () => setNotice("ไม่สามารถทำสำเนาเอกสารได้") });

  const summary = useMemo(() => summarizeDocumentStatuses(documentsQuery.data ?? []), [documentsQuery.data]);

  const openDocument = (payload: string, documentKind: Exclude<DocumentKindFilter, "all">) => {
    const resume = persistDocumentResume(window.sessionStorage, payload, documentKind);
    setLocation(resume.path);
  };

  if (!isAuthenticated) {
    return <div className="app-page"><PublicHeader /><main className="document-center-gate shell"><span><FolderArchive size={31} /></span><p className="page-kicker">DOCUMENT CENTER</p><h1>ศูนย์เอกสาร<br />ของธุรกิจคุณ</h1><p>{loading ? "กำลังตรวจสอบสถานะบัญชีของคุณ..." : "เข้าสู่ระบบเพื่อค้นหา จัดกลุ่ม และติดตามเอกสารธุรกิจที่คุณบันทึกไว้ในที่เดียว"}</p><button type="button" onClick={startLogin} className="button button-primary"><LogIn size={17} /> เข้าสู่ระบบเพื่อดูเอกสาร</button><Link href="/" className="text-button"><ArrowLeft size={16} /> กลับหน้าหลัก</Link></main><PublicFooter /></div>;
  }

  return <div className="app-page document-center-page"><SeoMeta title="ศูนย์เอกสารธุรกิจของฉัน | Tools Thai" description="จัดการ ค้นหา และติดตามสถานะเอกสารธุรกิจที่บันทึกไว้ในบัญชี Tools Thai" canonicalPath="/documents" /><PublicHeader /><main className="document-center-workspace"><div className="shell"><section className="document-center-hero"><div><Link href="/tools" className="back-link"><ArrowLeft size={15} /> เครื่องมือทั้งหมด</Link><p className="page-kicker">DOCUMENT CENTER</p><h1>เอกสารของฉัน</h1><p>ค้นหา ติดตามสถานะ และกลับมาทำงานต่อกับเอกสารธุรกิจของคุณได้ทุกเมื่อ</p></div><Link href="/quotation" className="button button-primary"><FilePlus2 size={17} /> สร้างเอกสารใหม่</Link></section>

  <section className="document-center-stat-grid" aria-label="สรุปเอกสาร"><article><span className="document-center-stat-icon"><FileText size={18} /></span><div><small>เอกสารที่แสดง</small><strong>{summary.total}</strong></div></article><article><span className="document-center-stat-icon amber"><Send size={18} /></span><div><small>รอติดตาม</small><strong>{summary.awaiting}</strong></div></article><article><span className="document-center-stat-icon green"><CheckCircle2 size={18} /></span><div><small>ชำระแล้ว</small><strong>{summary.paid}</strong></div></article></section>

  <section className="document-center-panel"><div className="document-center-toolbar"><label className="document-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเลขที่เอกสารหรือชื่อลูกค้า" aria-label="ค้นหาเอกสาร" /></label><div className="document-filter-row"><label><span>ประเภท</span><select value={kind} onChange={(event) => setKind(event.target.value as DocumentKindFilter)}><option value="all">ทุกประเภท</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>สถานะ</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">ทุกสถานะ</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" className={includeArchived ? "archive-filter is-active" : "archive-filter"} onClick={() => setIncludeArchived((value) => !value)}><FolderArchive size={16} /> {includeArchived ? "กำลังดูคลัง" : "ดูคลัง"}</button></div></div>
    {notice && <div className="document-center-notice">{notice}<button type="button" onClick={() => setNotice("")} aria-label="ปิดข้อความ">×</button></div>}
    {documentsQuery.isLoading ? <div className="document-center-empty"><FileText size={28} /><span className="document-center-registry">DOCUMENT REGISTRY</span><strong>กำลังจัดเตรียมเอกสารของคุณ...</strong></div> : documentsQuery.isError ? <div className="document-center-empty"><FileText size={28} /><span className="document-center-registry">DOCUMENT REGISTRY</span><strong>ไม่สามารถโหลดเอกสารได้</strong><span>กรุณารีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง</span></div> : documentsQuery.data?.length ? <div className="document-center-list">{documentsQuery.data.map((document) => <article key={document.id} className="document-center-row"><div className="document-kind-token"><FileText size={18} /><span>{document.kind === "delivery-note" ? "DN" : document.kind === "tax-invoice" ? "TI" : document.kind.slice(0, 2).toUpperCase()}</span></div><div className="document-row-main"><div className="document-row-heading"><strong>{document.documentNumber}</strong><span className={`document-status status-${document.status}`}>{statusLabels[document.status]}</span>{document.archivedAt && <span className="document-status status-archived">เก็บถาวร</span>}</div><span>{kindLabels[document.kind]} · {document.customerName || "ไม่ระบุลูกค้า"}</span><small>แก้ไขล่าสุด {formatDate(document.updatedAt)}</small></div><div className="document-row-controls"><label className="document-status-select"><span className="sr-only">เปลี่ยนสถานะเอกสาร</span><select value={document.status} disabled={updateStatus.isPending || Boolean(document.archivedAt)} onChange={(event) => updateStatus.mutate({ id: document.id, status: event.target.value as DocumentStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="document-row-action" onClick={() => openDocument(document.payload, document.kind)}><ChevronRight size={16} /> เปิด</button><button type="button" className="document-row-action" disabled={duplicate.isPending} onClick={() => duplicate.mutate({ id: document.id })}><Copy size={15} /> สำเนา</button><button type="button" className="document-row-action subtle" disabled={setArchived.isPending} onClick={() => setArchived.mutate({ id: document.id, archived: !document.archivedAt })}>{document.archivedAt ? <><RotateCcw size={15} /> กู้คืน</> : <><Archive size={15} /> เก็บ</>}</button></div></article>)}</div> : <div className="document-center-empty"><WalletCards size={29} /><span className="document-center-registry">ทะเบียนเอกสาร · DOCUMENT REGISTRY</span><strong>{includeArchived ? "ยังไม่มีเอกสารในคลัง" : "ยังไม่พบเอกสาร"}</strong><span>{query || kind !== "all" || status !== "all" ? "ลองเปลี่ยนคำค้นหาหรือตัวกรองอีกครั้ง" : "สร้างเอกสารและบันทึกเข้าบัญชี เพื่อจัดการเอกสารได้จากหน้านี้"}</span>{!includeArchived && <Link href="/quotation" className="button button-primary"><FilePlus2 size={16} /> สร้างใบเสนอราคา</Link>}</div>}</section></div></main><PublicFooter /></div>;
}

import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { Archive, ArrowLeft, Copy, FileClock, FileText, FolderArchive, History, Loader2, MoreHorizontal, Pencil, Search, Send, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

type DocumentKind = "quotation" | "invoice" | "receipt" | "delivery-note" | "tax-invoice";
type DocumentStatus = "draft" | "sent" | "paid" | "overdue";

const kindLabels: Record<DocumentKind, string> = { quotation: "ใบเสนอราคา", invoice: "ใบแจ้งหนี้", receipt: "ใบเสร็จรับเงิน", "delivery-note": "ใบส่งของ", "tax-invoice": "ใบกำกับภาษี" };
const statusLabels: Record<DocumentStatus, string> = { draft: "ฉบับร่าง", sent: "ส่งแล้ว", paid: "ชำระแล้ว", overdue: "เกินกำหนด" };
const statusClass: Record<DocumentStatus, string> = { draft: "document-status--draft", sent: "document-status--sent", paid: "document-status--paid", overdue: "document-status--overdue" };
const formatDate = (value: Date | string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const exportSummary = (count: number | undefined, lastExportAt: Date | string | null | undefined) => count ? `ส่งออก PDF ${count} ครั้ง${lastExportAt ? ` · ล่าสุด ${formatDate(lastExportAt)}` : ""}` : "ยังไม่ส่งออก PDF";

export default function DocumentCenter() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | DocumentKind>("all");
  const [status, setStatus] = useState<"all" | DocumentStatus>("all");
  const [archived, setArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const utils = trpc.useUtils();
  const listInput = useMemo(() => ({ search: search.trim() || undefined, kind: kind === "all" ? undefined : kind, status: status === "all" ? undefined : status, archived }), [archived, kind, search, status]);
  const documentsQuery = trpc.documents.list.useQuery(listInput, { enabled: isAuthenticated });
  const exportsQuery = trpc.documents.listExports.useQuery({ documentId: selectedId ?? 1 }, { enabled: selectedId !== null && isAuthenticated });
  const invalidate = () => void utils.documents.list.invalidate();
  const updateStatus = trpc.documents.updateStatus.useMutation({ onSuccess: () => { invalidate(); setFeedback("อัปเดตสถานะเอกสารแล้ว"); }, onError: () => setFeedback("ไม่สามารถอัปเดตสถานะเอกสารได้ กรุณาลองใหม่") });
  const setArchivedMutation = trpc.documents.setArchived.useMutation({ onSuccess: () => { invalidate(); setFeedback("อัปเดตการเก็บถาวรแล้ว"); }, onError: () => setFeedback("ไม่สามารถเปลี่ยนสถานะการเก็บถาวรได้ กรุณาลองใหม่") });
  const duplicate = trpc.documents.duplicate.useMutation({ onSuccess: () => { invalidate(); setFeedback("ทำสำเนาเอกสารเป็นฉบับร่างแล้ว"); }, onError: () => setFeedback("ไม่สามารถทำสำเนาเอกสารได้ กรุณาลองใหม่") });
  const openEditor = (item: { kind: DocumentKind; payload: string }) => { window.sessionStorage.setItem("toolsThai.convertedDocument", item.payload); setLocation(`/${item.kind}`); };

  if (loading) return <div className="document-center-loading"><Loader2 size={22} className="animate-spin" /> กำลังตรวจสอบบัญชีผู้ใช้</div>;
  if (!isAuthenticated) return <main className="document-center-guest"><FileText size={34} /><h1>คลังเอกสารของคุณ</h1><p>เข้าสู่ระบบเพื่อค้นหา จัดสถานะ และจัดเก็บเอกสารธุรกิจอย่างเป็นระเบียบ</p><button type="button" className="button button-download" onClick={startLogin}>เข้าสู่ระบบเพื่อเปิดคลังเอกสาร</button></main>;

  const documents = documentsQuery.data ?? [];
  const selected = documents.find((item) => item.id === selectedId);
  return <div className="app-page document-center-page"><main className="document-center-shell">
    <header className="document-center-hero"><div><Link href="/tools" className="back-link"><ArrowLeft size={16} /> เครื่องมือทั้งหมด</Link><p className="eyebrow">Document Center</p><h1>คลังเอกสารธุรกิจ</h1><p>ค้นหา ติดตามสถานะ และกลับไปทำงานกับเอกสารของคุณได้จากที่เดียว</p></div><div className="document-center-summary"><FolderArchive size={22} /><span>เอกสารที่แสดง</span><strong>{documents.length}</strong></div></header>
    <section className="document-center-controls" aria-label="ค้นหาและกรองเอกสาร"><label className="document-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาเลขเอกสาร หรือชื่อลูกค้า" /></label><select value={kind} onChange={(event) => setKind(event.target.value as "all" | DocumentKind)} aria-label="ประเภทเอกสาร"><option value="all">ทุกประเภท</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value as "all" | DocumentStatus)} aria-label="สถานะเอกสาร"><option value="all">ทุกสถานะ</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" className={archived ? "filter-toggle is-active" : "filter-toggle"} onClick={() => setArchived((current) => !current)}><Archive size={16} /> {archived ? "กำลังดูรายการเก็บถาวร" : "ดูรายการเก็บถาวร"}</button></section>
    {feedback && <p className="document-center-feedback" role="status">{feedback}</p>}
    <section className="document-center-list" aria-live="polite">
      {documentsQuery.isLoading && <div className="document-center-empty"><Loader2 className="animate-spin" /> กำลังโหลดเอกสาร</div>}
      {documentsQuery.isError && <div className="document-center-empty"><FileText size={30} /><h2>ไม่สามารถโหลดคลังเอกสารได้</h2><p>ตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง</p><button type="button" className="row-action" onClick={() => void documentsQuery.refetch()}>ลองใหม่</button></div>}
      {!documentsQuery.isLoading && !documentsQuery.isError && documents.length === 0 && <div className="document-center-empty"><FileClock size={30} /><h2>{archived ? "ยังไม่มีเอกสารที่เก็บถาวร" : "ยังไม่มีเอกสารตามเงื่อนไขนี้"}</h2><p>บันทึกเอกสารจากหน้า editor แล้วจะกลับมาจัดการได้ที่นี่</p></div>}
      {!documentsQuery.isError && documents.map((item) => <article className="document-center-row" key={item.id}><div className="document-row-icon"><FileText size={20} /></div><div className="document-row-main"><div className="document-row-title"><strong>{item.documentNumber}</strong><span className={`document-status ${statusClass[item.status]}`}>{statusLabels[item.status]}</span></div><p>{kindLabels[item.kind]} · {item.customerName || "ยังไม่ระบุชื่อลูกค้า"}</p><small>แก้ไขล่าสุด {formatDate(item.updatedAt)}<span className="document-row-export"> · {exportSummary(item.exportCount, item.lastExportAt)}</span></small></div><div className="document-row-actions"><button type="button" className="row-action" onClick={() => openEditor(item)}><Pencil size={15} /> แก้ไข</button><label className="row-status-select"><Send size={15} /><span className="sr-only">เปลี่ยนสถานะ</span><select value={item.status} disabled={updateStatus.isPending} onChange={(event) => updateStatus.mutate({ id: item.id, status: event.target.value as DocumentStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="row-action" disabled={duplicate.isPending} onClick={() => duplicate.mutate({ id: item.id })}><Copy size={15} /> ทำสำเนา</button><button type="button" className="row-action" disabled={setArchivedMutation.isPending} onClick={() => setArchivedMutation.mutate({ id: item.id, archived: !item.archivedAt })}>{item.archivedAt ? <Undo2 size={15} /> : <Archive size={15} />}{item.archivedAt ? "กู้คืน" : "เก็บถาวร"}</button><button type="button" className="row-action" onClick={() => setSelectedId(item.id)}><History size={15} /> PDF</button></div></article>)}
    </section>
    {selected && <div className="document-history-drawer" role="dialog" aria-modal="true" aria-labelledby="document-history-title"><div className="document-history-backdrop" onClick={() => setSelectedId(null)} /><section className="document-history-panel"><header><div><p className="eyebrow">PDF export history</p><h2 id="document-history-title">{selected.documentNumber}</h2></div><button type="button" className="icon-close" aria-label="ปิดประวัติ PDF" onClick={() => setSelectedId(null)}><MoreHorizontal /></button></header>{exportsQuery.isLoading ? <p className="history-state"><Loader2 className="animate-spin" /> กำลังโหลดประวัติ</p> : exportsQuery.isError ? <p className="history-state">ไม่สามารถโหลดประวัติ PDF ได้ <button type="button" className="row-action" onClick={() => void exportsQuery.refetch()}>ลองใหม่</button></p> : (exportsQuery.data?.length ? <ol className="export-history-list">{exportsQuery.data.map((entry) => <li key={entry.id}><FileText size={17} /><div><strong>{entry.filename}</strong><span>{formatDate(entry.createdAt)}</span></div></li>)}</ol> : <p className="history-state">ยังไม่มีประวัติการส่งออก PDF สำหรับเอกสารนี้</p>)}</section></div>}
  </main></div>;
}

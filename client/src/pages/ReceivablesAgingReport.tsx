import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarDays, ChartNoAxesCombined, CircleDollarSign, Download, FileSpreadsheet, Loader2, RefreshCcw, WalletCards } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import SeoMeta from "@/components/SeoMeta";
import { createAgingReportCsv, getAgingReportFilename } from "@/lib/agingCsv";
import { formatTHB } from "@/lib/document";
import { trpc } from "@/lib/trpc";

const methodLabels: Record<string, string> = { cash: "เงินสด", transfer: "โอนเงิน", card: "บัตร", cheque: "เช็ค", other: "อื่น ๆ" };
const statusLabels: Record<string, string> = { open: "รอรับชำระ", partial: "ชำระบางส่วน", overdue: "เกินกำหนด" };
const toDateInput = (value: Date) => value.toISOString().slice(0, 10);
const toMonthInput = (value: Date) => value.toISOString().slice(0, 7);
const formatDate = (value: Date | string) => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

export default function ReceivablesAgingReport() {
  const { isAuthenticated, loading } = useAuth();
  const [asOf, setAsOf] = useState("");
  const [month, setMonth] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  useEffect(() => { const now = new Date(); setAsOf(toDateInput(now)); setMonth(toMonthInput(now)); }, []);
  const reportInput = useMemo(() => ({ asOf: asOf || "2000-01-01", month: month || "2000-01" }), [asOf, month]);
  const reportQuery = trpc.receivables.agingReport.useQuery(reportInput, { enabled: isAuthenticated && Boolean(asOf && month) });
  const report = reportQuery.data;
  const exportCsv = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([createAgingReportCsv(report)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = getAgingReportFilename(asOf);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setExportMessage(`ดาวน์โหลด ${getAgingReportFilename(asOf)} แล้ว`);
  };

  if (!isAuthenticated) return <div className="app-page"><SeoMeta title="รายงานอายุลูกหนี้ | Tools Thai" description="รายงานอายุลูกหนี้และยอดรับชำระรายเดือนสำหรับธุรกิจไทย" canonicalPath="/receivables/report" /><PublicHeader /><main className="receivables-gate shell"><span className="receivables-gate-icon"><ChartNoAxesCombined size={27} /></span><p className="page-kicker">FINANCIAL REPORTING</p><h1>เห็นอายุลูกหนี้<br />ก่อนเงินจะขาดมือ</h1><p>{loading ? "กำลังตรวจสอบสถานะบัญชีของคุณ..." : "เข้าสู่ระบบเพื่อดูยอดคงค้างตามช่วงอายุ ตรวจยอดรับชำระรายเดือน และส่งออก CSV"}</p><button type="button" className="button button-primary" onClick={startLogin}>เข้าสู่ระบบเพื่อเปิดรายงาน</button><Link href="/receivables" className="text-button"><ArrowLeft size={16} /> กลับ Dashboard รับชำระ</Link></main><PublicFooter /></div>;

  return <div className="app-page aging-report-page"><SeoMeta title="รายงานอายุลูกหนี้ | Tools Thai" description="ตรวจยอดคงค้างตามช่วงอายุและยอดรับชำระรายเดือน พร้อม export CSV" canonicalPath="/receivables/report" /><PublicHeader /><main className="aging-report-workspace"><div className="shell">
    <header className="aging-report-hero"><div><Link href="/receivables" className="back-link"><ArrowLeft size={15} /> กลับ Dashboard รับชำระ</Link><p className="page-kicker">FINANCIAL REPORTING</p><h1>รายงานอายุลูกหนี้</h1><p>ดูยอดคงค้างตามวันครบกำหนด และสรุปเงินที่รับในเดือนที่เลือกจากข้อมูลการชำระของคุณ</p></div><div className="aging-report-actions"><label><CalendarDays size={16} /><span>วันอ้างอิง</span><input aria-label="วันอ้างอิงรายงาน" type="date" value={asOf} onChange={(event) => { setAsOf(event.target.value); setExportMessage(""); }} /></label><label><CalendarDays size={16} /><span>เดือนรับชำระ</span><input aria-label="เดือนรับชำระรายงาน" type="month" value={month} onChange={(event) => { setMonth(event.target.value); setExportMessage(""); }} /></label><button type="button" className="button button-primary" disabled={!report || reportQuery.isFetching} onClick={exportCsv}><Download size={16} /> Export CSV</button></div></header>
    {exportMessage && <p className="aging-export-message" role="status"><FileSpreadsheet size={16} /> {exportMessage}</p>}
    {reportQuery.isLoading && <section className="aging-report-state"><Loader2 className="animate-spin" /><strong>กำลังจัดทำรายงานจากข้อมูลลูกหนี้</strong><span>กำลังคำนวณยอดคงค้างและยอดรับชำระตามช่วงเวลาที่เลือก</span></section>}
    {reportQuery.isError && <section className="aging-report-state"><RefreshCcw size={22} /><strong>ไม่สามารถจัดทำรายงานได้</strong><span>กรุณาลองโหลดข้อมูลใหม่อีกครั้ง</span><button type="button" className="row-action" onClick={() => void reportQuery.refetch()}>ลองใหม่</button></section>}
    {report && <><section className="aging-key-metrics" aria-label="สรุปรายงาน"><Metric icon={<CircleDollarSign size={19} />} label="ยอดคงค้างทั้งหมด" value={formatTHB(Number(report.summary.outstanding))} note={`${report.summary.invoiceCount} ใบแจ้งหนี้`} /><Metric icon={<WalletCards size={19} />} label="รับชำระในเดือน" value={formatTHB(Number(report.summary.collectedThisMonth))} note={`${report.summary.paymentCount} รายการที่ไม่ถูกยกเลิก`} accent="blue" /><Metric icon={<CalendarDays size={19} />} label="วันอ้างอิง" value={formatDate(report.asOf)} note={`รายงานเดือน ${report.month}`} accent="sand" /></section>
    <section className="aging-buckets-card"><header><div><p className="page-kicker">OUTSTANDING BY AGE</p><h2>ยอดคงค้างตามอายุลูกหนี้</h2></div><span>นับอายุจากวันครบกำหนด ณ {formatDate(report.asOf)}</span></header><div className="aging-buckets-grid">{report.buckets.map((bucket) => <article className={`aging-bucket aging-bucket--${bucket.key}`} key={bucket.key}><span>{bucket.label}</span><strong>{formatTHB(Number(bucket.outstanding))}</strong><small>{bucket.count} ใบแจ้งหนี้</small></article>)}</div></section>
    <section className="aging-report-grid"><section className="aging-table-card"><header><div><p className="page-kicker">OUTSTANDING INVOICES</p><h2>รายละเอียดลูกหนี้คงค้าง</h2></div><span>{report.items.length} รายการ</span></header>{report.items.length ? <div className="aging-table-wrap"><table><thead><tr><th>เอกสาร / ลูกค้า</th><th>ครบกำหนด</th><th>อายุค้าง</th><th>ยอดคงเหลือ</th><th>สถานะ</th></tr></thead><tbody>{report.items.map((item) => <tr key={item.id}><td><strong>{item.documentNumber}</strong><span>{item.customerName}</span></td><td>{formatDate(item.dueDate)}</td><td><span className={item.daysPastDue ? "aging-days aging-days--late" : "aging-days"}>{item.daysPastDue ? `${item.daysPastDue} วัน` : "ยังไม่ถึงกำหนด"}</span></td><td><strong>{formatTHB(Number(item.outstanding))}</strong><small>จาก {formatTHB(Number(item.totalAmount))}</small></td><td><span className={`receivable-status ${item.status}`}>{statusLabels[item.status] || item.status}</span></td></tr>)}</tbody></table></div> : <div className="aging-empty"><CircleDollarSign size={25} /><strong>ไม่มีลูกหนี้คงค้าง ณ วันอ้างอิงนี้</strong><span>รายการที่ชำระครบหรือยกเลิกแล้วจะไม่ถูกรวมในรายงานอายุลูกหนี้</span></div>}</section>
      <aside className="aging-method-card"><header><p className="page-kicker">MONTHLY COLLECTIONS</p><h2>รับชำระตามช่องทาง</h2><span>เฉพาะรายการที่ไม่ถูกยกเลิก</span></header><div>{Object.entries(report.summary.collectedByMethod).map(([method, amount]) => <p key={method}><span>{methodLabels[method] || method}</span><strong>{formatTHB(Number(amount))}</strong></p>)}</div><button type="button" className="button button-ink" disabled={!report} onClick={exportCsv}><Download size={15} /> ส่งออก CSV รายเดือน</button></aside></section></>}
  </div></main><PublicFooter /></div>;
}

function Metric({ icon, label, value, note, accent = "teal" }: { icon: React.ReactNode; label: string; value: string; note: string; accent?: string }) { return <article className={`aging-metric aging-metric--${accent}`}><span>{icon}</span><small>{label}</small><strong>{value}</strong><em>{note}</em></article>; }

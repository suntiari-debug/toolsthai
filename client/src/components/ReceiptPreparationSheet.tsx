import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, CircleAlert, FileText, Loader2, WalletCards, X } from "lucide-react";
import { formatTHB } from "@/lib/document";
import { trpc } from "@/lib/trpc";

type ReceiptPreparationSheetProps = { receivableId: number | null; onClose: () => void };
const methodLabels: Record<string, string> = { cash: "เงินสด", transfer: "โอนเงิน", card: "บัตร", cheque: "เช็ค", other: "อื่น ๆ" };
const formatDate = (value: Date | string) => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
export const receiptPreparationEvent = "toolsThai:prepare-receipt";

export function openReceiptPreparation(receivableId: number) {
  window.dispatchEvent(new CustomEvent<number>(receiptPreparationEvent, { detail: receivableId }));
}

export function ReceiptPreparationPortal() {
  const [receivableId, setReceivableId] = useState<number | null>(null);
  useEffect(() => {
    const open = (event: Event) => { const id = (event as CustomEvent<number>).detail; if (Number.isInteger(id) && id > 0) setReceivableId(id); };
    window.addEventListener(receiptPreparationEvent, open);
    return () => window.removeEventListener(receiptPreparationEvent, open);
  }, []);
  return <ReceiptPreparationSheet receivableId={receivableId} onClose={() => setReceivableId(null)} />;
}

export function ReceiptPreparationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const listQuery = trpc.receivables.list.useQuery(undefined, { enabled: isOpen });
  const paidRows = (listQuery.data?.items || []).filter((item) => item.status === "paid");
  return <div className="receipt-menu"><button type="button" className="receipt-menu-trigger" aria-expanded={isOpen} aria-haspopup="dialog" onClick={() => setIsOpen((current) => !current)}><FileText size={15} /> ออกใบเสร็จ</button>{isOpen && <div className="receipt-menu-popover" role="dialog" aria-label="เลือกใบแจ้งหนี้ที่ชำระครบ"><header><strong>ออกใบเสร็จจากการชำระครบ</strong><button type="button" aria-label="ปิด" onClick={() => setIsOpen(false)}><X size={15} /></button></header>{listQuery.isLoading ? <p><Loader2 className="animate-spin" size={15} /> กำลังโหลดรายการ</p> : paidRows.length ? <ol>{paidRows.map((item) => <li key={item.id}><span><strong>{item.documentNumber}</strong><small>{item.customerName}</small></span><button type="button" onClick={() => { setIsOpen(false); openReceiptPreparation(item.id); }}>เตรียมใบเสร็จ</button></li>)}</ol> : <p className="receipt-muted">ยังไม่มีรายการที่ชำระครบ ระบบจะเปิดให้สร้างใบเสร็จเมื่อยอดคงเหลือเป็น ฿0.00</p>}</div>}</div>;
}

export default function ReceiptPreparationSheet({ receivableId, onClose }: ReceiptPreparationSheetProps) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const eligibility = trpc.receivables.receiptEligibility.useQuery({ receivableId: receivableId || 1 }, { enabled: receivableId !== null, retry: false });
  const createDraft = trpc.receivables.createReceiptDraft.useMutation({
    onSuccess: async (draft) => {
      window.sessionStorage.setItem("toolsThai.convertedDocument", draft.payload);
      await utils.documents.list.invalidate();
      await utils.receivables.get.invalidate();
      await utils.receivables.receiptEligibility.invalidate();
      onClose();
      setLocation("/receipt");
    },
  });

  useEffect(() => {
    if (receivableId === null) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, receivableId]);

  if (receivableId === null) return null;
  const data = eligibility.data;
  const hasDraft = Boolean(data?.receiptDraft);
  const canOpen = Boolean(data?.eligible || hasDraft);
  return <div className="receipt-sheet-layer" role="presentation"><button className="receipt-sheet-backdrop" type="button" aria-label="ปิดหน้าต่างเตรียมใบเสร็จ" onClick={onClose} /><section className="receipt-sheet" role="dialog" aria-modal="true" aria-labelledby="receipt-sheet-title"><header><div><p className="eyebrow">RECEIPT PREPARATION</p><h2 id="receipt-sheet-title">เตรียมออกใบเสร็จ</h2></div><button type="button" className="icon-close" aria-label="ปิดหน้าต่างเตรียมใบเสร็จ" onClick={onClose}><X size={19} /></button></header>{eligibility.isLoading ? <div className="receipt-sheet-state"><Loader2 className="animate-spin" /><strong>กำลังตรวจสอบสถานะรับชำระ</strong></div> : eligibility.isError ? <div className="receipt-sheet-state"><CircleAlert /><strong>ไม่สามารถตรวจข้อมูลรับชำระได้</strong><button type="button" className="row-action" onClick={() => void eligibility.refetch()}>ลองใหม่</button></div> : data ? <div className="receipt-sheet-body"><div className={data.eligible ? "receipt-completion is-paid" : "receipt-completion"}>{data.eligible ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}<div><strong>{data.eligible ? "ชำระครบแล้ว" : "ยังออกใบเสร็จไม่ได้"}</strong><span>{data.eligible ? `รับสุทธิ ${formatTHB(Number(data.receivable.paymentTotal))}` : data.reason}</span></div></div><section className="receipt-source-summary"><p>ใบแจ้งหนี้ต้นทาง</p><strong>{data.invoice.documentNumber}</strong><span>{data.invoice.customerName || data.receivable.customerName}</span><dl><div><dt>ยอดใบแจ้งหนี้</dt><dd>{formatTHB(Number(data.receivable.totalAmount))}</dd></div><div><dt>ยอดคงเหลือ</dt><dd>{formatTHB(Number(data.receivable.outstanding))}</dd></div></dl></section><section className="receipt-payment-summary"><div><WalletCards size={17} /><p>สรุปการรับชำระ</p></div>{data.payments.length ? <ol>{data.payments.map((payment) => <li key={payment.id}><span><strong>{methodLabels[payment.method] || payment.method}</strong><small>{formatDate(payment.paidAt)}{payment.reference ? ` · ${payment.reference}` : ""}</small></span><b>{formatTHB(Number(payment.amount))}</b></li>)}</ol> : <p className="receipt-muted">ไม่พบรายการรับชำระที่ยัง active</p>}</section>{data.receiptDraft && <div className="receipt-existing-draft"><FileText size={17} /><span>มีใบเสร็จฉบับร่างอยู่แล้ว<br /><strong>{data.receiptDraft.documentNumber}</strong></span></div>}{data.sourceChanged && <div className="receipt-source-warning" role="status"><CircleAlert size={16} /> ข้อมูลการรับชำระเปลี่ยนหลังสร้างฉบับร่าง โปรดตรวจ timeline ก่อนส่งออก PDF</div>}<div className="receipt-sheet-actions"><button type="button" className="workspace-action" onClick={onClose}>ยังไม่ออกตอนนี้</button><button type="button" className="button button-primary" disabled={!canOpen || createDraft.isPending} onClick={() => createDraft.mutate({ receivableId })}>{createDraft.isPending ? <><Loader2 className="animate-spin" size={16} /> กำลังเตรียม...</> : hasDraft ? <><FileText size={16} /> เปิดใบเสร็จฉบับร่าง</> : <><FileText size={16} /> เปิดฉบับร่างใบเสร็จ</>}</button></div>{createDraft.isError && <p className="form-error" role="status">{createDraft.error.message || "ไม่สามารถสร้างใบเสร็จฉบับร่างได้ กรุณาลองใหม่"}</p>}</div> : null}</section></div>;
}

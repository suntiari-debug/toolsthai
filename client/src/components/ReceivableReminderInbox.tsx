import { BellRing, Check, ChevronDown, Clock3, Loader2, RotateCcw, Settings2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { formatTHB } from "@/lib/document";
import { trpc } from "@/lib/trpc";

type ReminderItem = {
  id: number;
  receivableId: number;
  invoiceId: number;
  reminderType: "due-soon" | "overdue";
  dueDate: Date | string;
  outstandingAmount: string;
  documentNumber: string;
  customerName: string;
  status: "unread" | "read";
};

type ReceivableReminderInboxProps = {
  onOpenInvoice: (item: ReminderItem) => void;
  showSettings?: boolean;
  isAdmin?: boolean;
  compact?: boolean;
};

const dayOptions = [1, 3, 7];
const formatDate = (value: Date | string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(value));

export default function ReceivableReminderInbox({ onOpenInvoice, showSettings = false, isAdmin = false, compact = false }: ReceivableReminderInboxProps) {
  const utils = trpc.useUtils();
  const inboxQuery = trpc.receivables.reminderInbox.useQuery();
  const settingsQuery = trpc.receivables.reminderSettings.useQuery(undefined, { enabled: showSettings });
  const [enabled, setEnabled] = useState(false);
  const [daysBeforeDue, setDaysBeforeDue] = useState<number[]>([1, 3, 7]);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!settingsQuery.data) return;
    setEnabled(settingsQuery.data.enabled);
    setDaysBeforeDue(settingsQuery.data.daysBeforeDue);
  }, [settingsQuery.data]);

  const refreshInbox = async () => {
    await Promise.all([utils.receivables.reminderInbox.invalidate(), utils.receivables.reminderSettings.invalidate(), utils.receivables.list.invalidate()]);
  };
  const saveSettings = trpc.receivables.saveReminderSettings.useMutation({
    onSuccess: async (result) => {
      setFeedback(result.enabled ? "เปิดการเตือนในแอปแล้ว ระบบจะตรวจทุกวันเวลา 08:05 น." : "ปิดการเตือนแล้ว งานประจำวันถูกพักไว้");
      await refreshInbox();
    },
    onError: (error) => setFeedback(error.message || "บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองใหม่"),
  });
  const markRead = trpc.receivables.markReminderRead.useMutation({
    onSuccess: () => void utils.receivables.reminderInbox.invalidate(),
    onError: (error) => setFeedback(error.message || "ทำเครื่องหมายอ่านแล้วไม่สำเร็จ"),
  });
  const evaluateNow = trpc.receivables.evaluateRemindersNow.useMutation({
    onSuccess: async (result) => {
      setFeedback(result.skipped === "disabled" ? "ยังปิดการเตือนอยู่ จึงยังไม่มีการสร้างแจ้งเตือน" : `ตรวจแล้ว ${result.considered} รายการ · สร้างใหม่ ${result.created} รายการ · กันซ้ำ ${result.deduplicated} รายการ`);
      await refreshInbox();
    },
    onError: (error) => setFeedback(error.message || "ตรวจรายการไม่สำเร็จ กรุณาลองใหม่"),
  });

  const toggleDay = (day: number) => setDaysBeforeDue((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((left, right) => left - right));
  const save = () => {
    if (!daysBeforeDue.length) {
      setFeedback("โปรดเลือกจำนวนวันก่อนครบกำหนดอย่างน้อย 1 ค่า");
      return;
    }
    setFeedback("");
    saveSettings.mutate({ enabled, daysBeforeDue, timezone: "Asia/Bangkok" });
  };
  const openItem = (item: ReminderItem) => {
    if (item.status === "read") {
      onOpenInvoice(item);
      return;
    }
    markRead.mutate({ reminderId: item.id }, { onSuccess: () => onOpenInvoice(item) });
  };
  const inbox = inboxQuery.data;
  const unread = inbox?.counts.unread || 0;

  return <section className={`reminder-inbox ${compact ? "is-compact" : ""}`} aria-label="การเตือนติดตามลูกหนี้">
    <header className="reminder-inbox-heading"><div><span className="reminder-inbox-icon"><BellRing size={18} /></span><div><p className="page-kicker">REMINDER INBOX</p><h2>รายการที่ควรติดตาม</h2></div></div><span className={`reminder-unread-count ${unread ? "has-unread" : ""}`}>{unread ? `${unread} ใหม่` : "อ่านครบแล้ว"}</span></header>
    {!compact && <div className="reminder-counts" aria-label="สรุปการเตือนที่ยังไม่ได้อ่าน"><span><Clock3 size={15} /> ใกล้ครบกำหนด <b>{inbox?.counts.dueSoon || 0}</b></span><span><TriangleAlert size={15} /> เกินกำหนด <b>{inbox?.counts.overdue || 0}</b></span></div>}
    {feedback && <p className="reminder-feedback" role="status">{feedback}</p>}
    {inboxQuery.isLoading ? <p className="reminder-state"><Loader2 className="animate-spin" size={17} /> กำลังโหลดการเตือน</p> : inboxQuery.isError ? <div className="reminder-state"><TriangleAlert size={17} /> โหลดการเตือนไม่สำเร็จ <button type="button" onClick={() => void inboxQuery.refetch()}>ลองใหม่</button></div> : !inbox?.items.length ? <p className="reminder-state"><Check size={18} /> ยังไม่มีรายการที่ต้องติดตาม ระบบจะแจ้งเฉพาะยอดคงเหลือที่ใกล้ครบกำหนดหรือเกินกำหนด</p> : <ol className="reminder-list">{inbox.items.map((item) => <li className={`reminder-item ${item.reminderType} ${item.status === "read" ? "is-read" : ""}`} key={item.id}><span className="reminder-urgency">{item.reminderType === "overdue" ? <TriangleAlert size={16} /> : <Clock3 size={16} />}</span><div><strong>{item.reminderType === "overdue" ? "เกินกำหนดชำระ" : "ใกล้ครบกำหนด"}</strong><p>{item.documentNumber} · {item.customerName}</p><small>ครบกำหนด {formatDate(item.dueDate)} · ยอดคงเหลือ {formatTHB(Number(item.outstandingAmount))}</small></div><button type="button" className="reminder-open" disabled={markRead.isPending} onClick={() => openItem(item)}>{markRead.isPending && item.status === "unread" ? <Loader2 className="animate-spin" size={14} /> : null} เปิดใบแจ้งหนี้</button></li>)}</ol>}
    {showSettings && <details className="reminder-settings"><summary><Settings2 size={17} /> ตั้งค่าการเตือนของฉัน <ChevronDown size={16} /></summary><div className="reminder-settings-content"><label className="reminder-switch"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span><strong>เปิดการเตือนในแอป</strong><small>เมื่อเปิด ระบบจะประเมินยอดคงเหลือทุกวัน โดยไม่ส่งอีเมลหรือ SMS</small></span></label><fieldset><legend>แจ้งล่วงหน้าก่อนครบกำหนด</legend><div className="reminder-day-options">{dayOptions.map((day) => <label key={day}><input type="checkbox" checked={daysBeforeDue.includes(day)} onChange={() => toggleDay(day)} /><span>{day} วัน</span></label>)}</div></fieldset><p className="reminder-timezone">เขตเวลาเริ่มต้น: <b>Asia/Bangkok</b> · ตรวจรายวันเวลา 08:05 น.</p><div className="reminder-settings-actions"><button type="button" className="button button-primary" disabled={saveSettings.isPending || !daysBeforeDue.length} onClick={save}>{saveSettings.isPending ? <Loader2 className="animate-spin" size={16} /> : <BellRing size={16} />}{enabled ? "บันทึกและเปิดการเตือน" : "บันทึกการตั้งค่า"}</button>{isAdmin && <button type="button" className="text-icon-button reminder-evaluate" disabled={evaluateNow.isPending} onClick={() => evaluateNow.mutate()}>{evaluateNow.isPending ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />} ตรวจรายการที่ควรเตือนตอนนี้</button>}</div></div></details>}
  </section>;
}

import { Check, ChevronDown, CircleAlert, Loader2, Plus, Search, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import "../styles/customer-master.css";

type Customer = { id: number; customerType: "company" | "person"; name: string; taxId: string | null; address: string | null; contactName: string | null; phone: string | null; email: string | null; note: string | null; archivedAt: Date | string | null };
type CustomerPickerProps = { customerId?: number; onSelect: (customer: Customer) => void; onClear: () => void };
type CustomerForm = { customerType: "company" | "person"; name: string; taxId: string; address: string; contactName: string; phone: string; email: string; note: string };

const initialForm: CustomerForm = { customerType: "company", name: "", taxId: "", address: "", contactName: "", phone: "", email: "", note: "" };

export default function CustomerPicker({ customerId, onSelect, onClear }: CustomerPickerProps) {
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<Array<Pick<Customer, "id" | "name" | "taxId" | "archivedAt">>>([]);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const listInput = useMemo(() => ({ query: debouncedQuery || undefined, page: 1, pageSize: 6 }), [debouncedQuery]);
  const listQuery = trpc.customers.list.useQuery(listInput, { enabled: isOpen });
  const createCustomer = trpc.customers.create.useMutation({
    onSuccess: async (result) => {
      await utils.customers.list.invalidate();
      setCreatedCustomer(result.customer);
      setDuplicateMatches(result.duplicateMatches);
      if (!result.duplicateMatches.length) selectCustomer(result.customer);
    },
    onError: (error) => setFeedback(error.message || "ไม่สามารถสร้างข้อมูลลูกค้าได้"),
  });
  const selectCustomer = (customer: Customer) => {
    onSelect(customer);
    setIsOpen(false);
    setIsCreateOpen(false);
    setForm(initialForm);
    setCreatedCustomer(null);
    setDuplicateMatches([]);
    setFeedback("");
  };
  const create = () => {
    setFeedback("");
    createCustomer.mutate(form);
  };
  return <div className="customer-picker" data-preview-highlight="customer">
    <div className="customer-picker-heading"><div><strong>เลือกจากรายชื่อลูกค้า</strong><small>เลือกแล้วจะเติมข้อมูลในเอกสารนี้เท่านั้น</small></div>{customerId ? <button type="button" className="customer-picker-clear" onClick={onClear}><X size={14} /> เลิกเชื่อม</button> : null}</div>
    <div className="customer-picker-actions"><button type="button" className="customer-picker-trigger" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen}><UserRound size={16} /> {customerId ? "เปลี่ยนลูกค้าที่เลือก" : "ค้นหาและเลือกลูกค้า"}<ChevronDown size={15} /></button><button type="button" className="customer-picker-create" onClick={() => setIsCreateOpen(true)}><Plus size={16} /> เพิ่มลูกค้าใหม่</button></div>
    {customerId ? <p className="customer-picker-linked"><Check size={14} /> เชื่อมกับ Customer Master แล้ว — การแก้ช่องด้านล่างจะไม่เปลี่ยนข้อมูล master</p> : null}
    {isOpen ? <div className="customer-picker-popover"><label className="customer-picker-search"><Search size={15} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ เลขภาษี หรือผู้ติดต่อ" aria-label="ค้นหาลูกค้า" /></label>{listQuery.isLoading ? <p className="customer-picker-state"><Loader2 size={16} className="animate-spin" /> กำลังค้นหารายชื่อลูกค้า</p> : listQuery.isError ? <p className="customer-picker-state is-error"><CircleAlert size={16} /> ค้นหาไม่สำเร็จ <button type="button" onClick={() => void listQuery.refetch()}>ลองใหม่</button></p> : !listQuery.data?.items.length ? <p className="customer-picker-state">ไม่พบลูกค้า <button type="button" onClick={() => setIsCreateOpen(true)}>เพิ่มลูกค้าใหม่นี้</button></p> : <ul>{listQuery.data.items.map((customer) => <li key={customer.id}><button type="button" onClick={() => selectCustomer(customer)}><span><strong>{customer.name}</strong><small>{customer.customerType === "company" ? "นิติบุคคล" : "บุคคล"}{customer.taxId ? ` · ${customer.taxId}` : ""}{customer.contactName ? ` · ${customer.contactName}` : ""}</small></span><ChevronDown size={15} /></button></li>)}</ul>}</div> : null}
    <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) { setCreatedCustomer(null); setDuplicateMatches([]); setFeedback(""); } }}><DialogContent className="customer-create-dialog"><DialogHeader><DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle><DialogDescription>ข้อมูลนี้จะบันทึกใน Customer Master ของคุณ การแก้เอกสารภายหลังจะไม่เขียนทับข้อมูลนี้</DialogDescription></DialogHeader>{createdCustomer && duplicateMatches.length ? <div className="customer-duplicate-warning" role="status"><CircleAlert size={17} /><div><strong>พบข้อมูลคล้ายกันในรายชื่อลูกค้า</strong><p>{duplicateMatches.map((customer) => `${customer.name}${customer.taxId ? ` (${customer.taxId})` : ""}${customer.archivedAt ? " — เก็บถาวร" : ""}`).join(" · ")}</p><button type="button" onClick={() => selectCustomer(createdCustomer)}>ใช้ลูกค้าที่เพิ่มใหม่นี้</button></div></div> : <div className="customer-create-fields"><label>ประเภทลูกค้า<select value={form.customerType} onChange={(event) => setForm((current) => ({ ...current, customerType: event.target.value as "company" | "person" }))}><option value="company">บริษัท / นิติบุคคล</option><option value="person">บุคคล</option></select></label><label>ชื่อบริษัท / ชื่อลูกค้า<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={255} autoFocus /></label><label>เลขประจำตัวผู้เสียภาษี<input value={form.taxId} onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value.replace(/\D/g, "").slice(0, 13) }))} inputMode="numeric" placeholder="13 หลัก (หากมี)" /></label><label>ที่อยู่<textarea rows={2} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></label><div className="customer-create-split"><label>ผู้ติดต่อ<input value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} /></label><label>โทรศัพท์<input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label></div><label>อีเมล<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label></div>}{feedback ? <p className="customer-form-feedback" role="status">{feedback}</p> : null}<DialogFooter>{createdCustomer && duplicateMatches.length ? <button type="button" className="workspace-action" onClick={() => { setCreatedCustomer(null); setDuplicateMatches([]); }}>กลับไปแก้ไข</button> : <><button type="button" className="workspace-action" onClick={() => setIsCreateOpen(false)}>ยกเลิก</button><button type="button" className="button button-download" disabled={createCustomer.isPending || !form.name.trim()} onClick={create}>{createCustomer.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} บันทึกลูกค้า</button></>}</DialogFooter></DialogContent></Dialog>
  </div>;
}

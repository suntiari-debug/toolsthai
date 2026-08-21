import { ChangeEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FileClock, FileText, LogIn, Save, Upload, UserRound, WandSparkles } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { trpc } from "@/lib/trpc";

type ProfileForm = { name: string; address: string; taxId: string; phone: string; email: string; logoDataUrl: string; existingLogoUrl: string };
const emptyProfile: ProfileForm = { name: "", address: "", taxId: "", phone: "", email: "", logoDataUrl: "", existingLogoUrl: "" };

export default function Account() {
  const [, setLocation] = useLocation();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const profileQuery = trpc.companyProfile.get.useQuery(undefined, { enabled: isAuthenticated });
  const documentsQuery = trpc.documents.list.useQuery(undefined, { enabled: isAuthenticated });
  const saveProfile = trpc.companyProfile.save.useMutation({ onSuccess: () => profileQuery.refetch() });
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (!profileQuery.data) return;
    setProfile({ name: profileQuery.data.name || "", address: profileQuery.data.address || "", taxId: profileQuery.data.taxId || "", phone: profileQuery.data.phone || "", email: profileQuery.data.email || "", logoDataUrl: "", existingLogoUrl: profileQuery.data.logoUrl || "" });
  }, [profileQuery.data]);

  const handleLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 500_000) return;
    const reader = new FileReader();
    reader.onload = () => setProfile((current) => ({ ...current, logoDataUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    saveProfile.mutate(profile, {
      onSuccess: () => { setSavedMessage("บันทึก template บริษัทเรียบร้อยแล้ว"); window.setTimeout(() => setSavedMessage(""), 3500); },
      onError: () => { setSavedMessage("ไม่สามารถบันทึก template บริษัทได้ กรุณาลองใหม่อีกครั้ง"); window.setTimeout(() => setSavedMessage(""), 4500); },
    });
  };

  const openSavedDocument = (payload: string, kind: string) => {
    window.sessionStorage.setItem("toolsThai.convertedDocument", payload);
    setLocation(`/${kind}`);
  };

  if (!isAuthenticated) return <div className="app-page"><PublicHeader /><main className="account-gate shell"><span><UserRound size={30} /></span><p className="page-kicker">YOUR TOOLS THAI ACCOUNT</p><h1>บันทึกข้อมูล<br />เพื่อทำงานต่อได้เร็วขึ้น</h1><p>{loading ? "กำลังตรวจสอบสถานะบัญชีของคุณ..." : "เครื่องมือพื้นฐานใช้ได้ฟรีโดยไม่ต้องสมัคร แต่การเก็บ template บริษัทและประวัติเอกสารจะพร้อมใช้งานหลังเข้าสู่ระบบ"}</p><button type="button" onClick={startLogin} className="button button-primary"><LogIn size={17} /> เข้าสู่ระบบเพื่อบันทึกข้อมูล</button><Link href="/" className="text-button"><ArrowLeft size={16} /> กลับหน้าหลัก</Link></main><PublicFooter /></div>;

  return <div className="app-page account-page"><PublicHeader /><main className="account-workspace"><div className="shell"><div className="account-heading"><div><p className="page-kicker">ACCOUNT & SAVED WORK</p><h1>สวัสดี, {user?.name || "ผู้ใช้ Tools Thai"}</h1><p>จัดการข้อมูลบริษัทและกลับมาใช้เอกสารที่คุณบันทึกไว้</p></div><button type="button" className="text-icon-button" onClick={logout}>ออกจากระบบ</button></div>{savedMessage && <div className="account-message">{savedMessage}</div>}<div className="account-grid"><section className="account-card"><div className="account-card-title"><span className="account-title-icon"><WandSparkles size={18} /></span><div><h2>Template บริษัท</h2><p>ใช้เติมข้อมูลผู้ขายในเอกสารครั้งถัดไป</p></div></div>{profileQuery.isError && <p className="account-error">ไม่สามารถโหลด template บริษัทได้ กรุณารีเฟรชหน้าเว็บแล้วลองใหม่</p>}<div className="account-logo-row"><div className="account-logo">{profile.logoDataUrl || profile.existingLogoUrl ? <img src={profile.logoDataUrl || profile.existingLogoUrl} alt="โลโก้บริษัท" /> : <WandSparkles size={20} />}</div><label className="upload-label"><Upload size={15} /> เปลี่ยนโลโก้<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} /></label><span>สูงสุด 500 KB</span></div><div className="account-fields"><AccountField label="ชื่อบริษัท / ร้านค้า"><input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} placeholder="บริษัทของคุณ" /></AccountField><AccountField label="ที่อยู่"><textarea rows={3} value={profile.address} onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))} /></AccountField><div className="field-grid two-columns"><AccountField label="เลขประจำตัวผู้เสียภาษี"><input value={profile.taxId} onChange={(event) => setProfile((current) => ({ ...current, taxId: event.target.value }))} /></AccountField><AccountField label="โทรศัพท์"><input value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /></AccountField></div><AccountField label="อีเมล"><input type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} /></AccountField></div><button type="button" className="button button-primary account-save" disabled={saveProfile.isPending || !profile.name.trim()} onClick={handleSave}><Save size={16} /> {saveProfile.isPending ? "กำลังบันทึก..." : "บันทึก template บริษัท"}</button></section><section className="account-card document-history-card"><div className="account-card-title"><span className="account-title-icon coral"><FileClock size={18} /></span><div><h2>เอกสารที่บันทึกไว้</h2><p>เก็บได้จากหน้าเครื่องมือเอกสารเมื่อเข้าสู่ระบบ</p></div></div>{documentsQuery.isLoading ? <p className="history-empty">กำลังโหลดประวัติเอกสาร...</p> : documentsQuery.isError ? <div className="history-empty"><FileText size={25} /><strong>โหลดประวัติเอกสารไม่สำเร็จ</strong><span>กรุณารีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง</span></div> : documentsQuery.data?.length ? <div className="history-list">{documentsQuery.data.map((document) => <button key={document.id} type="button" onClick={() => openSavedDocument(document.payload, document.kind)} className="history-item"><span className="history-doc-icon"><FileText size={16} /></span><span><strong>{document.documentNumber}</strong><small>{document.customerName || "ไม่ระบุลูกค้า"} · {new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(document.updatedAt)}</small></span><i>{document.kind}</i></button>)}</div> : <div className="history-empty"><FileText size={25} /><strong>ยังไม่มีเอกสารที่บันทึก</strong><span>สร้างเอกสารแล้วกด “บันทึกเข้าบัญชี” เพื่อกลับมาแก้ไขในภายหลัง</span><Link href="/quotation" className="text-button">สร้างใบเสนอราคา <ArrowLeft size={15} className="flip-arrow" /></Link></div>}</section></div></div></main><PublicFooter /></div>;
}

function AccountField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="form-field"><span>{label}</span>{children}</label>; }

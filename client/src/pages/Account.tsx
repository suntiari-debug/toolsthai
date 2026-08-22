import { ChangeEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FileClock, FileText, LogIn, Save, Upload, UserRound, WandSparkles } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { trpc } from "@/lib/trpc";
import { readDocumentAssetAsDataUrl, validateDocumentAssetFile } from "@/lib/documentAssets";

type ProfileForm = { name: string; address: string; taxId: string; phone: string; email: string; signerName: string; signerPosition: string; logoDataUrl: string; existingLogoUrl: string; signatureDataUrl: string; existingSignatureUrl: string; stampDataUrl: string; existingStampUrl: string };
const emptyProfile: ProfileForm = { name: "", address: "", taxId: "", phone: "", email: "", signerName: "", signerPosition: "", logoDataUrl: "", existingLogoUrl: "", signatureDataUrl: "", existingSignatureUrl: "", stampDataUrl: "", existingStampUrl: "" };

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
    setProfile({ name: profileQuery.data.name || "", address: profileQuery.data.address || "", taxId: profileQuery.data.taxId || "", phone: profileQuery.data.phone || "", email: profileQuery.data.email || "", signerName: profileQuery.data.signerName || "", signerPosition: profileQuery.data.signerPosition || "", logoDataUrl: "", existingLogoUrl: profileQuery.data.logoUrl || "", signatureDataUrl: "", existingSignatureUrl: profileQuery.data.signatureUrl || "", stampDataUrl: "", existingStampUrl: profileQuery.data.stampUrl || "" });
  }, [profileQuery.data]);

  const handleImageAsset = async (event: ChangeEvent<HTMLInputElement>, field: "logoDataUrl" | "signatureDataUrl" | "stampDataUrl", label: string) => {
    const file = event.target.files?.[0];
    const validation = validateDocumentAssetFile(file, label);
    if (!validation.valid) { setSavedMessage(validation.message); return; }
    if (!file) return;
    try {
      const dataUrl = await readDocumentAssetAsDataUrl(file);
      setProfile((current) => ({ ...current, [field]: dataUrl }));
    } catch {
      setSavedMessage(`ไม่สามารถอ่านไฟล์${label}ได้ กรุณาลองใหม่อีกครั้ง`);
    } finally {
      event.target.value = "";
    }
  };

  const handleSave = () => {
    saveProfile.mutate(profile, {
      onSuccess: () => { setSavedMessage("บันทึก template บริษัทเรียบร้อยแล้ว"); window.setTimeout(() => setSavedMessage(""), 3500); },
      onError: () => { setSavedMessage("ไม่สามารถบันทึก template บริษัทได้ กรุณาลองใหม่อีกครั้ง"); window.setTimeout(() => setSavedMessage(""), 4500); },
    });
  };
  const removeProfileAsset = (dataField: "signatureDataUrl" | "stampDataUrl", existingField: "existingSignatureUrl" | "existingStampUrl") => {
    setProfile((current) => ({ ...current, [dataField]: "", [existingField]: "" }));
  };

  const openSavedDocument = (payload: string, kind: string) => {
    window.sessionStorage.setItem("toolsThai.convertedDocument", payload);
    setLocation(`/${kind}`);
  };

  if (!isAuthenticated) return <div className="app-page"><PublicHeader /><main className="account-gate shell"><span><UserRound size={30} /></span><p className="page-kicker">YOUR TOOLS THAI ACCOUNT</p><h1>บันทึกข้อมูล<br />เพื่อทำงานต่อได้เร็วขึ้น</h1><p>{loading ? "กำลังตรวจสอบสถานะบัญชีของคุณ..." : "เครื่องมือพื้นฐานใช้ได้ฟรีโดยไม่ต้องสมัคร แต่การเก็บ template บริษัทและประวัติเอกสารจะพร้อมใช้งานหลังเข้าสู่ระบบ"}</p><button type="button" onClick={startLogin} className="button button-primary"><LogIn size={17} /> เข้าสู่ระบบเพื่อบันทึกข้อมูล</button><Link href="/" className="text-button"><ArrowLeft size={16} /> กลับหน้าหลัก</Link></main><PublicFooter /></div>;

  return <div className="app-page account-page"><PublicHeader /><main className="account-workspace"><div className="shell"><div className="account-heading"><div><p className="page-kicker">ACCOUNT & SAVED WORK</p><h1>สวัสดี, {user?.name || "ผู้ใช้ Tools Thai"}</h1><p>จัดการข้อมูลบริษัทและกลับมาใช้เอกสารที่คุณบันทึกไว้</p></div><button type="button" className="text-icon-button" onClick={logout}>ออกจากระบบ</button></div>{savedMessage && <div className="account-message">{savedMessage}</div>}<div className="account-grid"><section className="account-card"><div className="account-card-title"><span className="account-title-icon"><WandSparkles size={18} /></span><div><h2>Template บริษัท</h2><p>ใช้เติมข้อมูลผู้ขาย ลายเซ็น ตรายาง และผู้ลงนามในเอกสารครั้งถัดไป</p></div></div>{profileQuery.isError && <p className="account-error">ไม่สามารถโหลด template บริษัทได้ กรุณารีเฟรชหน้าเว็บแล้วลองใหม่</p>}<div className="account-logo-row"><div className="account-logo">{profile.logoDataUrl || profile.existingLogoUrl ? <img src={profile.logoDataUrl || profile.existingLogoUrl} alt="โลโก้บริษัท" /> : <WandSparkles size={20} />}</div><label className="upload-label"><Upload size={15} /> เปลี่ยนโลโก้<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleImageAsset(event, "logoDataUrl", "โลโก้")} /></label><span>สูงสุด 500 KB</span></div><div className="account-document-assets"><AssetUpload label="ลายเซ็น" description="แสดงเหนือเส้นลงนาม" previewUrl={profile.signatureDataUrl || profile.existingSignatureUrl} onChange={(event) => void handleImageAsset(event, "signatureDataUrl", "ลายเซ็น")} onRemove={() => removeProfileAsset("signatureDataUrl", "existingSignatureUrl")} /><AssetUpload label="ตรายาง" description="แสดงคู่ลายเซ็นใน PDF" previewUrl={profile.stampDataUrl || profile.existingStampUrl} onChange={(event) => void handleImageAsset(event, "stampDataUrl", "ตรายาง")} onRemove={() => removeProfileAsset("stampDataUrl", "existingStampUrl")} /></div><div className="account-fields"><AccountField label="ชื่อบริษัท / ร้านค้า"><input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} placeholder="บริษัทของคุณ" /></AccountField><AccountField label="ที่อยู่"><textarea rows={3} value={profile.address} onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))} /></AccountField><div className="field-grid two-columns"><AccountField label="เลขประจำตัวผู้เสียภาษี"><input value={profile.taxId} onChange={(event) => setProfile((current) => ({ ...current, taxId: event.target.value }))} /></AccountField><AccountField label="โทรศัพท์"><input value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /></AccountField></div><AccountField label="อีเมล"><input type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} /></AccountField><div className="field-grid two-columns"><AccountField label="ชื่อผู้ลงนาม"><input value={profile.signerName} onChange={(event) => setProfile((current) => ({ ...current, signerName: event.target.value }))} placeholder="เช่น นายสมชาย ใจดี" /></AccountField><AccountField label="ตำแหน่งผู้ลงนาม"><input value={profile.signerPosition} onChange={(event) => setProfile((current) => ({ ...current, signerPosition: event.target.value }))} placeholder="เช่น กรรมการผู้จัดการ" /></AccountField></div></div><button type="button" className="button button-primary account-save" disabled={saveProfile.isPending || !profile.name.trim()} onClick={handleSave}><Save size={16} /> {saveProfile.isPending ? "กำลังบันทึก..." : "บันทึก template บริษัท"}</button></section><section className="account-card document-history-card"><div className="account-card-title"><span className="account-title-icon coral"><FileClock size={18} /></span><div><h2>เอกสารที่บันทึกไว้</h2><p>เก็บได้จากหน้าเครื่องมือเอกสารเมื่อเข้าสู่ระบบ</p></div></div>{documentsQuery.isLoading ? <p className="history-empty">กำลังโหลดประวัติเอกสาร...</p> : documentsQuery.isError ? <div className="history-empty"><FileText size={25} /><strong>โหลดประวัติเอกสารไม่สำเร็จ</strong><span>กรุณารีเฟรชหน้าเว็บแล้วลองใหม่อีกครั้ง</span></div> : documentsQuery.data?.length ? <div className="history-list">{documentsQuery.data.map((document) => <button key={document.id} type="button" onClick={() => openSavedDocument(document.payload, document.kind)} className="history-item"><span className="history-doc-icon"><FileText size={16} /></span><span><strong>{document.documentNumber}</strong><small>{document.customerName || "ไม่ระบุลูกค้า"} · {new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(document.updatedAt)}</small></span><i>{document.kind}</i></button>)}</div> : <div className="history-empty"><FileText size={25} /><strong>ยังไม่มีเอกสารที่บันทึก</strong><span>สร้างเอกสารแล้วกด “บันทึกเข้าบัญชี” เพื่อกลับมาแก้ไขในภายหลัง</span><Link href="/quotation" className="text-button">สร้างใบเสนอราคา <ArrowLeft size={15} className="flip-arrow" /></Link></div>}</section></div></div></main><PublicFooter /></div>;
}

function AccountField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="form-field"><span>{label}</span>{children}</label>; }
function AssetUpload({ label, description, previewUrl, onChange, onRemove }: { label: string; description: string; previewUrl: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void }) { return <div className="account-document-asset"><div className="account-document-asset-preview">{previewUrl ? <img src={previewUrl} alt={`ตัวอย่าง${label}`} /> : <WandSparkles size={17} />}</div><div><strong>{label}</strong><small>{description}</small></div><label className="upload-label"><Upload size={14} /> {previewUrl ? "เปลี่ยนรูป" : "อัปโหลด"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onChange} /></label>{previewUrl && <button type="button" className="asset-remove-button" onClick={onRemove}>ลบรูป</button>}</div>; }

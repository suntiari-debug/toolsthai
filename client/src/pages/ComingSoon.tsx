import { Link } from "wouter";
import { ArrowLeft, Construction } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="app-page">
      <PublicHeader />
      <main className="coming-soon shell">
        <span className="coming-icon"><Construction size={28} /></span>
        <p className="page-kicker">TOOLS THAI</p>
        <h1>{title}</h1>
        <p>เครื่องมือนี้กำลังจัดเตรียมให้ใช้งานเร็ว ๆ นี้ ระหว่างนี้คุณสามารถเริ่มทำเอกสารธุรกิจหรือคำนวณราคาขายได้ก่อน</p>
        <div className="coming-actions"><Link href="/quotation" className="button button-primary">สร้างใบเสนอราคา</Link><Link href="/" className="text-button"><ArrowLeft size={16} /> กลับหน้าหลัก</Link></div>
      </main>
      <PublicFooter />
    </div>
  );
}

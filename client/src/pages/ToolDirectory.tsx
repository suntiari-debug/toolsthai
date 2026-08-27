import { Link } from "wouter";
import { ArrowUpRight, Calculator, CircleDollarSign, FileCheck2, FileText, ReceiptText, Truck, WalletCards } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

const tools = [
  { href: "/quotation", icon: FileCheck2, title: "ใบเสนอราคา", copy: "สร้างใบเสนอราคาแบบมืออาชีพ พร้อม VAT ส่วนลด และโลโก้บริษัท", group: "เอกสารธุรกิจ" },
  { href: "/invoice", icon: FileText, title: "ใบแจ้งหนี้", copy: "ออกใบแจ้งหนี้หรือใบวางบิลจากข้อมูลเดิมได้ทันที", group: "เอกสารธุรกิจ" },
  { href: "/receipt", icon: ReceiptText, title: "ใบเสร็จรับเงิน", copy: "สร้างใบเสร็จรับเงินที่อ่านง่าย พร้อมหมายเหตุและลายเซ็น", group: "เอกสารธุรกิจ" },
  { href: "/tax-invoice", icon: FileText, title: "ใบกำกับภาษี", copy: "จัดเตรียมเอกสารภาษีจากรายการขายในรูปแบบพร้อมพิมพ์", group: "เอกสารธุรกิจ" },
  { href: "/delivery-note", icon: Truck, title: "ใบส่งของ", copy: "ทำใบส่งของและเอกสารแนบสำหรับการจัดส่งสินค้า", group: "เอกสารธุรกิจ" },
  { href: "/pricing-calculator", icon: Calculator, title: "คำนวณต้นทุนและราคาขาย", copy: "คำนวณราคาขายจากต้นทุน Margin Markup และ VAT", group: "เครื่องคำนวณธุรกิจ" },
  { href: "/vat-calculator", icon: WalletCards, title: "คำนวณ VAT", copy: "แยก VAT หรือรวม VAT จากยอดขายได้ในไม่กี่วินาที", group: "เครื่องคำนวณธุรกิจ" },
  { href: "/receivables", icon: CircleDollarSign, title: "ติดตามรับชำระ", copy: "ติดตามลูกหนี้ บันทึกการชำระบางส่วน และดูยอดคงเหลือ", group: "การเงินธุรกิจ" },
];

export default function ToolDirectory() {
  return (
    <div className="app-page">
      <PublicHeader />
      <main className="directory-page shell">
        <div className="page-kicker">TOOLS DIRECTORY</div>
        <h1>เครื่องมือที่ช่วยให้<br />งานธุรกิจไหลลื่นขึ้น</h1>
        <p className="page-lead">เลือกเครื่องมือที่ต้องการ ใช้งานฟรีได้ทันทีโดยไม่ต้องสมัครสมาชิก</p>
        <div className="directory-grid">
          {tools.map(({ href, icon: Icon, title, copy, group }) => (
            <Link key={href} href={href} className="directory-card">
              <span className="directory-icon"><Icon size={22} /></span>
              <span className="tool-group">{group}</span>
              <strong>{title}</strong>
              <span>{copy}</span>
              <i><ArrowUpRight size={18} /></i>
            </Link>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

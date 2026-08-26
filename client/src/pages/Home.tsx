import { Link } from "wouter";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Calculator, Check, CircleDollarSign,
  FileCheck2, FileOutput, FileText, LockKeyhole, ReceiptText, Sparkles, Truck,
} from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import SeoMeta from "@/components/SeoMeta";
import { trackLandingCtaClick, trackLandingToolCardClick } from "@/lib/analytics";
import { homeSeo } from "@shared/seo";

const documentTools = [
  { href: "/quotation", icon: FileCheck2, title: "ใบเสนอราคา", description: "เริ่มต้นการขายด้วยเอกสารที่ชัดเจนและน่าเชื่อถือ", accent: "coral" },
  { href: "/invoice", icon: FileText, title: "ใบแจ้งหนี้", description: "ต่อยอดจากใบเสนอราคา โดยไม่ต้องกรอกข้อมูลซ้ำ", accent: "blue" },
  { href: "/receipt", icon: ReceiptText, title: "ใบเสร็จรับเงิน", description: "ปิดงานอย่างเป็นระเบียบ พร้อมดาวน์โหลดเป็น PDF", accent: "gold" },
  { href: "/tax-invoice", icon: FileOutput, title: "ใบกำกับภาษี", description: "จัดรูปแบบเอกสารภาษีจากรายการขายได้เป็นระเบียบ", accent: "blue" },
  { href: "/delivery-note", icon: Truck, title: "ใบส่งของ", description: "แนบรายการสินค้าและข้อมูลการจัดส่งได้ครบถ้วน", accent: "green" },
];

const calculatorTools = [
  { href: "/pricing-calculator", icon: Calculator, title: "คำนวณต้นทุนและราคาขาย", description: "วางราคาขายจากต้นทุน Margin และ Markup" },
  { href: "/vat-calculator", icon: CircleDollarSign, title: "คำนวณ VAT", description: "คำนวณยอดก่อนภาษี ยอดภาษี และยอดสุทธิ" },
];

export default function Home() {
  return (
    <div className="app-page home-page">
      <SeoMeta title={homeSeo.title} description={homeSeo.description} canonicalPath={homeSeo.path} />
      <PublicHeader />
      <main>
        <section className="hero shell">
          <div className="hero-copy">
            <p className="eyebrow"><span /> BUSINESS UTILITIES, MADE FOR THAI WORK</p>
            <h1>เครื่องมือเอกสาร<br /><em>ธุรกิจออนไลน์ฟรี</em><br />สำหรับ SME ไทย</h1>
            <p className="hero-description">
              {homeSeo.intro}
            </p>
            <div className="hero-actions">
              <Link href="/quotation" className="button button-primary" onClick={() => trackLandingCtaClick("hero_primary", "/quotation")}>สร้างใบเสนอราคาฟรี <ArrowRight size={18} /></Link>
              <a href="#tools" className="text-button" onClick={() => trackLandingCtaClick("hero_tools", "#tools")}>ดูเครื่องมือทั้งหมด <ArrowDownIcon /></a>
            </div>
            <div className="hero-reassurance">
              <span><BadgeCheck size={17} /> ใช้ฟรี ไม่ต้องสมัคร</span>
              <span><LockKeyhole size={17} /> ข้อมูลไม่ถูกบันทึกโดยอัตโนมัติ</span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="hero-wash wash-one" />
            <div className="hero-wash wash-two" />
            <div className="hero-stamp">THAI<br />BUSINESS<br /><span>TOOLS</span></div>
            <div className="document-sheet floating-sheet">
              <div className="sheet-header">
                <span className="sheet-logo">T</span>
                <span className="sheet-type">ใบเสนอราคา<br /><small>QUOTATION</small></span>
              </div>
              <div className="sheet-rule" />
              <div className="sheet-meta"><span>ลูกค้า: บริษัท สมาร์ทเวิร์ค จำกัด</span><span>QT-2026-001</span></div>
              <div className="sheet-lines"><i /><i /><i /><i /></div>
              <div className="sheet-total"><span>ยอดรวมสุทธิ</span><strong>฿ 18,900</strong></div>
              <div className="sheet-footer">ออกแบบเพื่อการทำงานที่ชัดเจน</div>
            </div>
            <div className="hero-chip chip-top"><Check size={14} /> พร้อมส่ง PDF</div>
            <div className="hero-chip chip-bottom"><Sparkles size={14} /> กรอกครั้งเดียว ใช้ต่อได้</div>
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
          </div>
        </section>

        <section className="trust-strip">
          <div className="shell trust-list">
            <span>เอกสารธุรกิจ</span><b>•</b><span>คำนวณราคา</span><b>•</b><span>Export PDF</span><b>•</b><span>รองรับภาษาไทย</span><b>•</b><span>ใช้ได้ทุกอุปกรณ์</span>
          </div>
        </section>

        <section className="tools-section shell" id="tools">
          <div className="section-heading split-heading">
            <div><p className="eyebrow"><span /> เครื่องมือเอกสาร</p><h2>เอกสารครบ<br />เริ่มจากข้อมูลเดียว</h2></div>
            <p>ทำงานจากใบเสนอราคาใบแรก แล้วเปลี่ยนเป็นเอกสารในขั้นต่อไปโดยไม่ต้องพิมพ์รายละเอียดเดิมซ้ำ</p>
          </div>
          <div className="tool-card-grid">
            {documentTools.map(({ href, icon: Icon, title, description, accent }) => (
              <Link href={href} className={`tool-card card-${accent}`} key={href} onClick={() => trackLandingToolCardClick("document", href.slice(1))}>
                <div className="tool-icon"><Icon size={25} strokeWidth={1.75} /></div>
                <span className="tool-number">0{documentTools.findIndex((tool) => tool.href === href) + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="card-arrow"><ArrowUpRight size={19} /></span>
              </Link>
            ))}
          </div>
          <div className="document-flow" id="how-it-works">
            <div className="flow-label"><span>ทำงานต่อเนื่อง</span><strong>จากเอกสารหนึ่ง สู่ขั้นตอนถัดไป</strong></div>
            <div className="flow-steps"><span>ใบเสนอราคา</span><i /><span>ใบแจ้งหนี้</span><i /><span>ใบเสร็จรับเงิน</span><i /><span>ใบส่งของ</span></div>
            <Link href="/quotation" className="button button-ink" onClick={() => trackLandingCtaClick("document_flow", "/quotation")}>เริ่มจากใบเสนอราคา <ArrowRight size={17} /></Link>
          </div>
        </section>

        <section className="calculator-section" id="why-tools-thai">
          <div className="shell calculator-layout">
            <div className="calculator-visual">
              <div className="calc-glow" />
              <div className="calc-panel">
                <div className="calc-topline"><span>PRICING CALCULATOR</span><Calculator size={18} /></div>
                <div className="calc-field-row"><span>ต้นทุนต่อชิ้น</span><b>฿ 350</b></div>
                <div className="calc-field-row"><span>Margin ที่ต้องการ</span><b>35%</b></div>
                <div className="calc-result"><span>ราคาขายที่แนะนำ</span><strong>฿ 538</strong><small>รวม VAT แล้ว ฿ 575.66</small></div>
              </div>
            </div>
            <div className="calculator-copy">
              <p className="eyebrow light"><span /> เครื่องคำนวณธุรกิจ</p>
              <h2>รู้ตัวเลขก่อน<br />ตัดสินใจขาย</h2>
              <p>จากต้นทุนสู่ราคาขายที่เหมาะสม คำนวณ Margin, Markup และ VAT เพื่อให้ทุกการตัดสินใจมีตัวเลขรองรับ</p>
              <div className="calculator-links">
                {calculatorTools.map(({ href, icon: Icon, title, description }) => (
                  <Link href={href} key={href} className="calculator-link" onClick={() => trackLandingToolCardClick("calculator", href.slice(1))}><Icon size={21} /><span><strong>{title}</strong><small>{description}</small></span><ArrowUpRight size={18} /></Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="benefit-section shell">
          <div className="section-heading centered-heading"><p className="eyebrow"><span /> เรียบง่าย แต่คิดมาให้แล้ว</p><h2>ทำงานอย่างมืออาชีพ<br /><em>โดยไม่ต้องเริ่มจากศูนย์</em></h2></div>
          <div className="benefit-grid">
            <article><span className="benefit-index">01</span><h3>ฟรีสำหรับงานพื้นฐาน</h3><p>สร้างและดาวน์โหลดเอกสารสำคัญได้ทันที โดยไม่ต้องเปิดบัญชีผู้ใช้</p></article>
            <article><span className="benefit-index">02</span><h3>ไทยเป็นแกนหลัก</h3><p>ออกแบบ form, คำอธิบาย และรูปแบบเอกสารให้เหมาะกับวิธีทำงานของธุรกิจไทย</p></article>
            <article><span className="benefit-index">03</span><h3>ข้อมูลอยู่ในมือคุณ</h3><p>เริ่มใช้งานแบบไม่บันทึกข้อมูลได้ และเลือกบันทึก template เมื่อคุณพร้อม</p></article>
          </div>
        </section>

        <section className="cta-section shell">
          <div className="cta-card">
            <p className="eyebrow"><span /> เริ่มต้นวันนี้</p>
            <h2>เอกสารชิ้นถัดไปของคุณ<br />ควรทำได้ง่ายกว่านี้</h2>
            <Link href="/quotation" className="button button-primary" onClick={() => trackLandingCtaClick("bottom_primary", "/quotation")}>สร้างใบเสนอราคา ฟรี <ArrowRight size={18} /></Link>
            <span className="cta-note">ไม่ต้องสมัครสมาชิก · ใช้งานได้ทันที</span>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function ArrowDownIcon() {
  return <span className="tiny-down">↓</span>;
}

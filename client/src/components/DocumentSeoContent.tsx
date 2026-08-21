import { ArrowRight, CheckCircle2, FileText, HelpCircle, ListChecks } from "lucide-react";
import { Link } from "wouter";
import { getDocumentSeo } from "@shared/seo";

export default function DocumentSeoContent({ kind }: { kind: string }) {
  const seo = getDocumentSeo(kind);
  if (!seo) return null;
  return <section className="seo-document-content shell" aria-label={`คู่มือการใช้งาน${seo.h1}`}>
    <div className="seo-content-intro"><p className="page-kicker">GUIDE & ANSWERS</p><h2>{seo.howToTitle}</h2><p>เครื่องมือของ Tools Thai ออกแบบให้คุณเริ่มทำเอกสารได้ทันที พร้อมตรวจข้อมูลและดูตัวอย่างเอกสารก่อนดาวน์โหลด PDF ได้ทุกครั้ง</p></div>
    <div className="seo-content-grid">
      <section className="seo-guide-card"><span className="seo-card-icon"><FileText size={20} /></span><h3>วิธีใช้งาน</h3><ol className="seo-step-list">{seo.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol></section>
      <section className="seo-guide-card"><span className="seo-card-icon coral"><ListChecks size={20} /></span><h3>{seo.checklistTitle}</h3><ul className="seo-check-list">{seo.checklist.map((item) => <li key={item}><CheckCircle2 size={17} /><span>{item}</span></li>)}</ul></section>
    </div>
    <section className="seo-faq-section"><div className="seo-section-heading"><span className="seo-card-icon gold"><HelpCircle size={20} /></span><div><p className="page-kicker">FAQ</p><h2>คำถามที่พบบ่อย</h2></div></div><div className="seo-faq-grid">{seo.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>
    <section className="seo-related-tools" aria-label="เครื่องมือที่เกี่ยวข้อง"><div><p className="page-kicker">CONTINUE YOUR WORKFLOW</p><h2>ทำงานต่อด้วยเครื่องมือที่เกี่ยวข้อง</h2></div><div className="seo-related-links">{seo.related.map((item) => <Link href={item.href} key={item.href} className="seo-related-link"><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight size={17} /></Link>)}</div></section>
  </section>;
}

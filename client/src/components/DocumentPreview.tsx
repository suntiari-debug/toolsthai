import type { CSSProperties } from "react";
import { BusinessDocument, calculateDocumentTotals, documentMeta, formatNumber, formatTHB, formatThaiDate, amountToThaiWords } from "@/lib/document";
import type { PreviewPan } from "@/lib/previewZoom";

type DocumentPreviewProps = {
  document: BusinessDocument;
  accentColor?: string;
  template?: "modern" | "classic" | "minimal";
  screenZoom?: -1 | 0 | 1;
  screenPan?: PreviewPan;
};

export default function DocumentPreview({ document, accentColor = "#0d7a75", template = "classic", screenZoom = 0, screenPan = { x: 0, y: 0 } }: DocumentPreviewProps) {
  const totals = calculateDocumentTotals(document);
  const meta = documentMeta[document.kind];
  const zoomClass = screenZoom === -1 ? "preview-zoom-out" : screenZoom === 1 ? "preview-zoom-in" : "preview-zoom-default";
  return (
    <article className={`document-preview ${zoomClass}`} id="printable-document" data-template={template} style={{ "--document-accent": accentColor, "--preview-pan-x": `${screenPan.x}px`, "--preview-pan-y": `${screenPan.y}px` } as CSSProperties}>
      {document.watermark && <div className="document-watermark">TOOLS THAI</div>}
      <header className="pdf-header">
        <div className="pdf-company">
          {document.company.logoUrl ? <img className="pdf-logo" src={document.company.logoUrl} alt="โลโก้บริษัท" /> : null}
          <div>
            <p className="pdf-company-name">{document.company.name || "ชื่อบริษัทของคุณ"}</p>
            <p>{document.company.address || "ที่อยู่บริษัท"}</p>
            <p>{[document.company.taxId && `เลขผู้เสียภาษี: ${document.company.taxId}`, document.company.phone && `โทร: ${document.company.phone}`, document.company.email && `อีเมล: ${document.company.email}`].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="pdf-title"><p>{meta.title}</p><span>{meta.english}</span></div>
      </header>
      <section className="pdf-customer-meta-row">
        <div className="pdf-customer-section">
          <p className="pdf-section-label">ลูกค้า / BILL TO</p>
          <p className="pdf-customer-name">{document.customer.name || "ชื่อลูกค้า / บริษัทลูกค้า"}</p>
          <p>{document.customer.address || "ที่อยู่ลูกค้า"}</p>
          {(document.customer.taxId || document.customer.contact) && <p>{[document.customer.taxId && `เลขผู้เสียภาษี: ${document.customer.taxId}`, document.customer.contact].filter(Boolean).join(" · ")}</p>}
        </div>
        <div className="pdf-document-meta"><div><span>เลขที่เอกสาร</span><strong>{document.documentNumber || "—"}</strong></div><div><span>วันที่</span><strong>{formatThaiDate(document.issueDate)}</strong></div>{document.kind !== "receipt" && <div><span>ใช้ได้ถึง</span><strong>{formatThaiDate(document.dueDate)}</strong></div>}</div>
      </section>
      <table className="pdf-items-table">
        <thead><tr><th>#</th><th>รายการ</th><th className="align-right">จำนวน</th><th className="align-right">ราคาต่อหน่วย</th><th className="align-right">รวม</th></tr></thead>
        <tbody>{document.items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><strong>{item.name || "—"}</strong>{item.description && <small>{item.description}</small>}</td><td className="align-right">{formatNumber(item.quantity)}</td><td className="align-right">{formatTHB(item.unitPrice)}</td><td className="align-right">{formatTHB(item.quantity * item.unitPrice)}</td></tr>)}</tbody>
      </table>
      <section className="pdf-bottom-grid">
        <div className="pdf-note"><span className="pdf-section-label">จำนวนเงิน (ตัวอักษร)</span><p className="pdf-amount-words">{amountToThaiWords(totals.total)}</p><span className="pdf-section-label note-label">หมายเหตุ</span><p>{document.note || "—"}</p></div>
        <div className="pdf-totals"><div><span>มูลค่าสินค้า / บริการ</span><strong>{formatTHB(totals.subtotal)}</strong></div>{totals.discount > 0 && <div><span>ส่วนลด</span><strong>-{formatTHB(totals.discount)}</strong></div>}{document.vatMode !== "none" && <div><span>ภาษีมูลค่าเพิ่ม {document.vatRate}%</span><strong>{formatTHB(totals.vat)}</strong></div>}<div className="pdf-grand-total"><span>ยอดสุทธิ (บาท)</span><strong>{formatTHB(totals.total)}</strong></div></div>
      </section>
      <footer className="pdf-signatures"><div className="pdf-signature-recipient"><div className="pdf-signature-artwork" /><i /><span>ผู้รับเอกสาร / ลูกค้า</span><small>วันที่ ____/____/____</small></div><div className="pdf-signature-company"><div className="pdf-signature-artwork">{document.signatureUrl && <img className="pdf-signature-image" src={document.signatureUrl} alt="ลายเซ็นผู้มีอำนาจ" />}{document.stampUrl && <img className="pdf-stamp-image" src={document.stampUrl} alt="ตรายางบริษัท" />}</div><i /><span>{document.signerName || "ผู้มีอำนาจลงนาม"}</span><small>วันที่ ____/____/____</small></div></footer>
    </article>
  );
}

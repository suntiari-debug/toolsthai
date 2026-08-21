import { BusinessDocument, calculateDocumentTotals, documentMeta, formatNumber, formatTHB, formatThaiDate, amountToThaiWords } from "@/lib/document";

export default function DocumentPreview({ document }: { document: BusinessDocument }) {
  const totals = calculateDocumentTotals(document);
  const meta = documentMeta[document.kind];
  return (
    <article className="document-preview" id="printable-document">
      {document.watermark && <div className="document-watermark">TOOLS THAI</div>}
      <header className="pdf-header">
        <div className="pdf-company">
          {document.company.logoUrl ? <img className="pdf-logo" src={document.company.logoUrl} alt="โลโก้บริษัท" /> : <span className="pdf-logo-placeholder">T</span>}
          <div>
            <p className="pdf-company-name">{document.company.name || "ชื่อบริษัทของคุณ"}</p>
            <p>{document.company.address || "ที่อยู่บริษัท"}</p>
            <p>{[document.company.taxId && `เลขประจำตัวผู้เสียภาษี ${document.company.taxId}`, document.company.phone, document.company.email].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="pdf-title"><p>{meta.title}</p><span>{meta.english}</span></div>
      </header>
      <div className="pdf-reference-row">
        <div><span>เลขที่เอกสาร</span><strong>{document.documentNumber || "—"}</strong></div>
        <div><span>วันที่ออกเอกสาร</span><strong>{formatThaiDate(document.issueDate)}</strong></div>
        {document.kind !== "receipt" && <div><span>ครบกำหนดชำระ</span><strong>{formatThaiDate(document.dueDate)}</strong></div>}
      </div>
      <section className="pdf-customer-section">
        <p className="pdf-section-label">ข้อมูลลูกค้า</p>
        <p className="pdf-customer-name">{document.customer.name || "ชื่อลูกค้า / บริษัทลูกค้า"}</p>
        <p>{document.customer.address || "ที่อยู่ลูกค้า"}</p>
        {(document.customer.taxId || document.customer.contact) && <p>{[document.customer.taxId && `เลขประจำตัวผู้เสียภาษี ${document.customer.taxId}`, document.customer.contact].filter(Boolean).join(" · ")}</p>}
      </section>
      <table className="pdf-items-table">
        <thead><tr><th>#</th><th>รายการ</th><th>จำนวน</th><th>หน่วย</th><th>ราคาต่อหน่วย</th><th className="align-right">จำนวนเงิน</th></tr></thead>
        <tbody>
          {document.items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><strong>{item.name || "—"}</strong>{item.description && <small>{item.description}</small>}</td><td>{formatNumber(item.quantity)}</td><td>{item.unit || "—"}</td><td>{formatTHB(item.unitPrice)}</td><td className="align-right">{formatTHB(item.quantity * item.unitPrice)}</td></tr>)}
        </tbody>
      </table>
      <section className="pdf-bottom-grid">
        <div className="pdf-note"><p className="pdf-section-label">หมายเหตุ</p><p>{document.note || "—"}</p><span>จำนวนเงิน (ตัวอักษร): {amountToThaiWords(totals.total)}</span></div>
        <div className="pdf-totals">
          <div><span>รวมเป็นเงิน</span><strong>{formatTHB(totals.subtotal)}</strong></div>
          {totals.discount > 0 && <div><span>ส่วนลด</span><strong>-{formatTHB(totals.discount)}</strong></div>}
          {document.vatMode !== "none" && <div><span>ภาษีมูลค่าเพิ่ม {document.vatRate}%</span><strong>{formatTHB(totals.vat)}</strong></div>}
          <div className="pdf-grand-total"><span>จำนวนเงินรวมทั้งสิ้น</span><strong>{formatTHB(totals.total)}</strong></div>
        </div>
      </section>
      <footer className="pdf-signatures">
        <div><span>ผู้จัดทำ</span><i /><small>( ______________________________ )</small></div>
        <div><span>ผู้รับเอกสาร</span><i /><small>( ______________________________ )</small></div>
      </footer>
    </article>
  );
}

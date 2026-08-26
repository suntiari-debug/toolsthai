import { type CSSProperties, useRef } from "react";
import { BusinessDocument, StampPosition, boundedLogoCrop, boundedLogoPosition, boundedLogoScale, boundedStampPosition, boundedStampRotation, boundedStampScale, calculateDocumentTotals, defaultLogoPosition, defaultLogoScale, defaultStampPosition, defaultStampRotation, defaultStampScale, documentMeta, formatNumber, formatTHB, formatThaiDate, amountToThaiWords } from "@/lib/document";
import { normalizeDocumentFontFamily, normalizeDocumentFontSize, type DocumentFontFamily, type DocumentFontSize } from "@/lib/documentDesign";
import type { PreviewHighlightTarget } from "@/lib/previewHighlight";
import type { PreviewPan } from "@/lib/previewZoom";

type DocumentPreviewProps = {
  document: BusinessDocument;
  id?: string;
  accentColor?: string;
  template?: "modern" | "classic" | "minimal";
  fontFamily?: DocumentFontFamily;
  fontSize?: DocumentFontSize;
  screenZoom?: -1 | 0 | 1;
  screenPan?: PreviewPan;
  activeHighlight?: PreviewHighlightTarget | null;
  isStampEditable?: boolean;
  onStampTransformChange?: (transform: { position: StampPosition; scale: number; rotation: number }) => void;
};

export default function DocumentPreview({ document, id = "printable-document", accentColor = "#0d7a75", template = "classic", fontFamily, fontSize, screenZoom = 0, screenPan = { x: 0, y: 0 }, activeHighlight = null, isStampEditable = false, onStampTransformChange }: DocumentPreviewProps) {
  const totals = calculateDocumentTotals(document);
  const meta = documentMeta[document.kind];
  const zoomClass = screenZoom === -1 ? "preview-zoom-out" : screenZoom === 1 ? "preview-zoom-in" : "preview-zoom-default";
  const stampArtworkRef = useRef<HTMLDivElement>(null);
  const stampPointer = useRef<{ action: "move" | "resize"; clientX: number; clientY: number; position: StampPosition; scale: number; rotation: number } | null>(null);
  const stampPosition = boundedStampPosition(document.stampPosition || defaultStampPosition);
  const stampScale = boundedStampScale(document.stampScale || defaultStampScale);
  const stampRotation = boundedStampRotation(document.stampRotation ?? defaultStampRotation);
  const logoPosition = boundedLogoPosition(document.logoPosition || defaultLogoPosition);
  const logoScale = boundedLogoScale(document.logoScale || defaultLogoScale);
  const logoCrop = boundedLogoCrop(document.logoCrop);
  const resolvedFontFamily = normalizeDocumentFontFamily(fontFamily ?? document.fontFamily);
  const resolvedFontSize = normalizeDocumentFontSize(fontSize ?? document.fontSize);
  const highlightClass = (target: PreviewHighlightTarget) => activeHighlight === target ? " is-preview-highlighted" : "";
  const startStampPointer = (event: React.PointerEvent<HTMLButtonElement>, action: "move" | "resize") => {
    if (!isStampEditable || !document.stampUrl || !onStampTransformChange) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    stampPointer.current = { action, clientX: event.clientX, clientY: event.clientY, position: stampPosition, scale: stampScale, rotation: stampRotation };
  };
  const moveStampPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const interaction = stampPointer.current;
    const area = stampArtworkRef.current;
    if (!interaction || !area || !onStampTransformChange) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = area.getBoundingClientRect();
    if (interaction.action === "move") {
      const position = boundedStampPosition({ x: interaction.position.x + ((event.clientX - interaction.clientX) / rect.width) * 100, y: interaction.position.y + ((event.clientY - interaction.clientY) / rect.height) * 100 });
      onStampTransformChange({ position, scale: interaction.scale, rotation: interaction.rotation });
      return;
    }
    const scale = boundedStampScale(interaction.scale + ((event.clientX - interaction.clientX) / rect.width) * 2.2);
    onStampTransformChange({ position: interaction.position, scale, rotation: interaction.rotation });
  };
  const endStampPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!stampPointer.current) return;
    event.stopPropagation();
    stampPointer.current = null;
  };
  return (
    <article className={`document-preview ${zoomClass}${highlightClass("document")}`} id={id} data-template={template} data-font-family={resolvedFontFamily} data-font-size={resolvedFontSize} data-preview-region="document" style={{ "--document-accent": accentColor, "--preview-pan-x": `${screenPan.x}px`, "--preview-pan-y": `${screenPan.y}px` } as CSSProperties}>
      {document.watermark && <div className="document-watermark">TOOLS THAI</div>}
      <header className={`pdf-header${highlightClass("company")}`} data-preview-region="company">
        <div className="pdf-company">
          {document.company.logoUrl ? <div className="pdf-logo-frame" style={{ "--logo-offset-x": `${logoPosition.x}px`, "--logo-offset-y": `${logoPosition.y}px`, "--logo-scale": String(logoScale), "--logo-crop-x": `${logoCrop.x}%`, "--logo-crop-y": `${logoCrop.y}%`, "--logo-crop-zoom": String(logoCrop.zoom), "--logo-brightness": `${logoCrop.brightness}%`, "--logo-contrast": `${logoCrop.contrast}%` } as CSSProperties}><img className="pdf-logo" src={document.company.logoUrl} alt="โลโก้บริษัท" /></div> : null}
          <div>
            <p className="pdf-company-name">{document.company.name || "ชื่อบริษัทของคุณ"}</p>
            <p>{document.company.address || "ที่อยู่บริษัท"}</p>
            <p>{[document.company.taxId && `เลขผู้เสียภาษี: ${document.company.taxId}`, document.company.phone && `โทร: ${document.company.phone}`, document.company.email && `อีเมล: ${document.company.email}`].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="pdf-title"><p>{meta.title}</p><span>{meta.english}</span></div>
      </header>
      <section className="pdf-customer-meta-row">
        <div className={`pdf-customer-section${highlightClass("customer")}`} data-preview-region="customer">
          <p className="pdf-section-label">ลูกค้า / BILL TO</p>
          <p className="pdf-customer-name">{document.customer.name || "ชื่อลูกค้า / บริษัทลูกค้า"}</p>
          <p>{document.customer.address || "ที่อยู่ลูกค้า"}</p>
          {(document.customer.taxId || document.customer.contact) && <p>{[document.customer.taxId && `เลขผู้เสียภาษี: ${document.customer.taxId}`, document.customer.contact].filter(Boolean).join(" · ")}</p>}
        </div>
        <div className={`pdf-document-meta${highlightClass("document-meta")}`} data-preview-region="document-meta"><div><span>เลขที่เอกสาร</span><strong>{document.documentNumber || "—"}</strong></div><div><span>วันที่</span><strong>{formatThaiDate(document.issueDate)}</strong></div>{document.kind !== "receipt" && <div><span>ใช้ได้ถึง</span><strong>{formatThaiDate(document.dueDate)}</strong></div>}</div>
      </section>
      <table className="pdf-items-table">
        <thead><tr><th>#</th><th>รายการ</th><th className="align-right">จำนวน</th><th className="align-right">ราคาต่อหน่วย</th><th className="align-right">รวม</th></tr></thead>
        <tbody>{document.items.map((item, index) => <tr key={item.id} className={highlightClass(`item:${item.id}`)} data-preview-region={`item:${item.id}`}><td>{index + 1}</td><td><strong>{item.name || "—"}</strong>{item.description && <small>{item.description}</small>}</td><td className="align-right">{formatNumber(item.quantity)}</td><td className="align-right">{formatTHB(item.unitPrice)}</td><td className="align-right">{formatTHB(item.quantity * item.unitPrice)}</td></tr>)}</tbody>
      </table>
      <section className="pdf-bottom-grid">
        <div className={`pdf-note${highlightClass("note")}`} data-preview-region="note"><span className="pdf-section-label">จำนวนเงิน (ตัวอักษร)</span><p className="pdf-amount-words">{amountToThaiWords(totals.total)}</p><span className="pdf-section-label note-label">หมายเหตุ</span><p>{document.note || "—"}</p></div>
        <div className={`pdf-totals${highlightClass("totals")}`} data-preview-region="totals"><div><span>มูลค่าสินค้า / บริการ</span><strong>{formatTHB(totals.subtotal)}</strong></div>{totals.discount > 0 && <div><span>ส่วนลด</span><strong>-{formatTHB(totals.discount)}</strong></div>}{document.vatMode !== "none" && <div><span>ภาษีมูลค่าเพิ่ม {document.vatRate}%</span><strong>{formatTHB(totals.vat)}</strong></div>}<div className="pdf-grand-total"><span>ยอดสุทธิ (บาท)</span><strong>{formatTHB(totals.total)}</strong></div></div>
      </section>
      <footer className={`pdf-signatures${highlightClass("signature")}`} data-preview-region="signature"><div className="pdf-signature-recipient"><div className="pdf-signature-artwork" /><i /><span>ผู้รับเอกสาร / ลูกค้า</span><small>วันที่ ____/____/____</small></div><div className="pdf-signature-company"><div className="pdf-signature-artwork" ref={stampArtworkRef}>{document.signatureUrl && <img className="pdf-signature-image" src={document.signatureUrl} alt="ลายเซ็นผู้มีอำนาจ" />}{document.stampUrl && <div className={`pdf-stamp-wrapper ${isStampEditable ? "is-editable" : ""}`} style={{ "--stamp-x": `${stampPosition.x}%`, "--stamp-y": `${stampPosition.y}%`, "--stamp-scale": String(stampScale), "--stamp-rotation": `${stampRotation}deg` } as CSSProperties}><img className="pdf-stamp-image" src={document.stampUrl} alt="ตรายางบริษัท" /><button type="button" className="stamp-drag-handle" aria-label="ลากย้ายตรายาง" onPointerDown={(event) => startStampPointer(event, "move")} onPointerMove={moveStampPointer} onPointerUp={endStampPointer} onPointerCancel={endStampPointer} onTouchStart={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()} data-html2canvas-ignore="true">ลาก</button><button type="button" className="stamp-resize-handle" aria-label="ลากปรับขนาดตรายาง" onPointerDown={(event) => startStampPointer(event, "resize")} onPointerMove={moveStampPointer} onPointerUp={endStampPointer} onPointerCancel={endStampPointer} onTouchStart={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()} data-html2canvas-ignore="true" /></div>}</div><i /><span>{document.signerName || "ผู้มีอำนาจลงนาม"}</span>{document.signerPosition && <em className="pdf-signer-position">{document.signerPosition}</em>}<small>วันที่ ____/____/____</small></div></footer>
    </article>
  );
}

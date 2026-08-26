export const pdfExportStages = [
  { id: "preparing", title: "กำลังเตรียมเอกสาร", detail: "ตรวจตัวอย่างและฟอนต์ภาษาไทย" },
  { id: "rendering", title: "กำลังเรนเดอร์ PDF", detail: "จัดวางเอกสารให้พร้อมดาวน์โหลด" },
  { id: "downloading", title: "กำลังเริ่มดาวน์โหลด", detail: "ไฟล์ PDF ของคุณพร้อมแล้ว" },
] as const;

export type PdfExportStage = (typeof pdfExportStages)[number]["id"];

export function getPdfExportStageIndex(stage: PdfExportStage) {
  return pdfExportStages.findIndex((item) => item.id === stage);
}

export async function runPdfExportLifecycle<TPrepared, TRendered>(input: {
  setStage: (stage: PdfExportStage | null) => void;
  prepare: () => Promise<TPrepared>;
  render: (prepared: TPrepared) => Promise<TRendered>;
  download: (rendered: TRendered) => Promise<void>;
}) {
  input.setStage("preparing");
  try {
    const prepared = await input.prepare();
    input.setStage("rendering");
    const rendered = await input.render(prepared);
    input.setStage("downloading");
    await input.download(rendered);
  } finally {
    input.setStage(null);
  }
}

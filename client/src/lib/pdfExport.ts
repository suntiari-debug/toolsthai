export function sanitizePdfFilename(value: string, fallback: string) {
  const normalize = (source: string) => source.trim().replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").replace(/-+/g, "-").replace(/^[-.\s]+|[-.\s]+$/g, "").slice(0, 180);
  return `${normalize(value) || normalize(fallback) || "tools-thai-document"}.pdf`;
}

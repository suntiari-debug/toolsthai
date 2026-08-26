const unsafeFilenameCharacters = /[\\/:*?"<>|]/g;

export function buildPdfFilename(source: string, fallback: string) {
  const baseName = source.trim().replace(/\.pdf$/i, "").replace(unsafeFilenameCharacters, "-").replace(/\s+/g, " ").trim();
  return `${baseName || fallback}.pdf`;
}

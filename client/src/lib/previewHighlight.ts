export const previewHighlightRegions = [
  "document",
  "company",
  "customer",
  "document-meta",
  "note",
  "totals",
  "signature",
] as const;

export type PreviewHighlightTarget = (typeof previewHighlightRegions)[number] | `item:${string}`;

export function getItemPreviewHighlightTarget(itemId: string): PreviewHighlightTarget {
  return `item:${itemId}`;
}

export function getPreviewHighlightTarget(value: string | undefined): PreviewHighlightTarget | null {
  const target = value?.trim();
  if (!target) return null;
  if ((previewHighlightRegions as readonly string[]).includes(target)) return target as PreviewHighlightTarget;
  return target.startsWith("item:") && target.slice(5).trim().length > 0 ? target as PreviewHighlightTarget : null;
}

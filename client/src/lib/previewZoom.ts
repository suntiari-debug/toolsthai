export type PreviewZoom = -1 | 0 | 1;

export function boundedPreviewZoom(value: number): PreviewZoom {
  if (value >= 1) return 1;
  if (value <= -1) return -1;
  return 0;
}

export function pinchZoomStep(startDistance: number, currentDistance: number, startZoom: PreviewZoom): PreviewZoom {
  if (!Number.isFinite(startDistance) || !Number.isFinite(currentDistance) || startDistance <= 0 || currentDistance <= 0) return startZoom;
  const ratio = currentDistance / startDistance;
  if (ratio >= 1.15) return boundedPreviewZoom(startZoom + 1);
  if (ratio <= 0.87) return boundedPreviewZoom(startZoom - 1);
  return startZoom;
}

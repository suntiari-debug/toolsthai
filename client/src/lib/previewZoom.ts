export type PreviewZoom = -1 | 0 | 1;
export type PreviewPan = { x: number; y: number };
export type PreviewScrollIndicator = { section: "ส่วนบน" | "ส่วนกลาง" | "ส่วนล่าง"; progress: number };

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

export function clampPreviewPan(pan: PreviewPan, limit: PreviewPan): PreviewPan {
  return {
    x: Math.min(0, Math.max(-Math.abs(limit.x), pan.x)),
    y: Math.min(0, Math.max(-Math.abs(limit.y), pan.y)),
  };
}

export function getPreviewScrollIndicator(panY: number, limitY: number): PreviewScrollIndicator {
  const safeLimit = Math.max(1, Math.abs(limitY));
  const progress = Math.round(Math.min(1, Math.max(0, Math.abs(panY) / safeLimit)) * 100);
  if (progress < 34) return { section: "ส่วนบน", progress };
  if (progress < 67) return { section: "ส่วนกลาง", progress };
  return { section: "ส่วนล่าง", progress };
}

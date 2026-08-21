import { describe, expect, it } from "vitest";
import { boundedPreviewZoom, clampPreviewPan, getPreviewScrollIndicator, pinchZoomStep } from "./previewZoom";

describe("preview zoom controls", () => {
  it("limits all requested levels to the supported range", () => {
    expect(boundedPreviewZoom(-10)).toBe(-1);
    expect(boundedPreviewZoom(0)).toBe(0);
    expect(boundedPreviewZoom(8)).toBe(1);
  });

  it("turns a pinch out gesture into one larger zoom level", () => {
    expect(pinchZoomStep(100, 116, 0)).toBe(1);
    expect(pinchZoomStep(100, 145, 1)).toBe(1);
  });

  it("turns a pinch in gesture into one smaller zoom level", () => {
    expect(pinchZoomStep(100, 86, 0)).toBe(-1);
    expect(pinchZoomStep(100, 70, -1)).toBe(-1);
  });

  it("keeps the current level for small two-finger movements", () => {
    expect(pinchZoomStep(100, 106, 0)).toBe(0);
  });

  it("keeps one-finger panning within the visible expanded-document bounds", () => {
    expect(clampPreviewPan({ x: -36, y: -125 }, { x: 70, y: 180 })).toEqual({ x: -36, y: -125 });
    expect(clampPreviewPan({ x: -120, y: -250 }, { x: 70, y: 180 })).toEqual({ x: -70, y: -180 });
    expect(clampPreviewPan({ x: 25, y: 30 }, { x: 70, y: 180 })).toEqual({ x: 0, y: 0 });
  });

  it("labels the visible A4 area from the vertical pan position", () => {
    expect(getPreviewScrollIndicator(0, 188)).toEqual({ section: "ส่วนบน", progress: 0 });
    expect(getPreviewScrollIndicator(-94, 188)).toEqual({ section: "ส่วนกลาง", progress: 50 });
    expect(getPreviewScrollIndicator(-188, 188)).toEqual({ section: "ส่วนล่าง", progress: 100 });
  });
});

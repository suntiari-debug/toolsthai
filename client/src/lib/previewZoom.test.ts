import { describe, expect, it } from "vitest";
import { boundedPreviewZoom, clampPreviewPan, getPreviewScrollIndicator, getPreviewZoomDevice, getPreviewZoomStorageKey, isDoubleTap, parseStoredPreviewZoom, pinchZoomStep } from "./previewZoom";

describe("preview zoom controls", () => {
  it("limits all requested levels to the supported range", () => {
    expect(boundedPreviewZoom(-10)).toBe(-1);
    expect(boundedPreviewZoom(0)).toBe(0);
    expect(boundedPreviewZoom(8)).toBe(1);
  });

  it("restores only supported persisted zoom levels", () => {
    expect(parseStoredPreviewZoom("-1")).toBe(-1);
    expect(parseStoredPreviewZoom("1")).toBe(1);
    expect(parseStoredPreviewZoom("999")).toBe(0);
    expect(parseStoredPreviewZoom(null)).toBe(0);
  });

  it("uses distinct storage keys for each document type and device class", () => {
    expect(getPreviewZoomStorageKey("quotation", "mobile")).toBe("toolsthai.preview-zoom.quotation.mobile");
    expect(getPreviewZoomStorageKey("quotation", "desktop")).toBe("toolsthai.preview-zoom.quotation.desktop");
    expect(getPreviewZoomStorageKey("quotation", "mobile")).not.toBe(getPreviewZoomStorageKey("invoice", "mobile"));
    expect(getPreviewZoomStorageKey("quotation", "mobile")).not.toBe(getPreviewZoomStorageKey("quotation", "desktop"));
    expect(getPreviewZoomDevice(820)).toBe("mobile");
    expect(getPreviewZoomDevice(821)).toBe("desktop");
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

  it("recognizes only two quick nearby taps as a double tap", () => {
    expect(isDoubleTap({ x: 20, y: 30, timestamp: 100 }, { x: 36, y: 42, timestamp: 280 })).toBe(true);
    expect(isDoubleTap({ x: 20, y: 30, timestamp: 100 }, { x: 20, y: 30, timestamp: 400 })).toBe(false);
    expect(isDoubleTap({ x: 20, y: 30, timestamp: 100 }, { x: 80, y: 90, timestamp: 220 })).toBe(false);
  });
});

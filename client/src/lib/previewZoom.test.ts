import { describe, expect, it } from "vitest";
import { boundedPreviewZoom, pinchZoomStep } from "./previewZoom";

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
});

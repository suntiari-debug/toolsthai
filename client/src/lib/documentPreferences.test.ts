import { describe, expect, it } from "vitest";
import { LOGO_PRESETS_STORAGE_KEY, MAX_LOGO_PRESETS, parseStoredPreviewHighlight, sanitizeLogoPresets, serializeLogoPresets, type LogoPreset } from "./documentPreferences";

describe("document preferences", () => {
  it("defaults the preview highlight to enabled and only disables it for an explicit false value", () => {
    expect(parseStoredPreviewHighlight(null)).toBe(true);
    expect(parseStoredPreviewHighlight("true")).toBe(true);
    expect(parseStoredPreviewHighlight("false")).toBe(false);
  });

  it("restores valid persisted logo presets with safe transform bounds", () => {
    const presets = sanitizeLogoPresets(JSON.stringify([{ id: "brand-a", name: "  บริษัท เอ  ", logoUrl: "data:image/png;base64,logo", crop: { zoom: 9, x: -99, y: 99, brightness: 20, contrast: 200 }, position: { x: 99, y: -99 }, scale: 9 }]));
    expect(presets).toEqual([{ id: "brand-a", name: "บริษัท เอ", logoUrl: "data:image/png;base64,logo", crop: { zoom: 2.4, x: -34, y: 34, brightness: 70, contrast: 130 }, position: { x: 24, y: -18 }, scale: 1.45 }]);
  });

  it("rejects invalid or temporary preset URLs and limits the stored collection", () => {
    const many: LogoPreset[] = Array.from({ length: MAX_LOGO_PRESETS + 2 }, (_, index) => ({ id: `brand-${index}`, name: "แบรนด์", logoUrl: "https://cdn.example.com/logo.png", crop: { zoom: 1, x: 0, y: 0, brightness: 100, contrast: 100 }, position: { x: 0, y: 0 }, scale: 1 }));
    const restored = sanitizeLogoPresets(serializeLogoPresets(many));
    expect(restored).toHaveLength(MAX_LOGO_PRESETS);
    expect(sanitizeLogoPresets(JSON.stringify([{ id: "temp", name: "ชั่วคราว", logoUrl: "blob:https://example.test/logo" }]))).toEqual([]);
    expect(LOGO_PRESETS_STORAGE_KEY).toContain("logoPresets");
  });
});

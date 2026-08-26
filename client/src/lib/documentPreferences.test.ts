import { describe, expect, it } from "vitest";
import { createLogoPresetExport, filterLogoPresets, LEGACY_LOGO_PRESETS_STORAGE_KEY, LOGO_PRESET_EXPORT_FORMAT, LOGO_PRESETS_STORAGE_KEY, MAX_LOGO_PRESETS, mergeLogoPresets, parseLogoPresetImport, parseStoredPreviewHighlight, sanitizeLogoPresets, serializeLogoPresets, type LogoPreset } from "./documentPreferences";

const brandA: LogoPreset = { id: "brand-a", name: "บริษัท เอ", logoUrl: "data:image/png;base64,logo-a", crop: { zoom: 1, x: 0, y: 0, brightness: 100, contrast: 100 }, position: { x: 0, y: 0 }, scale: 1, category: "บริการ", company: { name: "บริษัท เอ จำกัด", address: "กรุงเทพฯ", taxId: "0105555555555", phone: "02-000-0000", email: "contact@a.test" } };
const brandB: LogoPreset = { ...brandA, id: "brand-b", name: "ร้าน บี", category: "สินค้า", company: { ...brandA.company, name: "ร้าน บี" } };

describe("document preferences", () => {
  it("defaults the preview highlight to enabled and only disables it for an explicit false value", () => {
    expect(parseStoredPreviewHighlight(null)).toBe(true);
    expect(parseStoredPreviewHighlight("true")).toBe(true);
    expect(parseStoredPreviewHighlight("false")).toBe(false);
  });

  it("restores v2 presets with company data, category, and safe transform bounds", () => {
    const presets = sanitizeLogoPresets(JSON.stringify([{ ...brandA, crop: { zoom: 9, x: -99, y: 99, brightness: 20, contrast: 200 }, position: { x: 99, y: -99 }, scale: 9 }]));
    expect(presets[0]).toMatchObject({ name: "บริษัท เอ", category: "บริการ", company: brandA.company, crop: { zoom: 2.4, x: -34, y: 34, brightness: 70, contrast: 130 }, position: { x: 24, y: -18 }, scale: 1.45 });
  });

  it("migrates legacy preset entries and rejects invalid or temporary URLs", () => {
    const legacy = sanitizeLogoPresets(JSON.stringify([{ id: "legacy", name: "แบรนด์เก่า", logoUrl: "https://cdn.example.com/logo.png", crop: { zoom: 1, x: 0, y: 0, brightness: 100, contrast: 100 }, position: { x: 0, y: 0 }, scale: 1 }]));
    expect(legacy[0]).toMatchObject({ category: "ทั่วไป", company: { name: "", address: "", taxId: "", phone: "", email: "" } });
    expect(sanitizeLogoPresets(JSON.stringify([{ id: "temp", name: "ชั่วคราว", logoUrl: "blob:https://example.test/logo" }]))).toEqual([]);
    expect(LOGO_PRESETS_STORAGE_KEY).toContain("v2");
    expect(LEGACY_LOGO_PRESETS_STORAGE_KEY).toContain("v1");
  });

  it("filters presets by text and category while keeping valid visible matches", () => {
    expect(filterLogoPresets([brandA, brandB], "บริษัท", "all")).toEqual([brandA]);
    expect(filterLogoPresets([brandA, brandB], "", "สินค้า")).toEqual([brandB]);
    expect(filterLogoPresets([brandA, brandB], "ไม่พบ", "all")).toEqual([]);
  });

  it("exports a versioned payload and imports it safely with name-based deduplication", () => {
    const payload = createLogoPresetExport([brandA], "2026-08-22T00:00:00.000Z");
    expect(payload).toMatchObject({ format: LOGO_PRESET_EXPORT_FORMAT, version: 1, presets: [brandA] });
    expect(parseLogoPresetImport(JSON.stringify(payload))).toEqual([brandA]);
    expect(parseLogoPresetImport(JSON.stringify({ format: "other", version: 1, presets: [brandA] }))).toEqual([]);
    expect(mergeLogoPresets([brandA], [{ ...brandA, id: "imported-a" }, brandB])).toEqual([{ ...brandA, id: "imported-a" }, brandB]);
  });

  it("limits stored presets to the supported device collection size", () => {
    const many = Array.from({ length: MAX_LOGO_PRESETS + 2 }, (_, index) => ({ ...brandA, id: `brand-${index}`, name: `แบรนด์ ${index}` }));
    expect(sanitizeLogoPresets(serializeLogoPresets(many))).toHaveLength(MAX_LOGO_PRESETS);
  });
});

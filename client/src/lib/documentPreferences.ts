import { boundedLogoCrop, boundedLogoPosition, boundedLogoScale, defaultLogoCrop, defaultLogoPosition, defaultLogoScale, type LogoCrop, type LogoPosition } from "./document";

export const PREVIEW_HIGHLIGHT_PREFERENCE_STORAGE_KEY = "toolsThai.previewHighlight.enabled";
export const LOGO_PRESETS_STORAGE_KEY = "toolsThai.logoPresets.v2";
export const LEGACY_LOGO_PRESETS_STORAGE_KEY = "toolsThai.logoPresets.v1";
export const MAX_LOGO_PRESETS = 5;
export const MAX_LOGO_PRESET_IMPORT_BYTES = 3_000_000;
export const LOGO_PRESET_EXPORT_FORMAT = "tools-thai-logo-presets";
export const logoPresetCategories = ["ทั่วไป", "บริการ", "สินค้า", "โครงการ", "อื่นๆ"] as const;
export type LogoPresetCategory = (typeof logoPresetCategories)[number];

export type LogoPresetCompany = {
  name: string;
  address: string;
  taxId: string;
  phone: string;
  email: string;
};

export type LogoPreset = {
  id: string;
  name: string;
  logoUrl: string;
  crop: LogoCrop;
  position: LogoPosition;
  scale: number;
  category: LogoPresetCategory;
  company: LogoPresetCompany;
};

export type LogoPresetExport = {
  format: typeof LOGO_PRESET_EXPORT_FORMAT;
  version: 1;
  exportedAt: string;
  presets: LogoPreset[];
};

export function parseStoredPreviewHighlight(value: string | null) {
  return value !== "false";
}

function textValue(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function safeLogoUrl(value: unknown) {
  if (typeof value !== "string" || !value || value.startsWith("blob:")) return "";
  return /^https?:\/\//.test(value) || /^data:image\/(png|jpeg|webp);base64,/i.test(value) ? value : "";
}

function safeCategory(value: unknown): LogoPresetCategory {
  return logoPresetCategories.includes(value as LogoPresetCategory) ? value as LogoPresetCategory : "ทั่วไป";
}

function sanitizePresetEntry(entry: unknown, index: number): LogoPreset | null {
  if (!entry || typeof entry !== "object") return null;
  const candidate = entry as Partial<LogoPreset>;
  const logoUrl = safeLogoUrl(candidate.logoUrl);
  if (typeof candidate.id !== "string" || !candidate.id || !logoUrl) return null;
  const companyCandidate = candidate.company && typeof candidate.company === "object" ? candidate.company as Partial<LogoPresetCompany> : {};
  return {
    id: candidate.id,
    name: textValue(candidate.name, 40) || `แบรนด์ ${index + 1}`,
    logoUrl,
    crop: boundedLogoCrop(candidate.crop ?? defaultLogoCrop),
    position: boundedLogoPosition(candidate.position ?? defaultLogoPosition),
    scale: boundedLogoScale(candidate.scale ?? defaultLogoScale),
    category: safeCategory(candidate.category),
    company: {
      name: textValue(companyCandidate.name, 140),
      address: textValue(companyCandidate.address, 500),
      taxId: textValue(companyCandidate.taxId, 40),
      phone: textValue(companyCandidate.phone, 60),
      email: textValue(companyCandidate.email, 140),
    },
  };
}

export function sanitizeLogoPresets(value: string | null): LogoPreset[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry, index) => {
      const preset = sanitizePresetEntry(entry, index);
      return preset ? [preset] : [];
    }).slice(0, MAX_LOGO_PRESETS);
  } catch {
    return [];
  }
}

export function serializeLogoPresets(presets: LogoPreset[]) {
  return JSON.stringify(presets.slice(0, MAX_LOGO_PRESETS));
}

export function filterLogoPresets(presets: LogoPreset[], search: string, category: LogoPresetCategory | "all") {
  const query = search.trim().toLocaleLowerCase("th-TH");
  return presets.filter((preset) => (category === "all" || preset.category === category) && (!query || `${preset.name} ${preset.company.name} ${preset.category}`.toLocaleLowerCase("th-TH").includes(query)));
}

export function mergeLogoPresets(current: LogoPreset[], imported: LogoPreset[]) {
  const seen = new Set<string>();
  return [...imported, ...current].filter((preset) => {
    const key = preset.name.toLocaleLowerCase("th-TH");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_LOGO_PRESETS);
}

export function createLogoPresetExport(presets: LogoPreset[], exportedAt = new Date().toISOString()): LogoPresetExport {
  return { format: LOGO_PRESET_EXPORT_FORMAT, version: 1, exportedAt, presets: presets.slice(0, MAX_LOGO_PRESETS) };
}

export function parseLogoPresetImport(value: string) {
  if (value.length > MAX_LOGO_PRESET_IMPORT_BYTES) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return [];
    const candidate = parsed as Partial<LogoPresetExport>;
    if (candidate.format !== LOGO_PRESET_EXPORT_FORMAT || candidate.version !== 1 || !Array.isArray(candidate.presets)) return [];
    return sanitizeLogoPresets(JSON.stringify(candidate.presets));
  } catch {
    return [];
  }
}

import { boundedLogoCrop, boundedLogoPosition, boundedLogoScale, defaultLogoCrop, defaultLogoPosition, defaultLogoScale, type LogoCrop, type LogoPosition } from "./document";

export const PREVIEW_HIGHLIGHT_PREFERENCE_STORAGE_KEY = "toolsThai.previewHighlight.enabled";
export const LOGO_PRESETS_STORAGE_KEY = "toolsThai.logoPresets.v1";
export const MAX_LOGO_PRESETS = 5;

export type LogoPreset = {
  id: string;
  name: string;
  logoUrl: string;
  crop: LogoCrop;
  position: LogoPosition;
  scale: number;
};

export function parseStoredPreviewHighlight(value: string | null) {
  return value !== "false";
}

export function sanitizeLogoPresets(value: string | null): LogoPreset[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry, index) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Partial<LogoPreset>;
      if (typeof candidate.id !== "string" || !candidate.id || typeof candidate.logoUrl !== "string" || !candidate.logoUrl || candidate.logoUrl.startsWith("blob:")) return [];
      return [{
        id: candidate.id,
        name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim().slice(0, 40) : `แบรนด์ ${index + 1}`,
        logoUrl: candidate.logoUrl,
        crop: boundedLogoCrop(candidate.crop ?? defaultLogoCrop),
        position: boundedLogoPosition(candidate.position ?? defaultLogoPosition),
        scale: boundedLogoScale(candidate.scale ?? defaultLogoScale),
      }];
    }).slice(0, MAX_LOGO_PRESETS);
  } catch {
    return [];
  }
}

export function serializeLogoPresets(presets: LogoPreset[]) {
  return JSON.stringify(presets.slice(0, MAX_LOGO_PRESETS));
}

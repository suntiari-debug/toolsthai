export type LandingCtaPlacement = "hero_primary" | "hero_tools" | "document_flow" | "bottom_primary";
export type LandingToolKind = "document" | "calculator";

type UmamiTracker = {
  track: (eventName: string, eventData?: Record<string, string>) => void;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

function track(eventName: "landing_cta_click" | "landing_tool_card_click", eventData: Record<string, string>) {
  if (typeof window === "undefined" || !window.umami?.track) return false;

  try {
    window.umami.track(eventName, eventData);
    return true;
  } catch {
    // Analytics must never block navigation or the primary product flow.
    return false;
  }
}

export function trackLandingCtaClick(placement: LandingCtaPlacement, destination: string) {
  return track("landing_cta_click", { placement, destination });
}

export function trackLandingToolCardClick(toolKind: LandingToolKind, toolSlug: string) {
  return track("landing_tool_card_click", { tool_kind: toolKind, tool_slug: toolSlug });
}

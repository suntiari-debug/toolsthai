import { afterEach, describe, expect, it, vi } from "vitest";
import { trackLandingCtaClick, trackLandingToolCardClick } from "./analytics";

const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
});

describe("landing analytics", () => {
  it("does nothing when the Umami tracker is unavailable", () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });

    expect(trackLandingCtaClick("hero_primary", "/quotation")).toBe(false);
  });

  it("tracks CTA clicks with only placement and destination", () => {
    const track = vi.fn();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { umami: { track } } });

    expect(trackLandingCtaClick("bottom_primary", "/quotation")).toBe(true);
    expect(track).toHaveBeenCalledWith("landing_cta_click", { placement: "bottom_primary", destination: "/quotation" });
  });

  it("tracks tool cards with an anonymous tool category and slug", () => {
    const track = vi.fn();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { umami: { track } } });

    expect(trackLandingToolCardClick("calculator", "pricing-calculator")).toBe(true);
    expect(track).toHaveBeenCalledWith("landing_tool_card_click", { tool_kind: "calculator", tool_slug: "pricing-calculator" });
  });
});

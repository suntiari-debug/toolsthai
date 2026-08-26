import { describe, expect, it } from "vitest";
import { getItemPreviewHighlightTarget, getPreviewHighlightTarget } from "./previewHighlight";

describe("preview highlight mapping", () => {
  it("accepts only the supported document regions", () => {
    expect(getPreviewHighlightTarget("company")).toBe("company");
    expect(getPreviewHighlightTarget(" document-meta ")).toBe("document-meta");
    expect(getPreviewHighlightTarget("totals")).toBe("totals");
    expect(getPreviewHighlightTarget("unknown-region")).toBeNull();
  });

  it("creates a stable highlight target for an individual line item", () => {
    expect(getItemPreviewHighlightTarget("line-item-42")).toBe("item:line-item-42");
    expect(getPreviewHighlightTarget("item:line-item-42")).toBe("item:line-item-42");
  });

  it("rejects incomplete or absent item targets", () => {
    expect(getPreviewHighlightTarget("item:")).toBeNull();
    expect(getPreviewHighlightTarget("item:   ")).toBeNull();
    expect(getPreviewHighlightTarget(undefined)).toBeNull();
  });
});

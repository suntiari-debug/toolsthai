import { describe, expect, it } from "vitest";
import { CANONICAL_ORIGIN, getSeoHead, homeSeo } from "@shared/seo";

describe("Home SEO head", () => {
  it("returns an indexable canonical head with WebSite structured data", () => {
    const head = getSeoHead("/");

    expect(head.title).toBe(homeSeo.title);
    expect(head.description).toBe(homeSeo.description);
    expect(head.canonicalPath).toBe("/");
    expect(head.jsonLd).toEqual([{ "@context": "https://schema.org", "@type": "WebSite", name: "Tools Thai", url: CANONICAL_ORIGIN, inLanguage: "th-TH" }]);
  });
});

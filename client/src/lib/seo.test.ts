import { describe, expect, it } from "vitest";
import { CANONICAL_ORIGIN, documentSeo, getSeoHead, homeSeo } from "@shared/seo";

describe("Home SEO head", () => {
  it("returns an indexable canonical head with WebSite structured data", () => {
    const head = getSeoHead("/");

    expect(head.title).toBe(homeSeo.title);
    expect(head.description).toBe(homeSeo.description);
    expect(head.canonicalPath).toBe("/");
    expect(head.jsonLd).toEqual([{ "@context": "https://schema.org", "@type": "WebSite", name: "Tools Thai", url: CANONICAL_ORIGIN, inLanguage: "th-TH" }]);
  });

  it("keeps the quotation title focused on the quotation task and PDF output", () => {
    const head = getSeoHead("/quotation");

    expect(head.title).toBe("สร้างใบเสนอราคาออนไลน์ฟรี พร้อม PDF และโลโก้ | Tools Thai");
    expect(head.title).toBe(documentSeo.quotation.title);
    expect(documentSeo.quotation.h1).toBe("สร้างใบเสนอราคาออนไลน์ฟรี ไม่ต้องสมัคร");
  });
});

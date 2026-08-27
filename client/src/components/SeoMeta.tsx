import { useEffect } from "react";

type SeoMetaProps = { title: string; description: string; canonicalPath?: string; structuredData?: unknown[] };

function setTag(selector: string, attribute: "name" | "property", key: string, value: string) {
  let node = document.querySelector(selector) as HTMLMetaElement | null;
  if (!node) { node = document.createElement("meta"); node.setAttribute(attribute, key); document.head.appendChild(node); }
  node.content = value;
}

export default function SeoMeta({ title, description, canonicalPath, structuredData }: SeoMetaProps) {
  useEffect(() => {
    document.title = title;
    setTag('meta[name="description"]', "name", "description", description);
    setTag('meta[property="og:title"]', "property", "og:title", title);
    setTag('meta[property="og:description"]', "property", "og:description", description);
    setTag('meta[name="twitter:title"]', "name", "twitter:title", title);
    setTag('meta[name="twitter:description"]', "name", "twitter:description", description);
    if (canonicalPath) {
      const canonicalUrl = new URL(canonicalPath, window.location.origin).toString();
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
      canonical.href = canonicalUrl;
      setTag('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    }
    if (structuredData) {
      let script = document.getElementById("tools-thai-structured-data") as HTMLScriptElement | null;
      if (!script) { script = document.createElement("script"); script.id = "tools-thai-structured-data"; script.type = "application/ld+json"; document.head.appendChild(script); }
      script.text = JSON.stringify(structuredData).replace(/</g, "\\u003c");
    }
  }, [canonicalPath, description, structuredData, title]);
  return null;
}

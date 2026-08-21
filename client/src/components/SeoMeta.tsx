import { useEffect } from "react";

export default function SeoMeta({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    document.title = `${title} | Tools Thai`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [title, description]);
  return null;
}

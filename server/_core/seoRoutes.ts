import type { Express, Request } from "express";
import { getRequestOrigin } from "./requestOrigin";

const INDEXABLE_PATHS = [
  "/",
  "/tools",
  "/quotation",
  "/invoice",
  "/receipt",
  "/tax-invoice",
  "/delivery-note",
  "/pricing-calculator",
  "/vat-calculator",
  "/margin-calculator",
  "/payment-terms",
];

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function getSitemapXml(req: Request) {
  const origin = escapeXml(getRequestOrigin(req));
  const urls = INDEXABLE_PATHS.map((pathname) => `  <url><loc>${origin}${pathname}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function registerSeoRoutes(app: Express) {
  app.get("/robots.txt", (req, res) => {
    const origin = getRequestOrigin(req);
    res.type("text/plain").send(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  });

  app.get("/sitemap.xml", (req, res) => {
    res.type("application/xml").send(getSitemapXml(req));
  });
}

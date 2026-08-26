import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { SITE_NAME, type SsrHead } from "../../shared/seo";
import { getRequestOrigin } from "./requestOrigin";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const cleanText = (value: string, max: number) => Array.from(value.replace(/\s+/g, " ").trim()).slice(0, max).join("");
const isSeoPath = (pathName: string) => pathName === "/" || pathName === "/quotation" || pathName === "/invoice";

function composeHtml(template: string, html: string, head: SsrHead, state: unknown, canonicalOrigin: string) {
  const title = escapeHtml(cleanText(head.title, 70));
  const description = escapeHtml(cleanText(head.description, 200));
  const canonical = `${canonicalOrigin}${head.canonicalPath}`;
  const jsonLd = JSON.stringify(head.jsonLd).replace(/</g, "\\u003c");
  const headTags = [`<title>${title}</title>`, `<meta name="description" content="${description}" />`, `<meta property="og:type" content="website" />`, `<meta property="og:title" content="${title}" />`, `<meta property="og:description" content="${description}" />`, `<meta property="og:url" content="${canonical}" />`, `<meta property="og:site_name" content="${SITE_NAME}" />`, `<meta property="og:locale" content="th_TH" />`, `<meta name="twitter:card" content="summary" />`, `<meta name="twitter:title" content="${title}" />`, `<meta name="twitter:description" content="${description}" />`, `<link rel="canonical" href="${canonical}" />`, `<script type="application/ld+json">${jsonLd}</script>`].join("\n");
  const stateScript = `<script>window.__SSR_RENDERED__=true;window.__RQ_STATE__=${JSON.stringify(state).replace(/</g, "\\u003c")}</script>`;
  return template.replace("</body>", () => `${stateScript}</body>`).replace("<!--app-head-->", () => headTags).replace("<!--app-html-->", () => html);
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({ ...viteConfig, configFile: false, server: { middlewareMode: true, hmr: { server }, allowedHosts: true }, appType: "custom" });
  app.use(async (req, res, next) => {
    if (req.method !== "GET" || !isSeoPath(req.path)) return next();
    try {
      let template = await fs.promises.readFile(path.resolve(import.meta.dirname, "../..", "client", "index.html"), "utf-8");
      template = template.replace(`src="/src/entry-client.tsx"`, `src="/src/entry-client.tsx?v=${nanoid()}"`);
      template = await vite.transformIndexHtml(req.originalUrl, template);
      template = template.replace("</head>", `<link rel="stylesheet" href="/src/index.css?direct" data-ssr-dev-css></head>`);
      const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
      const canonicalOrigin = getRequestOrigin(req);
      const result = await render(req.originalUrl, canonicalOrigin);
      res.status(200).set("Cache-Control", "no-cache").type("html").end(composeHtml(template, result.html, result.head, result.dehydratedState, canonicalOrigin));
    } catch (error) { vite.ssrFixStacktrace(error as Error); console.error("[SSR] dev render failed:", error); next(error); }
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    try {
      let template = await fs.promises.readFile(path.resolve(import.meta.dirname, "../..", "client", "index.html"), "utf-8");
      template = template.replace(`src="/src/entry-client.tsx"`, `src="/src/entry-client.tsx?v=${nanoid()}"`);
      res.status(200).set({ "Content-Type": "text/html" }).end(await vite.transformIndexHtml(req.originalUrl, template));
    } catch (error) { vite.ssrFixStacktrace(error as Error); next(error); }
  });
}

export function serveStatic(app: Express) {
  const distPath = process.env.NODE_ENV === "development" ? path.resolve(import.meta.dirname, "../..", "dist", "public") : path.resolve(import.meta.dirname, "public");
  app.use(async (req, res, next) => {
    if (req.method !== "GET" || !isSeoPath(req.path)) return next();
    try {
      const template = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf-8");
      const entryPath = path.resolve(import.meta.dirname, "server-ssr", "entry-server.js");
      const { render } = await import(entryPath);
      const canonicalOrigin = getRequestOrigin(req);
      const result = await render(req.originalUrl, canonicalOrigin);
      res.status(200).set("Cache-Control", "no-cache").type("html").end(composeHtml(template, result.html, result.head, result.dehydratedState, canonicalOrigin));
    } catch (error) { console.error("[SSR] render failed, serving shell:", error); next(); }
  });
  app.use(express.static(distPath));
  app.use("*", (_req, res) => res.sendFile(path.resolve(distPath, "index.html")));
}

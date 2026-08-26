import type { Request } from "express";
import { DEFAULT_CANONICAL_ORIGIN, getCanonicalOrigin } from "../../shared/seo";

function firstForwardedValue(value: string | undefined) {
  return value?.split(",")[0]?.trim();
}

export function getRequestOrigin(req: Request) {
  const configuredOrigin = process.env.PUBLIC_SITE_URL?.trim();
  if (configuredOrigin) return getCanonicalOrigin(configuredOrigin);

  const protocol = firstForwardedValue(req.get("x-forwarded-proto")) || req.protocol || "https";
  const host = firstForwardedValue(req.get("x-forwarded-host")) || req.get("host");
  return host ? getCanonicalOrigin(`${protocol}://${host}`) : DEFAULT_CANONICAL_ORIGIN;
}

export function getClientCanonicalOrigin() {
  return typeof window === "undefined" ? undefined : window.location.origin;
}

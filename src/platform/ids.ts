import { createHash } from "node:crypto";

/** Deterministic UUID (v5-style, sha1-based) from a stable name. */
export function deterministicUuid(name: string): string {
  const h = createHash("sha1").update(`aios:${name}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "5" + h.slice(13, 16),
    ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + h.slice(18, 20),
    h.slice(20, 32),
  ].join("-");
}

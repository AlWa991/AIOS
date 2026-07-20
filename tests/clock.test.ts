import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(DIR, "..", "src");

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("clock discipline (ADR-0015)", () => {
  it("no Date.now() / new Date( outside src/platform", () => {
    const offenders = tsFiles(SRC)
      .filter((f) => !f.startsWith(path.join(SRC, "platform") + path.sep))
      .filter((f) => /Date\.now\(|new Date\(/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

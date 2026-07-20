import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(DIR, "..");
const depcruise = path.join(root, "node_modules", ".bin", "dependency-cruise");

describe("boundary enforcement (ADR-0006 / ADR-0017)", () => {
  it("dependency-cruiser reports zero violations", () => {
    const out = execFileSync(depcruise, ["--config", ".dependency-cruiser.cjs", "src"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(out).toContain("no dependency violations found");
  });

  it("renderer purity rule for apps/ is enforced in the config", () => {
    const config = readFileSync(path.join(root, ".dependency-cruiser.cjs"), "utf8");
    expect(config).toContain('"apps-read-only-situation"');
    expect(config).toContain("^src/apps/");
    expect(config).toContain("src/contracts/situation");
    expect(config).toContain("src/contracts/interaction");
  });
});

/** Boundary enforcement — spec-0001 / ADR-0006 / ADR-0017. */
module.exports = {
  forbidden: [
    {
      name: "no-cross-context",
      comment: "A context may never import another context's internals (ADR-0006).",
      severity: "error",
      from: { path: "^src/contexts/([^/]+)/" },
      to: { path: "^src/contexts/([^/]+)/", pathNot: "^src/contexts/$1/" },
    },
    {
      name: "contexts-only-contracts-platform",
      comment: "Contexts import only contracts/ and platform/.",
      severity: "error",
      from: { path: "^src/contexts/" },
      to: {
        path: "^src/",
        pathNot: ["^src/contexts/", "^src/contracts/", "^src/platform/"],
      },
    },
    {
      name: "apps-read-only-situation",
      comment:
        "Renderer purity (ADR-0017): apps import only the Situation contract (read), " +
        "the Interaction contract (render/input) and the composition root (bootstrap).",
      severity: "error",
      from: { path: "^src/apps/" },
      to: {
        path: "^src/",
        pathNot: [
          "^src/apps/",
          "^src/runtime/",
          "^src/contracts/situation\\.ts$",
          "^src/contracts/interaction\\.ts$",
        ],
      },
    },
    {
      name: "contracts-self-contained",
      comment: "Contracts are the sole cross-context surface; they import nothing but contracts.",
      severity: "error",
      from: { path: "^src/contracts/" },
      to: { path: "^src/", pathNot: "^src/contracts/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      extensions: [".ts", ".js"],
    },
  },
};

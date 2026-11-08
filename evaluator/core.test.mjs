import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { evaluateProject } from "./core.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omniflow-eval-"));
  fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "lib"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.mkdirSync(path.join(root, "supabase", "migrations"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: {
    test: "bun test", lint: "eslint .", typecheck: "tsc --noEmit", build: "vite build", evaluate: "bun evaluator/run.mjs",
  } }));
  fs.writeFileSync(path.join(root, ".github", "workflows", "ci.yml"), `on:
  push:
    branches: [main]
steps:
  - run: bun install --frozen-lockfile
  - run: bun run test
  - run: bun run lint
  - run: bun run typecheck
  - run: bun run build
  - run: bun run evaluate
`);
  fs.writeFileSync(path.join(root, "src", "lib", "feature.ts"), "export const feature = true;");
  fs.writeFileSync(path.join(root, "src", "lib", "feature.test.ts"), "test");
  fs.writeFileSync(path.join(root, "docs", "FEATURE_INVENTORY.md"), "# inventory");
  fs.writeFileSync(path.join(root, "docs", "IMPLEMENTATION_STATUS.md"), "# status");
  fs.writeFileSync(path.join(root, "supabase", "migrations", "0001.sql"), "select 1;");
  return root;
}

describe("OmniFlow deterministic evaluator", () => {
  it("checks scripts, CI gates, evidence paths, tests, and migrations", () => {
    const root = fixture();
    const report = evaluateProject({
      root,
      requirements: { requirements: [{
        id: "T-1", name: "Feature", status: "partial", priority: "high",
        evidence: ["src/lib/feature.ts", "src/lib/missing.ts"],
        verificationRequired: ["unit-test"],
      }] },
      git: { branch: "test", commit: "abc123", workingTreeClean: true, trackedFiles: [] },
      evaluatedAt: "2026-11-08T00:00:00.000Z",
    });
    expect(report.qualityGate.allPassed).toBe(true);
    expect(report.requirements.evidenceCoverage).toBe(50);
    expect(report.requirements.items[0].evidenceMissing).toEqual(["src/lib/missing.ts"]);
    expect(report.repositoryMetrics.testFileCount).toBe(1);
    expect(report.repositoryMetrics.migrationCount).toBe(1);
    expect(report.repository.workingTreeClean).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("does not infer feature completion from evidence files", () => {
    const root = fixture();
    const report = evaluateProject({
      root,
      requirements: { requirements: [{
        id: "T-2", name: "Feature", status: "partial", priority: "critical",
        evidence: ["src/lib/feature.ts"], verificationRequired: ["e2e-test"],
      }] },
      evaluatedAt: "2026-11-08T00:00:00.000Z",
    });
    expect(report.requirements.items[0].declaredStatus).toBe("partial");
    expect(report.policy.neverUpgradesFeatureStatusAutomatically).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("detects missing main push verification", () => {
    const root = fixture();
    const workflowPath = path.join(root, ".github", "workflows", "ci.yml");
    fs.writeFileSync(workflowPath, fs.readFileSync(workflowPath, "utf8").replace("branches: [main]", "branches: [release]"));
    const report = evaluateProject({ root, requirements: { requirements: [] } });
    expect(report.qualityGate.checks.find((item) => item.id === "ci:push-on-main")?.passed).toBe(false);
    fs.rmSync(root, { recursive: true, force: true });
  });
});

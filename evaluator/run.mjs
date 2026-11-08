#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateProject } from "./core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const requirements = JSON.parse(fs.readFileSync(path.join(root, "project-requirements.json"), "utf8"));
const git = (args) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};

const report = evaluateProject({
  root,
  requirements,
  git: {
    branch: git(["branch", "--show-current"]),
    commit: git(["rev-parse", "HEAD"]),
    workingTreeClean: git(["status", "--porcelain"]) === "",
    trackedFiles: (git(["ls-files"]) ?? "").split("\n").filter(Boolean),
  },
});
const json = process.argv.includes("--json");
if (json) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  console.log(`OmniFlow repository evaluation — ${report.evaluatedAt}`);
  console.log(`Commit: ${report.repository.commit ?? "unknown"} | Branch: ${report.repository.branch ?? "unknown"}`);
  console.log(`Quality gates: ${report.qualityGate.passed}/${report.qualityGate.total}`);
  console.log(`Requirements evidence: ${report.requirements.evidencePathsPresent}/${report.requirements.evidencePathsExpected} (${report.requirements.evidenceCoverage}%)`);
  console.log(`Tests: ${report.repositoryMetrics.testFileCount} files | Migrations: ${report.repositoryMetrics.migrationCount}`);
  for (const check of report.qualityGate.checks) console.log(`${check.passed ? "PASS" : "FAIL"}  ${check.id}`);
  for (const warning of report.warnings) console.log(`WARN  ${warning}`);
}

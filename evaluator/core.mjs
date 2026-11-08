import fs from "node:fs";
import path from "node:path";

const REQUIRED_SCRIPTS = ["test", "lint", "typecheck", "build", "evaluate"];
const REQUIRED_CI_COMMANDS = [
  "bun install --frozen-lockfile",
  "bun run test",
  "bun run lint",
  "bun run typecheck",
  "bun run build",
  "bun run evaluate",
];

function readText(root, relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
  } catch {
    return "";
  }
}

function walk(root, relative = "") {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "dist", ".output"].includes(entry.name)) return [];
      return walk(root, child);
    }
    return [child.split(path.sep).join("/")];
  });
}

/**
 * Deterministic, read-only repository evaluator.
 * It measures evidence and engineering gates; it never upgrades feature status.
 */
export function evaluateProject({ root, requirements, git = {}, evaluatedAt = new Date().toISOString() }) {
  const packageJson = JSON.parse(readText(root, "package.json") || "{}");
  const workflow = readText(root, ".github/workflows/ci.yml");
  const files = walk(root);
  const fileSet = new Set(files);
  const requiredScripts = Object.fromEntries(REQUIRED_SCRIPTS.map((name) => [name, Boolean(packageJson.scripts?.[name])]));
  const requiredCiCommands = Object.fromEntries(REQUIRED_CI_COMMANDS.map((command) => [command, workflow.includes(command)]));
  const testFiles = files.filter((file) => /\.test\.[cm]?[jt]sx?$/.test(file));
  const migrations = files.filter((file) => /^(supabase|drizzle)\/migrations\/.*\.sql$/.test(file));
  const trackedEnv = Array.isArray(git.trackedFiles) ? git.trackedFiles.filter((file) => /^\.env(?:\.|$)/.test(file)) : null;

  const requirementResults = (requirements.requirements ?? []).map((requirement) => {
    const evidence = requirement.evidence ?? [];
    const present = evidence.filter((file) => fileSet.has(file));
    const missing = evidence.filter((file) => !fileSet.has(file));
    return {
      id: requirement.id,
      name: requirement.name,
      declaredStatus: requirement.status,
      priority: requirement.priority,
      evidencePresent: present,
      evidenceMissing: missing,
      evidenceCoverage: evidence.length ? Math.round((present.length / evidence.length) * 100) : 0,
      verificationRequired: requirement.verificationRequired ?? [],
      note: "Evidence presence is not proof of runtime correctness; declared status is not changed by this evaluator.",
    };
  });

  const workflowHasMainPush = /push:\s*\n\s*branches:\s*\[[^\]]*\bmain\b/.test(workflow);
  const checks = [
    ...Object.entries(requiredScripts).map(([name, passed]) => ({ id: `script:${name}`, passed })),
    ...Object.entries(requiredCiCommands).map(([command, passed]) => ({ id: `ci:${command}`, passed })),
    { id: "ci:push-on-main", passed: workflowHasMainPush },
    { id: "feature-inventory-document", passed: fileSet.has("docs/FEATURE_INVENTORY.md") },
    { id: "implementation-status-document", passed: fileSet.has("docs/IMPLEMENTATION_STATUS.md") },
    { id: "test-suite-present", passed: testFiles.length > 0 },
  ];

  const statusCounts = Object.fromEntries(["implemented", "partial", "planned", "unknown"].map((status) => [
    status,
    requirementResults.filter((item) => item.declaredStatus === status).length,
  ]));
  const evidenceTotal = requirementResults.reduce((sum, item) => sum + item.evidencePresent.length, 0);
  const evidenceExpected = requirementResults.reduce((sum, item) => sum + item.evidencePresent.length + item.evidenceMissing.length, 0);
  const warnings = [];
  if (testFiles.length < 5) warnings.push("Automated test-file count is low relative to the product surface; add workflow and integration coverage.");
  if (!workflowHasMainPush) warnings.push("CI does not run on pushes to main; merged commits may not receive a post-merge verification run.");
  if (trackedEnv?.length) warnings.push("Environment files are tracked by Git. Review and rotate credentials if any real secrets were ever committed.");
  if (requirementResults.some((item) => item.evidenceMissing.length)) warnings.push("One or more requirement evidence paths are missing; review the inventory/configuration.");
  warnings.push("This is a static repository audit. It cannot prove live integrations, database migration state, RLS isolation, scheduler health, or production behavior.");

  return {
    evaluator: "OmniFlow deterministic repository evaluator",
    evaluatorVersion: "1.0.0",
    mode: "read-only-static-audit",
    evaluatedAt,
    repository: {
      branch: git.branch ?? null,
      commit: git.commit ?? null,
      workingTreeClean: typeof git.workingTreeClean === "boolean" ? git.workingTreeClean : null,
    },
    qualityGate: {
      passed: checks.filter((check) => check.passed).length,
      total: checks.length,
      checks,
      allPassed: checks.every((check) => check.passed),
    },
    repositoryMetrics: {
      sourceFileCount: files.filter((file) => /^src\//.test(file)).length,
      testFileCount: testFiles.length,
      testFiles,
      migrationCount: migrations.length,
      migrations,
      trackedEnvironmentFiles: trackedEnv,
    },
    requirements: {
      total: requirementResults.length,
      declaredStatusCounts: statusCounts,
      evidencePathsPresent: evidenceTotal,
      evidencePathsExpected: evidenceExpected,
      evidenceCoverage: evidenceExpected ? Math.round((evidenceTotal / evidenceExpected) * 100) : 0,
      items: requirementResults,
    },
    warnings,
    policy: {
      readOnly: true,
      doesNotCallExternalServices: true,
      doesNotInspectSecretValues: true,
      neverUpgradesFeatureStatusAutomatically: true,
    },
  };
}

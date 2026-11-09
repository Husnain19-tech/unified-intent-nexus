# OmniFlow AI, Cloud & DevOps Delivery Roadmap

**Status:** Proposed engineering plan  
**Planning baseline:** 8 November 2026  
**Decision:** Run product development and reliability work in parallel. This document does not authorize production changes, cloud resource creation, data export, or model training on customer data.

## 1. Delivery model

Use a hybrid method:

- **Agile delivery:** one-week planning/review cycles, a prioritized product backlog, continuous Kanban flow for defects, and XP practices (small changes, automated tests, review, refactoring).
- **V-Model verification:** each requirement and design decision has a corresponding acceptance, integration, system, or unit test. Features are not complete on implementation alone.
- **Spiral risk control:** before high-impact work (database migrations, tenant isolation, autonomous actions, cloud identity, model/data pipelines), identify risks, prototype safely, validate assumptions, and only then proceed.

Starting capacity guideline (adjust per sprint): 60% product/cloud/AI capability, 25% verification/reliability, 15% maintenance. Security or data-integrity incidents override the allocation.

Every sprint must demonstrate at least one working capability and publish its verification evidence.

## 2. Workstreams

### A. Product reliability (continuous)

- Finish task/commitment atomic completion only after the RPC is tested against an isolated disposable database with RLS enabled.
- Test task, docs, knowledge, commitment and agent workflows end-to-end.
- Validate tenant isolation using at least two disposable organizations.
- Keep production migration and deployment blocked until a restorable backup and tested recovery procedure exist.
- Maintain a defect Kanban lane with severity, owner, reproduction steps, regression test, and release status.

### B. DevOps foundation

**Target architecture (to validate, not yet provisioned):**

- GitHub is source of truth.
- Pull-request CI: locked install, unit tests, lint, typecheck, deterministic evaluator, production build.
- Separate development, staging and production Supabase projects/environments; never point tests at production.
- GitHub Environments with protected approvals for staging and production.
- Secrets held in environment-scoped secret storage; never committed or printed in logs.
- Database migrations reviewed as code, applied first to disposable/staging DB, then production only after backup/restore verification and explicit release approval.
- Deployment artifact and source SHA recorded; smoke tests and rollback instructions attached to every release.
- Centralized structured logs, error tracking, uptime checks, and alerts with redaction of credentials and personal data.

**Exit criteria:** a repeatable staging release, tested rollback for application code, tested database recovery, and an auditable production approval gate.

### C. Azure integration pilot

Start with one bounded, non-production AI capability rather than migrating the whole application.

Candidate pilot: Azure-hosted model inference behind a provider-neutral server-side adapter, with the existing provider retained as fallback.

Design requirements:
- Keep provider credentials server-side and scoped to the environment.
- Use managed identity where supported; otherwise use least-privilege secrets.
- Add request timeouts, bounded retries for transient failures, rate limits, cost/usage telemetry, and safe fallback.
- Do not send tenant content to a new provider until data residency, retention, privacy terms, and user authorization are reviewed.
- Compare quality, latency, availability, and cost against the current provider using a fixed evaluation set.

Potential Azure services (selection pending requirements and account access): Azure AI Foundry / Azure OpenAI for inference; Azure AI Speech only for a defined speech use case; Azure Key Vault for secrets; Azure Monitor / Application Insights for observability. Avoid provisioning unused services.

**Pilot exit criteria:** one tested end-to-end workflow in staging, measured against baseline, with documented cost and failure behavior.

### D. Model and data engineering

Do not begin large-scale training until a measurable task, lawful dataset, and baseline evaluation exist.

1. Define a task and success metric (e.g., classify support intent, extract commitments, forecast workload).
2. Source datasets from Hugging Face or Kaggle only after checking license, provenance, permitted use, PII, and redistribution/training restrictions.
3. Build a reproducible data pipeline: immutable source manifest, versioned cleaned dataset, deduplication, split by organization/time where leakage is possible, and documented labels.
4. Establish baseline with existing hosted and open-weight models.
5. Evaluate a small model first; compare prompting, RAG, fine-tuning (LoRA/QLoRA), and task-specific deep-learning approaches.
6. Track experiment config, dataset/model versions, metrics, latency, GPU-hours and cost.
7. Red-team for leakage, hallucination, bias, prompt injection and unsafe tool use.
8. Deploy only if it beats the baseline on pre-agreed metrics and passes privacy/security review.

Never use customer data for training by default. Require explicit authorization, minimization, and de-identification before any such use.

### E. Integrations and autonomous workflows

- Prioritize integrations by user value and availability of stable APIs.
- Use OAuth where appropriate; encrypt tokens and scope access narrowly.
- Introduce idempotency keys, audit trails, timeouts, retries with backoff, and human approval for consequential actions.
- Expand from read-only connectors to reversible writes, then carefully gated autonomous actions.
- Each integration needs contract tests, sandbox tests and failure/revocation tests.

## 3. Proposed near-term sprint sequence

### Sprint 0 — Current reliability gate
- Review PR #14 SQL and TypeScript together.
- Test RPC transaction rollback, missing task, missing linked commitment, null commitment, valid task patch, and cross-tenant denial in an isolated database.
- Keep PR #14 draft until these tests pass. CI success alone does not validate database semantics.

### Sprint 1 — Staging and release engineering
- Identify/provision an isolated staging project (separate from production).
- Establish backup and restore evidence, protected GitHub environments, migration dry-run and release checklist.
- Add safe staging smoke tests.

### Sprint 2 — First cloud-backed AI pilot
- Define one bounded workflow and evaluation dataset.
- Add provider-neutral adapter and Azure staging configuration.
- Compare against current provider; no production routing until approved.

### Sprint 3 — Data/ML experiment
- Choose one task based on product value and available licensed data.
- Build baseline and reproducible experiment pipeline.
- Decide whether fine-tuning is justified from measured results.

### Sprint 4 onward — Expand integrations and model capabilities
- Deliver integrations and specialized AI capabilities in small independently testable slices.

These are sequencing targets, not guaranteed calendar commitments. Staging access, cloud account readiness, data licensing, and test results determine actual duration.

## 4. Definition of done

A work item is done only when:
- Acceptance criteria are met and demonstrated.
- Relevant unit/integration/system tests pass.
- Tenant boundaries and authorization are checked where applicable.
- Logs and metrics are sufficient to diagnose failure without leaking secrets.
- Rollback/recovery impact is documented.
- Documentation and Trello status reflect verified reality.
- Production changes have explicit approval and a verified recovery path.

## 5. Current safety boundaries

Until a disposable staging environment and restorable backup are proven:
- No production SQL writes or migrations.
- No manual production agent execution.
- No deployment that depends on an unapplied migration.
- No customer-data export or model-training use.
- Read-only audits and code-only PRs remain allowed.

## 6. Immediate decisions needed later

1. Confirm an isolated staging Supabase project and who owns its credentials.
2. Confirm Azure subscription/tenant availability and preferred region.
3. Select the first AI pilot workflow based on evaluation data and business value.
4. Select the first model-training task only after dataset licensing and baseline review.

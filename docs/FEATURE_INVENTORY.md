# OmniFlow — Feature Inventory Against Product Vision

> Evidence snapshot: 5 November 2026  
> Baseline commit: `59598edf46f305264ab1fe5b71c77ee9396a1517`  
> Method: static repository inspection of routes, server functions, AI modules, migrations, tests, and CI configuration. This is not a runtime acceptance report. No production data was changed.

## How to read this inventory

- **Implemented (code evidence):** meaningful UI/server/database implementation exists. This label alone does not imply that every workflow has passed runtime acceptance.
- **Partial:** a useful slice exists, but important product acceptance criteria, integrations, automation, or verification are missing.
- **Planned / not evidenced:** present in the long-term README or roadmap but no implementation was established in this review.
- **Unknown:** there is a route or data shape, but available evidence is not enough to determine the depth or correctness of behavior.

The root README is the aspirational OmniFlow vision and includes a legacy proposed stack. It is not an accurate description of the current runtime stack. Do not use UI route count, seeded demo records, or commit activity as a completion metric.

## Executive assessment

The current repository is a React 19 + TypeScript + TanStack Start application using Supabase/Postgres, Tailwind 4, and a Lovable AI Gateway configured with Anthropic-compatible reasoning and Gemini embeddings. It contains meaningful operational workflows for tasks, documents, commitments, knowledge retrieval, sales leads, pipeline, call-transcript analysis, support tickets, basic finance records, and four AI agents.

The evidence does **not** support calling the current build a complete autonomous business operating system, a production CRM/ERP replacement, or a platform with 50+ live integrations. The current product is a functional operations MVP/prototype with AI-assisted and partially autonomous capabilities.

## Feature-by-feature inventory

| Vision capability | Status | Repository evidence | What exists now / remaining gap |
|---|---|---|---|
| Tasks & Projects | **Partial** | `src/routes/_authenticated/tasks.tsx`; `src/lib/tasks.functions.ts`; `drizzle/migrations/0000_tasks_and_projects.sql` | Task CRUD, status/priority/assignee/due date, projects, commitment-to-task conversion, and AI day planning exist in code. No dedicated task workflow tests or end-to-end evidence; verify create/update/delete/complete and org isolation in a disposable environment. |
| Docs & Wiki | **Partial** | `src/routes/_authenticated/docs.tsx`; `src/lib/docs.functions.ts`; `drizzle/migrations/0001_create_docs.sql` | Create/edit/delete document flow and company-memory source synchronization exist. Empty-document indexing cleanup was fixed in PR #5. Runtime UI feedback, failure recovery, and full CRUD still need end-to-end verification. |
| Contextual Knowledge Mesh | **Partial** | `src/routes/_authenticated/knowledge.tsx`; `src/lib/knowledge.server.ts`; `src/lib/ai-gateway.server.ts`; `src/lib/nlp.server.ts`; `src/lib/knowledge.server.test.ts` | Text chunking, embeddings, organization-scoped vector search, reindexing, retrieval and source-grounded answer flow exist. No demonstrated temporal knowledge graph, multimodal ingestion, predictive context surfacing, or automated connectors. Reindexing and AI-provider error paths have targeted unit coverage; runtime provider/RLS acceptance remains open. |
| Micro-Commitment Tracker | **Partial** | `src/routes/_authenticated/commitments.tsx`; `src/lib/omniflow.functions.ts`; `src/lib/knowledge.server.ts` | Text/source ingestion extracts promises with owner, counterparty, due date and risk fields; commitments can be tracked, marked delivered/broken, semantically indexed, and converted to tasks. Risk score is not yet validated against a labeled dataset; social-capital scoring and promise-chain impact analysis are not evidenced. |
| Client Expectation Mapper | **Partial** | `src/routes/_authenticated/expectations.tsx`; `src/lib/omniflow.functions.ts`; `project-requirements.json` | Client/team expectation records and AI gap analysis action exist. The route invokes analysis per client. Evidence does not establish a full dual-sided capture workflow, expectation history/versioning, heatmap, or validated conflict prediction. |
| Silent Dependency Monitor | **Partial** | `src/routes/_authenticated/dependencies.tsx`; `src/lib/omniflow.functions.ts` | Users can add dependency records and request AI analysis using dependency and open-commitment context. This is not a repository scanner or dependency graph engine: no evidence of package/config ingestion, source usage analysis, breaking-change feeds, or isolated upgrade simulation. |
| AI CEO / autonomous operations | **Partial** | `src/routes/_authenticated/ceo.tsx`; `src/lib/agents.functions.ts`; `src/lib/agents.server.ts`; `src/routes/api/public/agents/run.ts`; `supabase/migrations/20261003200051_4312b2fc-4106-4ef4-9891-c07079f145ec.sql` | Four agents exist: sales, voip, support, pipeline. There is pause/resume, manual/hourly execution, run/decision logging, and undo support. This does not cover all eight README pillars. Human approval gates, full rollback guarantees, bounded-action policy testing, and runtime isolation tests need further review. |
| Sales outreach | **Partial** | `src/routes/_authenticated/sales.tsx`; `src/lib/omniflow.functions.ts`; `src/lib/nlp.server.ts` | Lead records, stage changes, touch history, and AI-drafted personalized outreach exist. The reviewed UI drafts messages; no verified outbound email/LinkedIn/SMS delivery integration or OAuth connector is established. |
| Predictive pipeline | **Partial** | `src/routes/_authenticated/pipeline.tsx`; `src/lib/omniflow.functions.ts` | Deal stage/value/probability, AI health scoring, and pipeline analysis exist. No calibrated prediction evaluation, CRM sync, or external sales-system integration is established. |
| VoIP intelligence | **Partial** | `src/routes/_authenticated/calls.tsx`; `src/lib/nlp.server.ts`; `src/lib/omniflow.functions.ts` | Users can submit call transcripts for summaries, sentiment, objections, talk ratio and action items, then promote promises to commitments. No live dialer, telephony provider, recording ingestion, or real-time call stream is evidenced. |
| Customer support | **Partial** | `src/routes/_authenticated/support.tsx`; `src/lib/nlp.server.ts`; `src/lib/omniflow.functions.ts` | Tickets can be logged, AI replies drafted from company memory, escalations/status tracked, and promises promoted. No verified external helpdesk inbox, customer-facing delivery, or ticket-provider sync is evidenced. |
| Finance / cashflow | **Partial** | `src/routes/_authenticated/finance.tsx`; `src/lib/omniflow.functions.ts` | Invoice and expense records, status updates, and AI cashflow analysis exist. No bank/payment/accounting integrations, automated invoice-to-cash, reconciliation, or independently verified overdue-state automation is established. |
| Command Center | **Partial** | `src/routes/_authenticated/command.tsx`; `src/lib/omniflow.functions.ts`; `src/lib/agents.functions.ts` | Aggregates commitments, workload, pipeline, invoices, support, dependencies, and agent decisions into an operational overview with AI briefing. Its accuracy depends on underlying record quality and integrations, and is not yet validated against external systems. |
| People / team directory | **Partial** | `src/routes/_authenticated/people.tsx`; `src/lib/omniflow.functions.ts` | Organization people records are present and used for ownership/workload. No full HRIS, skills inventory, performance coaching, hiring workflow, or resource optimization is evidenced. |
| AI hiring intelligence | **Planned / not evidenced** | README vision only | No implemented hiring evaluation workflow or evidence of bias/accessibility testing found. |
| Universal connector framework / 50+ integrations | **Planned / not evidenced** | README vision only; repository tree has no connector-specific modules | No connector contract, OAuth/token lifecycle, webhook/event framework, or verified catalog of live third-party connectors found. Do not claim Slack, Jira, GitHub, QuickBooks, Zoom, Outlook, Twilio, etc. are integrated. |
| Team chat / unified inbox | **Planned** | README / roadmap vision | No connected multi-channel messaging inbox or Slack sync established. |
| Email / calendar / meetings | **Planned** | README / roadmap vision | No Outlook/Google calendar authorization, event sync, meeting scheduling, or Zoom/Teams integration established. |
| Workflow automation / process discovery | **Partial / early** | AI agent execution and scheduled runner files above | Hourly agent runner exists, but a general-purpose cross-system workflow designer, event bus, process mining, and durable orchestration engine are not evidenced. |
| Financial integration hub | **Planned** | README vision; finance records are native only | Finance screens are not proof of QuickBooks, Stripe, bank, or payment integrations. |
| Compliance / audit tracker | **Partial** | Agent decision log and undo fields in `agents.server.ts` and agent migration | Agent decisions capture before/after values and rationale. No broad compliance framework, retention controls, regulatory mappings, or complete audit coverage across all modules is established. |
| Self-improvement learning loop | **Planned / not evidenced** | README vision | No validated feedback loop that learns from outcomes and updates policies/models was found. |

## Current implementation map

### Application routes

Authenticated route inventory from the repository tree:

- Core work: `tasks`, `docs`, `commitments`, `knowledge`, `command`
- Intelligence models: `expectations`, `dependencies`
- Revenue and service: `sales`, `pipeline`, `calls`, `support`
- Operations: `finance`, `people`, `ceo`

A route is only the UI entry point. Its server function, database behavior, permissions, and tests determine the real implementation depth.

### Server-side capabilities

- `src/lib/tasks.functions.ts`: task/project CRUD, task completion, commitment-to-task conversion, AI day planning.
- `src/lib/docs.functions.ts`: document CRUD and source/index synchronization.
- `src/lib/omniflow.functions.ts`: workspace aggregation, source ingestion, commitments, knowledge Q&A/reindexing, expectation/dependency analysis, sales, calls, support, pipeline, invoices and cashflow.
- `src/lib/knowledge.server.ts`: chunking, embedding persistence, retrieval and repair of incomplete indexes.
- `src/lib/nlp.server.ts`: structured AI workflows for outreach, transcript analysis, and support replies.
- `src/lib/agents.server.ts`: four agent types, decision execution, logging and undo.
- `src/lib/ai-gateway.server.ts`: AI Gateway provider and embedding client.

### Database / schema evidence

- Drizzle migrations: task/project and docs tables.
- Supabase migrations: organization/workspace schema, business-domain records, knowledge vectors/RPCs, and agent settings/runs/decisions plus private scheduler token and single-flight lease.
- Multi-tenant scoping is present in server functions and RLS policies, but runtime cross-tenant isolation has not been proven by a controlled two-organization test.

### Automated verification

Repository test files at this snapshot:

- `src/lib/ai-errors.server.test.ts`
- `src/lib/knowledge.server.test.ts`

Package scripts include `test`, `lint`, `typecheck`, and `build`. GitHub Actions CI run #34 passed dependency installation, unit tests, ESLint, TypeScript typecheck, and production build before PR #5 was merged. The current test suite is still narrow relative to the product surface: no E2E test suite or broad DB/RLS integration suite was found.

## Priority gap list

1. **P0 — Runtime safety and tenant isolation:** create/approve a disposable staging organization/account and test create/update/delete/complete flows plus cross-tenant read/write denial. Keep production data untouched.
2. **P0 — End-to-end core workflows:** tasks ↔ commitments, docs ↔ knowledge index ↔ Q&A, lead ↔ outreach draft ↔ touch history, ticket ↔ AI reply ↔ escalation, deal ↔ health score, invoice/expense ↔ cashflow.
3. **P1 — Seed/demo data boundary:** clearly label demo fixtures and ensure user-facing analytics distinguish sample data from live customer data.
4. **P1 — Agent safety:** test action allowlists, org scoping, pause behavior, lease expiry, undo correctness, partial failures, and idempotency. Add approval gates for higher-impact actions.
5. **P1 — AI evaluation:** create small reviewed datasets for promise extraction, expectation gaps, dependency analysis, lead outreach, call summaries, support replies, and deal scoring. Track accuracy and hallucination rates rather than trusting model output.
6. **P1 — Integration foundation:** define a connector interface, OAuth/token storage, webhook signature verification, idempotency, retries, and connector health before claiming integrations.
7. **P2 — Product-vision modules:** hiring intelligence, temporal/multimodal knowledge graph, team chat, calendar/meetings, telephony, finance integrations, and self-improvement loop.

## Explicit non-claims

At this snapshot, do not claim:

- 50+ live integrations;
- production VoIP/dialer or real-time call monitoring;
- outbound email/LinkedIn/SMS automation;
- fully autonomous eight-pillar AI CEO;
- predictive hiring or bias-free candidate ranking;
- a dependency scanner that analyzes the repository or simulates upgrades;
- enterprise-grade compliance, self-learning, or cross-system workflow orchestration;
- runtime tenant isolation or full end-to-end acceptance merely because CI passes.

## Next verification evidence required

For every row upgraded to **Implemented**, attach at least one code path and the relevant automated/runtime verification run. For external integrations, record provider, sandbox/live account, scopes, webhook verification, token refresh, retry/idempotency behavior, and test date. Keep secrets and personal/customer data out of this report.

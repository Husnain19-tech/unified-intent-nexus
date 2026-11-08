# OmniFlow — Current Technical Architecture

> Status: initial static-code review of the `main` branch, 1 November 2026. This document records code evidence, not a successful runtime or deployment verification. Re-check it as the code changes.

## Product and architecture boundaries

OmniFlow is being developed toward an AI-native business operating system. The root `README.md` is the long-term product vision and contains an earlier proposed technology stack. It is not a reliable inventory of the current implementation. Use this document for the current stack and `IMPLEMENTATION_STATUS.md` for evidence-backed delivery status.

## Current stack evidenced in the repository

| Layer | Current evidence |
|---|---|
| UI / application | React 19, TypeScript, TanStack Start and TanStack Router |
| Build / development | Vite 8, `@lovable.dev/vite-tanstack-config`, Bun lockfile |
| Styling | Tailwind CSS 4, Radix UI components |
| Data and authentication | Supabase JS client, Supabase Postgres, authenticated middleware |
| Database schema / migrations | Supabase migrations and Drizzle configuration are present |
| AI reasoning | Vercel AI SDK with Anthropic provider adapter |
| AI model routing | Anthropic-compatible requests routed through `https://ai.gateway.lovable.dev/v1`; model constant currently `anthropic/claude-sonnet-5` |
| Embeddings | Lovable AI Gateway embeddings endpoint; model constant currently `google/gemini-embedding-2` |
| Server-side logic | TanStack Start server routes and `*.functions.ts` / `*.server.ts` modules |

### AI provider detail

`src/lib/ai-gateway.server.ts` exports `createLovableClaudeProvider`. It configures the Anthropic SDK with the Lovable gateway as `baseURL`, so this is not currently a direct Anthropic API endpoint. The API key is supplied at runtime. Embeddings use a separate gateway endpoint and model.

Do not place key values in source, documentation, examples, or evaluator output. Environment variable *names* may be documented; values must remain in the deployment secret store.

## Important implementation boundaries

- `src/lib/knowledge.server.ts` contains chunking/indexing/retrieval helpers backed by embeddings and the `match_knowledge_chunks` database RPC.
- `src/lib/nlp.server.ts` contains structured AI workflows for outreach and call analysis, plus semantic retrieval helpers.
- `src/lib/agents.server.ts` currently declares four agent types: sales, voip, support, and pipeline. This is not evidence that all eight AI CEO pillars from the vision are complete.
- Supabase admin access uses a service-role key and bypasses RLS. Keep that client in server-only modules and never expose it to browser code.
- The roadmap currently marks Tasks & Projects and Docs & Wiki complete; later roadmap phases remain unchecked.

## Environment variables observed by name

The code references these names. Confirm deployment configuration separately; this list does not prove that values are configured.

- `LOVABLE_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_CRON_SECRET`
- `LOVABLE_CRON_SECRET_PREVIOUS`
- `LOVABLE_DB_MIGRATION_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`



### Environment template

The repository includes a placeholder-only `.env.example` for local setup. Copy it to a local `.env` file and supply credentials through your own secret manager or local environment. Never commit a populated `.env` file. `LOVABLE_DB_MIGRATION_URL` is only needed for a separately authorized migration workflow; it is not required for normal application startup.

## Verification gaps

At the time of the initial static review, `package.json` had `dev`, `build`, `build:dev`, `preview`, `lint`, and `format` scripts. A subsequent CI workflow now runs locked dependency installation, ESLint, and production build. The latest recorded CI run passed all three steps; the lint configuration still emits non-blocking warnings in legacy adapter modules and React components. A dedicated `tsc --noEmit` typecheck is now enforced as a separate CI step. There is still no test script or visible unit/e2e test framework.

## Evaluator rules

1. Treat the root README's proposed stack as vision/history, not a list of mandatory dependencies.
2. Treat `roadmap.md` checkboxes as owner-maintained claims, not independent proof.
3. Mark a capability complete only when its implementation and relevant verification evidence are both present.
4. A UI route without working persistence/business logic/integration is partial.
5. Distinguish native implementation, mocked/demo behavior, third-party integration, and roadmap intent.
6. Never expose secret values in reports, logs, artifacts, or dashboard data.

# OmniFlow MVP — Commitment Tracker Core

A real, working first version of OmniFlow with accounts, a live database, and AI — built as a dark command center. Since a true MVP needs depth to be believable, one model is built for real end-to-end, and the other three ship as connected views fed by the same real data rather than fake dashboards.

## What gets built for real

**Micro-Commitment Tracker (the promise & accountability layer)**

- Paste or type any message, meeting note, or chat thread. AI reads it and extracts every promise: who owes what, to whom, and by when.
- Each extracted promise becomes a tracked commitment you can confirm, edit, complete, or mark as broken.
- A live board of commitments: overdue, due today, upcoming, delivered.
- AI risk scoring per promise (likely to land / at risk / likely to slip) with a one-line reason.
- Reliability scores per person, computed from their real delivery history.
- Impact view: when one promise slips, see which other commitments depend on it.

Everything is stored per account with proper access rules — your organization's data is only visible to your organization.

## The other three areas

Built as real screens driven by the same commitment data, so they are honest rather than mocked:

- **Knowledge Mesh** — a searchable timeline of every ingested message and the decisions/promises pulled from it, with an AI answer box ("why did we agree to X?") that answers from your own stored content.
- **Expectation Mapper** — per-client view comparing what was promised outwardly vs. what is tracked internally, with AI-flagged gaps.
- **AI Operations Core** — an executive command view: workload per person, at-risk deals/projects, and an AI daily briefing generated from the live data.

## Look and feel

Dark command center: near-black surfaces, cool graphite panels, a single electric accent for live/critical signals, amber for at-risk, restrained green for delivered. Monospaced numerals for scores and countdowns, tight data-dense layout, subtle glow on live elements. No purple gradients, no generic SaaS marketing look.

## Screens

- Sign in / sign up
- Command Center (overview + AI briefing)
- Commitments (capture, board, detail)
- People & Reliability
- Knowledge Mesh (timeline + ask)
- Expectation Mapper
- Public landing page at the entry route explaining OmniFlow, with a link into the app

## Technical notes

- Stack stays Lovable's: React + TanStack Start, Tailwind, Lovable Cloud for auth/database, Lovable AI for all extraction, scoring, and briefings. The NestJS / Neo4j / Weaviate / local-LLM stack in the brief is not what this platform runs; the same capabilities are delivered through Lovable Cloud and Lovable AI.
- Tables: organizations, memberships, people, sources (ingested text), commitments, commitment_events, clients, expectations. Row-level security scoped to organization membership, with grants on every table.
- AI work runs server-side via server functions with structured output; risk scores and briefings are generated on demand and cached.
- Seeded demo organization data so the first screen is populated immediately.

## Not in this build

Live integrations with Slack/Jira/Zoom/QuickBooks, VoIP and call analytics, real dependency scanning of code repos, and payments. Text ingestion is manual paste for now; connectors can come next.

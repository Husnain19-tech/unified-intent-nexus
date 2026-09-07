# OmniFlow: Six New Operating Models

Add six full screens on top of the existing workspace, each backed by real data in your workspace, real actions, and AI analysis — and each feeding numbers back into the Command Center.

## Navigation

The sidebar becomes grouped so eleven screens stay readable:

```text
INTELLIGENCE   Command Center · Knowledge Mesh · Dependency Monitor
REVENUE        Sales Orchestrator · Pipeline · VoIP Intelligence
OPERATIONS     Commitments · People · Expectations · Support · Finance
```

## The six screens

**1. Silent Dependency Monitor**
Register the packages, tools and internal services you rely on, each with a version, criticality and where it is used. The board ranks them by fragility, shows which commitments and clients break if one fails, and an AI "breaking change forecast" explains the specific risk and a migration path. A technical-debt figure estimates the ongoing cost of the shortcuts you have logged.

**2. AI Sales Orchestrator**
Leads with company, contact, value, stage and channel. For any lead, AI writes a personalised multi-channel outreach message and recommends the follow-up timing based on the last touch and recorded sentiment. Log touches; each one updates the lead's temperature.

**3. VoIP Intelligence**
A call log with duration, direction, participant and transcript. Paste or add a call and AI returns a summary, sentiment, objections raised, talk-ratio estimate and next-step action items — and can turn any action item into a tracked commitment in the existing Commitments screen.

**4. Autonomous Customer Support**
An inbox of tickets with requester, channel, priority and status. The AI receptionist drafts a reply from your own knowledge (existing notes and commitments), decides whether it can resolve or must escalate, and shows a deflection rate. Escalated tickets can create a commitment with an owner.

**5. Predictive Pipeline**
Deals with value, stage, close date and owner, scored for deal health from activity, expectation gaps and commitment reliability on that client. Weighted forecast, stage-by-stage conversion, bottleneck detection and an AI recommendation on where to spend effort this week.

**6. Financial Intelligence**
Invoices and expenses with amounts, due dates and status. Cash-flow projection over the next 90 days, per-client profitability, overdue receivables, and an AI cash commentary. Mark invoices paid or overdue.

## Command Center connection

The Command Center gains a second row of live tiles pulling from the new data — pipeline weighted value, cash position and overdue receivables, support deflection rate, fragile dependencies, and calls needing follow-up — each linking to its screen. The AI daily briefing prompt is widened to read pipeline, support, finance and dependency signals alongside commitments, so one briefing covers the whole business.

## Technical notes

- New tables (all organization-scoped, same row-level security pattern as today, with grants): `dependencies`, `leads`, `lead_touches`, `calls`, `tickets`, `deals`, `invoices`, `expenses`. Realistic demo rows for each are added to `bootstrap_workspace()` so a fresh sign-in lands on populated screens; existing workspaces get the same rows via a one-off data backfill.
- `getWorkspace` is extended to return the new collections in one round trip; `useWorkspace` stays the single source for all screens.
- New server functions in `src/lib/omniflow.functions.ts`, all behind `requireSupabaseAuth`: `draftOutreach`, `logLeadTouch`, `analyseCall`, `draftTicketReply`, `setTicketStatus`, `scoreDeal`, `analysePipeline`, `analyseCashflow`, `analyseDependency`, plus small status/create mutations and `promoteToCommitment` (shared by calls and tickets).
- Six route files under `src/routes/_authenticated/` with their own page metadata; `shell.tsx` gains grouped nav sections.
- Reuse existing panel/risk styling and helpers so the six screens match the dark command-center look.

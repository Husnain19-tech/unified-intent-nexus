import { z } from "zod";

type Db = {
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  from: (table: string) => any;
};

export const AGENTS = ["sales", "voip", "support", "pipeline"] as const;
export type AgentName = (typeof AGENTS)[number];

const BATCH = 6;

const DecisionSchema = z.object({
  decisions: z.array(
    z.object({
      item_id: z.string(),
      action: z.string(),
      stage: z.string(),
      sentiment: z.string(),
      score: z.number(),
      probability: z.number(),
      note: z.string(),
      reply: z.string(),
      followup: z.string(),
      followup_days: z.number(),
      items: z.array(z.string()),
      rationale: z.string(),
    }),
  ),
});
type Decision = z.infer<typeof DecisionSchema>["decisions"][number];

export class AgentPause extends Error {}

function statusOf(error: unknown): number | undefined {
  const e = error as { statusCode?: number; status?: number; cause?: { statusCode?: number } };
  return e?.statusCode ?? e?.status ?? e?.cause?.statusCode;
}

async function decide(key: string, instructions: string, items: unknown[]): Promise<Decision[]> {
  const { createLovableResponsesProvider, OMNIFLOW_REASONING_MODEL, REASONING_OPTIONS } = await import(
    "./ai-gateway.server"
  );
  const { streamText, Output, NoObjectGeneratedError } = await import("ai");
  const provider = createLovableResponsesProvider(key);
  const prompt = `Today is ${new Date().toDateString()}.\n${instructions}\n\nEvery decision must include every field. Use an empty string, 0 or an empty list for fields that do not apply. rationale is one short sentence a manager can read.\n\nITEMS:\n${JSON.stringify(items, null, 1)}`;
  try {
    const result = streamText({
      model: provider.responses(OMNIFLOW_REASONING_MODEL),
      output: Output.object({ schema: DecisionSchema }),
      prompt,
      providerOptions: REASONING_OPTIONS as any,
    });
    return (await result.output).decisions;
  } catch (error) {
    const status = statusOf(error);
    if (status === 402) throw new AgentPause("Out of AI credits — add credits, then resume the agents.");
    if (status === 403) throw new AgentPause("AI access is blocked for this workspace — resume once it is re-enabled.");
    if (NoObjectGeneratedError.isInstance(error) && error.text) {
      try {
        return DecisionSchema.parse(JSON.parse(error.text)).decisions;
      } catch {
        return [];
      }
    }
    throw error;
  }
}

type Ctx = { db: Db; orgId: string; runId: string; key: string };

async function record(
  ctx: Ctx,
  d: {
    agent: AgentName;
    action: string;
    table: string;
    id: string;
    label: string;
    before?: unknown;
    after?: unknown;
    created?: boolean;
    rationale: string;
  },
) {
  await ctx.db.from("agent_decisions").insert({
    org_id: ctx.orgId,
    run_id: ctx.runId,
    agent: d.agent,
    action: d.action,
    target_table: d.table,
    target_id: d.id,
    target_label: d.label.slice(0, 200),
    before: d.before ?? null,
    after: d.after ?? null,
    created_record: d.created ?? false,
    rationale: d.rationale.slice(0, 500),
  });
}

async function updateTracked(
  ctx: Ctx,
  agent: AgentName,
  table: string,
  row: Record<string, unknown> & { id: string },
  patch: Record<string, unknown>,
  action: string,
  label: string,
  rationale: string,
) {
  const keys = Object.keys(patch).filter((k) => JSON.stringify(row[k] ?? null) !== JSON.stringify(patch[k] ?? null));
  if (keys.length === 0) return 0;
  const before = Object.fromEntries(keys.map((k) => [k, row[k] ?? null]));
  const after = Object.fromEntries(keys.map((k) => [k, patch[k]]));
  const { error } = await ctx.db.from(table).update(after).eq("id", row.id).eq("org_id", ctx.orgId);
  if (error) throw new Error(error.message);
  await record(ctx, { agent, action, table, id: row.id, label, before, after, rationale });
  return 1;
}

async function createCommitment(
  ctx: Ctx,
  agent: AgentName,
  values: { owner_name: string; counterparty: string | null; promise: string; days: number; client_id?: string | null },
  rationale: string,
) {
  const days = Math.max(0, Math.min(30, Math.round(values.days || 2)));
  const { data, error } = await ctx.db
    .from("commitments")
    .insert({
      org_id: ctx.orgId,
      owner_name: values.owner_name.slice(0, 120),
      counterparty: values.counterparty?.slice(0, 120) ?? null,
      promise: values.promise.slice(0, 400),
      client_id: values.client_id ?? null,
      due_at: new Date(Date.now() + days * 86400000).toISOString(),
      status: "open",
      risk_score: 35,
      risk_label: "on_track",
      risk_reason: `Created automatically by the ${agent} agent.`,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await record(ctx, {
    agent,
    action: "create_commitment",
    table: "commitments",
    id: data.id,
    label: values.promise,
    after: values,
    created: true,
    rationale,
  });
  return 1;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

async function salesAgent(ctx: Ctx) {
  const cutoff = new Date(Date.now() - 3 * 86400000).toISOString();
  const { data } = await ctx.db
    .from("leads")
    .select("*")
    .eq("org_id", ctx.orgId)
    .not("stage", "in", "(won,lost)")
    .or(`last_touch_at.is.null,last_touch_at.lt.${cutoff}`)
    .limit(BATCH);
  const leads = (data ?? []) as any[];
  if (!leads.length) return 0;
  const decisions = await decide(
    ctx.key,
    "You are the autonomous sales agent. For each lead that has gone quiet decide: action is advance, nurture, mark_lost or no_change. stage is the new stage, one of new, contacted, qualified, proposal, won, lost. sentiment is cold, neutral, warm or hot. followup is the next outreach step as a short imperative (or empty), followup_days is when to do it. note is a one-line log of what you decided.",
    leads.map((l) => ({ item_id: l.id, company: l.company, contact: l.contact_name, stage: l.stage, value: l.value, sentiment: l.sentiment, notes: l.notes, last_touch_at: l.last_touch_at })),
  );
  let n = 0;
  for (const d of decisions) {
    const lead = leads.find((l) => l.id === d.item_id);
    if (!lead || d.action === "no_change") continue;
    const stages = ["new", "contacted", "qualified", "proposal", "won", "lost"];
    const patch: Record<string, unknown> = { last_touch_at: new Date().toISOString() };
    if (stages.includes(d.stage)) patch.stage = d.stage;
    if (["cold", "neutral", "warm", "hot"].includes(d.sentiment)) patch.sentiment = d.sentiment;
    n += await updateTracked(ctx, "sales", "leads", lead, patch, d.action, lead.company, d.rationale);
    if (d.note) {
      await ctx.db.from("lead_touches").insert({ org_id: ctx.orgId, lead_id: lead.id, channel: "ai", note: `AI agent: ${d.note}`.slice(0, 500), sentiment: (patch.sentiment as string) ?? lead.sentiment });
    }
    if (d.followup && d.action !== "mark_lost") {
      n += await createCommitment(ctx, "sales", { owner_name: "Sales agent", counterparty: lead.contact_name ?? lead.company, promise: d.followup, days: d.followup_days }, d.rationale);
    }
  }
  return n;
}

async function voipAgent(ctx: Ctx) {
  const { data } = await ctx.db.from("calls").select("*").eq("org_id", ctx.orgId).is("summary", null).limit(BATCH);
  const calls = (data ?? []) as any[];
  if (!calls.length) return 0;
  const decisions = await decide(
    ctx.key,
    "You are the autonomous call-intelligence agent. For each unanalysed call: action is analyse. note is a two sentence summary. sentiment is positive, neutral, mixed or negative. reply is a comma separated list of objections (or empty). score is the percentage of talking done by our side (0-100). items are up to three concrete follow-up actions as short imperatives. followup_days is when those follow-ups are due.",
    calls.map((c) => ({ item_id: c.id, participant: c.participant, direction: c.direction, transcript: String(c.transcript).slice(0, 6000) })),
  );
  let n = 0;
  for (const d of decisions) {
    const call = calls.find((c) => c.id === d.item_id);
    if (!call) continue;
    const items = d.items.slice(0, 3).map((s) => s.slice(0, 200));
    n += await updateTracked(ctx, "voip", "calls", call, {
      summary: d.note.slice(0, 1000),
      sentiment: ["positive", "neutral", "mixed", "negative"].includes(d.sentiment) ? d.sentiment : "neutral",
      objections: d.reply.slice(0, 500),
      talk_ratio: clamp(d.score, 0, 100),
      action_items: items,
    }, "analyse", `Call with ${call.participant}`, d.rationale);
    for (const item of items) {
      n += await createCommitment(ctx, "voip", { owner_name: "Call agent", counterparty: call.participant, promise: item, days: d.followup_days, client_id: call.client_id }, `Follow-up from call with ${call.participant}.`);
    }
  }
  return n;
}

async function supportAgent(ctx: Ctx) {
  const { data } = await ctx.db.from("tickets").select("*").eq("org_id", ctx.orgId).eq("status", "open").is("ai_reply", null).limit(BATCH);
  const tickets = (data ?? []) as any[];
  if (!tickets.length) return 0;
  const decisions = await decide(
    ctx.key,
    "You are the autonomous support agent. For each open ticket: action is resolve when a clear, safe answer can be given, escalate when it needs a human (billing disputes, outages, legal, angry high-value customers), or wait when more information is needed from the customer. reply is the full customer-facing reply (under 120 words). note is a one-line internal resolution note.",
    tickets.map((t) => ({ item_id: t.id, requester: t.requester, priority: t.priority, subject: t.subject, body: t.body })),
  );
  let n = 0;
  for (const d of decisions) {
    const t = tickets.find((x) => x.id === d.item_id);
    if (!t) continue;
    const status = d.action === "resolve" ? "resolved" : d.action === "escalate" ? "escalated" : "open";
    n += await updateTracked(ctx, "support", "tickets", t, { ai_reply: d.reply.slice(0, 2000) || null, status, resolution: d.note.slice(0, 500) || null }, d.action, t.subject, d.rationale);
  }
  return n;
}

async function pipelineAgent(ctx: Ctx) {
  const stale = new Date(Date.now() - 86400000).toISOString();
  const { data } = await ctx.db
    .from("deals")
    .select("*")
    .eq("org_id", ctx.orgId)
    .not("stage", "in", "(closed_won,closed_lost)")
    .or(`health_score.is.null,updated_at.lt.${stale}`)
    .limit(BATCH);
  const deals = (data ?? []) as any[];
  if (!deals.length) return 0;
  const decisions = await decide(
    ctx.key,
    "You are the autonomous pipeline agent. For each open deal: action is rescore, advance, or mark_lost. score is deal health 0-100, probability is win probability 0-100, stage is one of qualify, discovery, proposal, negotiation, closed_won, closed_lost (keep the current stage unless there is clear evidence). note is a one-line health explanation. Only mark_lost when the close date is long past with no sign of life.",
    deals.map((d) => ({ item_id: d.id, name: d.name, owner: d.owner_name, stage: d.stage, value: d.value, probability: d.probability, close_date: d.close_date, health_score: d.health_score, health_note: d.health_note })),
  );
  let n = 0;
  for (const d of decisions) {
    const deal = deals.find((x) => x.id === d.item_id);
    if (!deal) continue;
    const stages = ["qualify", "discovery", "proposal", "negotiation", "closed_won", "closed_lost"];
    const patch: Record<string, unknown> = {
      health_score: clamp(d.score, 0, 100),
      probability: clamp(d.probability, 0, 100),
      health_note: d.note.slice(0, 400),
    };
    if (stages.includes(d.stage)) patch.stage = d.stage;
    n += await updateTracked(ctx, "pipeline", "deals", deal, patch, d.action, deal.name, d.rationale);
  }
  return n;
}

const RUNNERS: Record<AgentName, (ctx: Ctx) => Promise<number>> = {
  sales: salesAgent,
  voip: voipAgent,
  support: supportAgent,
  pipeline: pipelineAgent,
};

/** Run every agent once for one organization, guarded by a lease and the paused flag. */
export async function runAgents(db: Db, orgId: string, key: string, trigger: "manual" | "schedule") {
  const { data: settings } = await db.from("agent_settings").select("paused,pause_reason").eq("org_id", orgId).maybeSingle();
  if (settings?.paused) return { status: "paused", reason: settings.pause_reason as string | null, decisions: 0 };

  const { data: got, error: leaseError } = await db.rpc("acquire_agent_lease", { v_org: orgId, v_seconds: 600 });
  if (leaseError) throw new Error(leaseError.message);
  if (!got) return { status: "busy", reason: "Agents are already running.", decisions: 0 };

  const { data: run, error: runError } = await db
    .from("agent_runs")
    .insert({ org_id: orgId, trigger })
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);

  const ctx: Ctx = { db, orgId, runId: run.id, key };
  const perAgent: Record<string, number> = {};
  let total = 0;
  let status = "done";
  let errorText: string | null = null;

  for (const agent of AGENTS) {
    try {
      perAgent[agent] = await RUNNERS[agent](ctx);
      total += perAgent[agent]!;
    } catch (error) {
      if (error instanceof AgentPause) {
        status = "paused";
        errorText = error.message;
        await db.from("agent_settings").update({ paused: true, pause_reason: error.message }).eq("org_id", orgId);
        break;
      }
      perAgent[agent] = 0;
      errorText = `${agent}: ${(error as Error).message}`.slice(0, 500);
      status = "partial";
    }
  }

  const summary = AGENTS.map((a) => `${a} ${perAgent[a] ?? 0}`).join(" · ");
  await db
    .from("agent_runs")
    .update({ status, decisions: total, summary, error: errorText, finished_at: new Date().toISOString() })
    .eq("id", run.id);
  await db
    .from("agent_settings")
    .update({ lease_until: null, last_run_at: new Date().toISOString() })
    .eq("org_id", orgId);

  return { status, reason: errorText, decisions: total };
}

/** Reverse a single agent decision. */
export async function undoDecision(db: Db, orgId: string, id: string) {
  const { data: d, error } = await db.from("agent_decisions").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!d) throw new Error("Decision not found.");
  if (d.undone_at) return { ok: true };
  const allowed = ["leads", "calls", "tickets", "deals", "commitments"];
  if (!allowed.includes(d.target_table)) throw new Error("This decision cannot be undone.");
  if (d.created_record) {
    const { error: e } = await db.from(d.target_table).delete().eq("id", d.target_id).eq("org_id", orgId);
    if (e) throw new Error(e.message);
  } else if (d.before) {
    const { error: e } = await db.from(d.target_table).update(d.before).eq("id", d.target_id).eq("org_id", orgId);
    if (e) throw new Error(e.message);
  }
  await db.from("agent_decisions").update({ undone_at: new Date().toISOString() }).eq("id", id);
  return { ok: true };
}

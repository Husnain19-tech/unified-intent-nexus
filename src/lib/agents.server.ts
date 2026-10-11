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
  const { createLovableClaudeProvider, OMNIFLOW_CLAUDE_MODEL } = await import("./ai-gateway.server");
  const { streamText, Output, NoObjectGeneratedError } = await import("ai");
  const provider = createLovableClaudeProvider(key);
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

async function nlp() {
  return await import("./nlp.server");
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  const { AiBlocked } = await nlp();
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AiBlocked && (error.status === 402 || error.status === 403)) throw new AgentPause(error.message);
    throw error;
  }
}

async function salesAgent(ctx: Ctx) {
  const cutoff = new Date(Date.now() - 3 * 86400000).toISOString();
  const { data } = await ctx.db
    .from("leads")
    .select("*")
    .eq("org_id", ctx.orgId)
    .not("stage", "in", "(won,lost)")
    .or(`last_touch_at.is.null,last_touch_at.lt.${cutoff}`)
    .limit(4);
  const leads = (data ?? []) as any[];
  if (!leads.length) return 0;
  const { data: touchRows } = await ctx.db
    .from("lead_touches")
    .select("*")
    .eq("org_id", ctx.orgId)
    .in("lead_id", leads.map((l) => l.id))
    .order("created_at", { ascending: false });
  const touchesFor = (id: string) => ((touchRows ?? []) as any[]).filter((t) => t.lead_id === id);

  const decisions = await decide(
    ctx.key,
    "You are the autonomous sales agent. For each quiet lead, read its notes and full touch history and decide: action is advance, nurture, mark_lost or no_change. stage is the new stage (new, contacted, qualified, proposal, won, lost) — only move it on real evidence in the history. sentiment is cold, neutral, warm or hot. Only mark_lost after repeated unanswered touches or an explicit no.",
    leads.map((l) => ({
      item_id: l.id,
      company: l.company,
      contact: l.contact_name,
      stage: l.stage,
      value: l.value,
      sentiment: l.sentiment,
      notes: l.notes,
      last_touch_at: l.last_touch_at,
      history: touchesFor(l.id).slice(0, 8).map((t) => `${String(t.created_at).slice(0, 10)} ${t.channel} ${t.sentiment}: ${t.note ?? ""}`),
    })),
  );

  let n = 0;
  const { writeOutreach } = await nlp();
  for (const d of decisions) {
    const lead = leads.find((l) => l.id === d.item_id);
    if (!lead || d.action === "no_change") continue;
    const stages = ["new", "contacted", "qualified", "proposal", "won", "lost"];
    const patch: Record<string, unknown> = { last_touch_at: new Date().toISOString() };
    if (stages.includes(d.stage)) patch["stage"] = d.stage;
    if (["cold", "neutral", "warm", "hot"].includes(d.sentiment)) patch["sentiment"] = d.sentiment;

    if (d.action === "mark_lost") {
      n += await updateTracked(ctx, "sales", "leads", lead, patch, d.action, lead.company, d.rationale);
      continue;
    }

    const channel = (["email", "call", "linkedin"].includes(lead.channel) ? lead.channel : "email") as "email" | "call" | "linkedin";
    const outreach = await guard(() => writeOutreach(ctx.db, ctx.orgId, ctx.key, lead, touchesFor(lead.id), channel, "the account team"));
    patch["sentiment"] = outreach.sentiment;
    n += await updateTracked(ctx, "sales", "leads", lead, patch, d.action, lead.company, `${d.rationale} Angle: ${outreach.angle}`);

    const body = [outreach.subject ? `Subject: ${outreach.subject}` : "", outreach.message].filter(Boolean).join("\n\n");
    const { data: touch } = await ctx.db
      .from("lead_touches")
      .insert({ org_id: ctx.orgId, lead_id: lead.id, channel, note: `AI draft (${outreach.angle}):\n${body}`.slice(0, 2000), sentiment: outreach.sentiment })
      .select("id")
      .single();
    if (touch) {
      await record(ctx, {
        agent: "sales",
        action: "draft_outreach",
        table: "lead_touches",
        id: touch.id,
        label: `${channel} to ${lead.contact_name ?? lead.company}`,
        after: { ai_reply: body, buyer_state: outreach.buyer_state },
        created: true,
        rationale: outreach.buyer_state,
      });
      n += 1;
    }
    n += await createCommitment(
      ctx,
      "sales",
      { owner_name: "Sales agent", counterparty: lead.contact_name ?? lead.company, promise: `Follow up with ${lead.company} if no reply — ${outreach.followup_reason}`, days: outreach.followup_days },
      outreach.followup_reason,
    );
  }
  return n;
}

async function voipAgent(ctx: Ctx) {
  const { data } = await ctx.db.from("calls").select("*").eq("org_id", ctx.orgId).is("summary", null).limit(3);
  const calls = (data ?? []) as any[];
  let n = 0;
  const { analyseTranscript } = await nlp();
  for (const call of calls) {
    const a = await guard(() => analyseTranscript(ctx.db, ctx.orgId, ctx.key, call));
    const summary = [
      a.summary,
      a.buying_signals.length ? `Buying signals: ${a.buying_signals.join("; ")}.` : "",
      a.risks.length ? `Risks: ${a.risks.join("; ")}.` : "",
      a.coaching_tip ? `Coaching: ${a.coaching_tip}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    n += await updateTracked(
      ctx,
      "voip",
      "calls",
      call,
      {
        summary: summary.slice(0, 1500),
        sentiment: a.sentiment,
        objections: a.objections.join(", ").slice(0, 500),
        talk_ratio: a.talk_ratio,
        action_items: a.action_items.map((x) => `${x.owner}: ${x.task}`.slice(0, 200)),
      },
      "analyse",
      `Call with ${call.participant}`,
      `${a.sentiment_shift}. ${a.coaching_tip}`.trim(),
    );
    for (const item of a.action_items.slice(0, 3)) {
      n += await createCommitment(
        ctx,
        "voip",
        { owner_name: item.owner || "Call agent", counterparty: call.participant, promise: item.task, days: item.due_in_days, client_id: call.client_id },
        `Agreed on the call with ${call.participant}.`,
      );
    }
  }
  return n;
}

async function supportAgent(ctx: Ctx) {
  const { data } = await ctx.db.from("tickets").select("*").eq("org_id", ctx.orgId).eq("status", "open").is("ai_reply", null).limit(4);
  const tickets = (data ?? []) as any[];
  let n = 0;
  const { writeSupportReply } = await nlp();
  for (const t of tickets) {
    const r = await guard(() => writeSupportReply(ctx.db, ctx.orgId, ctx.key, t));
    const status = r.decision === "resolve" ? "resolved" : r.decision === "escalate" ? "escalated" : "open";
    const note = `${r.internal_note} (intent: ${r.intent}; mood: ${r.customer_emotion}; confidence ${r.confidence}%${r.sources.length ? `; sources: ${r.sources.join(", ")}` : ""})`;
    n += await updateTracked(ctx, "support", "tickets", t, { ai_reply: r.reply.slice(0, 2500), status, resolution: note.slice(0, 500) }, r.decision, t.subject, note);
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
    if (stages.includes(d.stage)) patch["stage"] = d.stage;
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
  const allowed = ["leads", "lead_touches", "calls", "tickets", "deals", "commitments"];
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

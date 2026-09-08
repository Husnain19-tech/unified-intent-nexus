import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type Commitment = {
  id: string;
  org_id: string;
  source_id: string | null;
  person_id: string | null;
  client_id: string | null;
  depends_on_id: string | null;
  owner_name: string;
  counterparty: string | null;
  promise: string;
  quote: string | null;
  due_at: string | null;
  status: string;
  risk_score: number | null;
  risk_label: string | null;
  risk_reason: string | null;
  created_at: string;
};

export type Person = {
  id: string;
  name: string;
  role_title: string | null;
  email: string | null;
};

export type Client = { id: string; name: string; account_owner: string | null };

export type Source = {
  id: string;
  title: string;
  channel: string;
  content: string;
  summary: string | null;
  created_at: string;
};

export type Expectation = {
  id: string;
  client_id: string;
  label: string;
  client_view: string | null;
  team_view: string | null;
  gap_score: number | null;
  gap_note: string | null;
};

export type Dependency = {
  id: string;
  name: string;
  kind: string;
  version: string | null;
  criticality: number;
  usage_note: string | null;
  debt_hours: number;
  risk_score: number;
  risk_note: string | null;
};

export type Lead = {
  id: string;
  company: string;
  contact_name: string | null;
  email: string | null;
  channel: string;
  stage: string;
  value: number;
  sentiment: string;
  notes: string | null;
  last_touch_at: string | null;
};

export type LeadTouch = {
  id: string;
  lead_id: string;
  channel: string;
  note: string | null;
  sentiment: string;
  created_at: string;
};

export type Call = {
  id: string;
  client_id: string | null;
  participant: string;
  direction: string;
  duration_seconds: number;
  transcript: string;
  summary: string | null;
  sentiment: string | null;
  objections: string | null;
  talk_ratio: number | null;
  action_items: string[];
  created_at: string;
};

export type Ticket = {
  id: string;
  client_id: string | null;
  requester: string;
  channel: string;
  priority: string;
  subject: string;
  body: string;
  status: string;
  ai_reply: string | null;
  resolution: string | null;
  created_at: string;
};

export type Deal = {
  id: string;
  client_id: string | null;
  name: string;
  owner_name: string | null;
  stage: string;
  value: number;
  probability: number;
  close_date: string | null;
  health_score: number | null;
  health_note: string | null;
};

export type Invoice = {
  id: string;
  client_id: string | null;
  number: string;
  amount: number;
  issued_at: string;
  due_at: string | null;
  status: string;
};

export type Expense = {
  id: string;
  client_id: string | null;
  category: string;
  description: string;
  amount: number;
  incurred_at: string;
};

export type Workspace = {
  orgId: string;
  orgName: string;
  displayName: string;
  people: Person[];
  clients: Client[];
  commitments: Commitment[];
  sources: Source[];
  expectations: Expectation[];
  dependencies: Dependency[];
  leads: Lead[];
  leadTouches: LeadTouch[];
  calls: Call[];
  tickets: Ticket[];
  deals: Deal[];
  invoices: Invoice[];
  expenses: Expense[];
};

async function currentOrg(supabase: SupabaseLike): Promise<string> {
  const { data, error } = await supabase.rpc("bootstrap_workspace");
  if (error) throw new Error(error.message);
  return data as string;
}

type SupabaseLike = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => any;
};

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Workspace> => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);

    const [
      org,
      profile,
      people,
      clients,
      commitments,
      sources,
      expectations,
      dependencies,
      leads,
      leadTouches,
      calls,
      tickets,
      deals,
      invoices,
      expenses,
    ] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
      supabase.from("profiles").select("display_name").eq("id", context.userId).maybeSingle(),
      supabase.from("people").select("id,name,role_title,email").eq("org_id", orgId).order("name"),
      supabase.from("clients").select("id,name,account_owner").eq("org_id", orgId).order("name"),
      supabase.from("commitments").select("*").eq("org_id", orgId).order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("sources").select("id,title,channel,content,summary,created_at").eq("org_id", orgId).order("created_at", { ascending: false }),
      supabase.from("expectations").select("*").eq("org_id", orgId).order("gap_score", { ascending: false }),
      supabase.from("dependencies").select("*").eq("org_id", orgId).order("risk_score", { ascending: false }),
      supabase.from("leads").select("*").eq("org_id", orgId).order("value", { ascending: false }),
      supabase.from("lead_touches").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      supabase.from("calls").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      supabase.from("tickets").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      supabase.from("deals").select("*").eq("org_id", orgId).order("value", { ascending: false }),
      supabase.from("invoices").select("*").eq("org_id", orgId).order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("expenses").select("*").eq("org_id", orgId).order("incurred_at", { ascending: false }),
    ]);

    const num = (v: unknown) => Number(v ?? 0);

    return {
      orgId,
      orgName: org.data?.name ?? "My Organization",
      displayName: profile.data?.display_name ?? "operator",
      people: (people.data ?? []) as Person[],
      clients: (clients.data ?? []) as Client[],
      commitments: (commitments.data ?? []) as Commitment[],
      sources: (sources.data ?? []) as Source[],
      expectations: (expectations.data ?? []) as Expectation[],
      dependencies: ((dependencies.data ?? []) as Dependency[]).map((d) => ({ ...d, debt_hours: num(d.debt_hours) })),
      leads: ((leads.data ?? []) as Lead[]).map((l) => ({ ...l, value: num(l.value) })),
      leadTouches: (leadTouches.data ?? []) as LeadTouch[],
      calls: ((calls.data ?? []) as Call[]).map((c) => ({
        ...c,
        action_items: Array.isArray(c.action_items) ? (c.action_items as string[]) : [],
      })),
      tickets: (tickets.data ?? []) as Ticket[],
      deals: ((deals.data ?? []) as Deal[]).map((d) => ({ ...d, value: num(d.value) })),
      invoices: ((invoices.data ?? []) as Invoice[]).map((i) => ({ ...i, amount: num(i.amount) })),
      expenses: ((expenses.data ?? []) as Expense[]).map((e) => ({ ...e, amount: num(e.amount) })),
    };
  });

const ExtractInput = z.object({
  title: z.string().min(1).max(200),
  channel: z.string().min(1).max(40),
  content: z.string().min(10).max(20000),
});

export const ingestSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const { createLovableAiGatewayProvider, OMNIFLOW_MODEL } = await import("./ai-gateway.server");
    const { generateText, Output, NoObjectGeneratedError } = await import("ai");
    const gateway = createLovableAiGatewayProvider(key);

    const { data: people } = await supabase.from("people").select("id,name").eq("org_id", orgId);
    const { data: clients } = await supabase.from("clients").select("id,name").eq("org_id", orgId);

    const schema = z.object({
      summary: z.string(),
      commitments: z.array(
        z.object({
          owner_name: z.string(),
          counterparty: z.string(),
          promise: z.string(),
          quote: z.string(),
          due_in_days: z.number(),
          client_name: z.string(),
          risk_score: z.number(),
          risk_label: z.string(),
          risk_reason: z.string(),
        }),
      ),
    });

    const prompt = [
      "You analyse workplace communication and extract explicit or implied promises (commitments).",
      "Known team members: " + ((people ?? []) as Person[]).map((p) => p.name).join(", "),
      "Known clients: " + ((clients ?? []) as Client[]).map((c) => c.name).join(", "),
      "",
      "For every promise return: who owns it (owner_name), who it is owed to (counterparty),",
      "a short imperative description (promise), the exact sentence it came from (quote),",
      "due_in_days as a whole number of days from today (use 0 if it is due today, and your best estimate otherwise),",
      "client_name if it is clearly tied to one of the known clients otherwise an empty string,",
      "risk_score 0-100 for the chance it slips, risk_label as exactly one of on_track, at_risk, slipping,",
      "and one sentence of risk_reason.",
      "Also return a one sentence summary of the whole text.",
      "If there are no promises at all, return an empty commitments array.",
      "",
      "TEXT:",
      data.content,
    ].join("\n");

    let parsed: z.infer<typeof schema>;
    try {
      const result = await generateText({
        model: gateway(OMNIFLOW_MODEL),
        output: Output.object({ schema }),
        prompt,
      });
      parsed = result.output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        try {
          parsed = schema.parse(JSON.parse(error.text));
        } catch {
          throw new Error("The AI response could not be read. Try again.");
        }
      } else {
        throw error;
      }
    }

    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .insert({
        org_id: orgId,
        title: data.title,
        channel: data.channel,
        content: data.content,
        summary: parsed.summary,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (sourceError) throw new Error(sourceError.message);

    const peopleList = ((people ?? []) as Person[]);
    const clientList = ((clients ?? []) as Client[]);

    const rows = parsed.commitments.slice(0, 25).map((c) => {
      const person = peopleList.find((p) => p.name.toLowerCase() === c.owner_name.trim().toLowerCase());
      const client = clientList.find((cl) => cl.name.toLowerCase() === (c.client_name ?? "").trim().toLowerCase());
      const days = Number.isFinite(c.due_in_days) ? Math.max(-365, Math.min(365, Math.round(c.due_in_days))) : 3;
      const label = ["on_track", "at_risk", "slipping"].includes(c.risk_label) ? c.risk_label : "at_risk";
      return {
        org_id: orgId,
        source_id: source.id,
        person_id: person?.id ?? null,
        client_id: client?.id ?? null,
        owner_name: c.owner_name.slice(0, 120) || "Unassigned",
        counterparty: c.counterparty?.slice(0, 120) ?? null,
        promise: c.promise.slice(0, 400),
        quote: c.quote?.slice(0, 600) ?? null,
        due_at: new Date(Date.now() + days * 86400000).toISOString(),
        status: "open",
        risk_score: Math.max(0, Math.min(100, Math.round(c.risk_score ?? 50))),
        risk_label: label,
        risk_reason: c.risk_reason?.slice(0, 400) ?? null,
      };
    });

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("commitments").insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    return { sourceId: source.id as string, extracted: rows.length, summary: parsed.summary };
  });

export const setCommitmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["open", "delivered", "broken"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const { error } = await supabase
      .from("commitments")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("org_id", orgId);
    if (error) throw new Error(error.message);
    await supabase
      .from("commitment_events")
      .insert({ org_id: orgId, commitment_id: data.id, kind: data.status, note: "Status changed to " + data.status });
    return { ok: true };
  });

export const deleteCommitment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const { error } = await supabase.from("commitments").delete().eq("id", data.id).eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function runPrompt(prompt: string, system: string) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this project.");
  const { createLovableAiGatewayProvider, OMNIFLOW_MODEL } = await import("./ai-gateway.server");
  const { streamText } = await import("ai");
  const gateway = createLovableAiGatewayProvider(key);
  const result = streamText({ model: gateway(OMNIFLOW_MODEL), system, prompt });
  return await result.text;
}

function commitmentLines(rows: Commitment[]) {
  return rows
    .map(
      (c) =>
        `- ${c.owner_name} owes "${c.promise}" to ${c.counterparty ?? "internal"} | due ${c.due_at ? new Date(c.due_at).toDateString() : "unscheduled"} | status ${c.status} | risk ${c.risk_score ?? "?"}`,
    )
    .join("\n");
}

export const generateBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const [{ data }, { data: deals }, { data: invoices }, { data: tickets }, { data: deps }] = await Promise.all([
      supabase.from("commitments").select("*").eq("org_id", orgId),
      supabase.from("deals").select("name,stage,value,probability,health_score").eq("org_id", orgId),
      supabase.from("invoices").select("number,amount,status,due_at").eq("org_id", orgId),
      supabase.from("tickets").select("subject,priority,status").eq("org_id", orgId),
      supabase.from("dependencies").select("name,risk_score,criticality").eq("org_id", orgId),
    ]);
    const rows = (data ?? []) as Commitment[];
    if (rows.length === 0) return { briefing: "No commitments are being tracked yet. Capture a message to get started." };

    const dealLines = ((deals ?? []) as Deal[])
      .map((d) => `- ${d.name} | ${d.stage} | value ${d.value} | probability ${d.probability}% | health ${d.health_score ?? "?"}`)
      .join("\n");
    const invoiceLines = ((invoices ?? []) as Invoice[])
      .map((i) => `- ${i.number} | ${i.amount} | ${i.status} | due ${i.due_at ?? "n/a"}`)
      .join("\n");
    const ticketLines = ((tickets ?? []) as Ticket[])
      .map((t) => `- [${t.priority}] ${t.subject} (${t.status})`)
      .join("\n");
    const depLines = ((deps ?? []) as Dependency[])
      .map((d) => `- ${d.name} | risk ${d.risk_score} | criticality ${d.criticality}`)
      .join("\n");

    const text = await runPrompt(
      `Today is ${new Date().toDateString()}.\n\nCOMMITMENTS:\n${commitmentLines(rows)}\n\nPIPELINE:\n${dealLines}\n\nINVOICES:\n${invoiceLines}\n\nSUPPORT TICKETS:\n${ticketLines}\n\nDEPENDENCIES:\n${depLines}`,
      "You are the operating brain of a company with visibility over commitments, sales pipeline, cash, support and technical dependencies. Write a crisp executive briefing in at most 140 words: what is on fire today across the whole business, where money or trust is at risk, and the single most valuable action to take now. No headings, no bullet symbols, plain sentences.",
    );
    return { briefing: text.trim() };
  });

export const askKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ question: z.string().min(3).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const [{ data: sources }, { data: commitments }] = await Promise.all([
      supabase.from("sources").select("title,channel,content,created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(40),
      supabase.from("commitments").select("*").eq("org_id", orgId).limit(80),
    ]);

    const corpus = ((sources ?? []) as Source[])
      .map((s) => `[${s.channel}] ${s.title} (${new Date(s.created_at).toDateString()})\n${s.content}`)
      .join("\n\n---\n\n");

    const answer = await runPrompt(
      `ORGANISATIONAL RECORD:\n${corpus}\n\nTRACKED COMMITMENTS:\n${commitmentLines((commitments ?? []) as Commitment[])}\n\nQUESTION: ${data.question}`,
      "You answer questions strictly from the organisation's own recorded messages, notes and commitments. Explain the why behind decisions and cite the note title you used. If the record does not contain the answer, say so plainly. Maximum 130 words.",
    );
    return { answer: answer.trim() };
  });

export const analyseExpectationGaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const [{ data: client }, { data: expectations }, { data: commitments }] = await Promise.all([
      supabase.from("clients").select("name").eq("id", data.clientId).eq("org_id", orgId).maybeSingle(),
      supabase.from("expectations").select("*").eq("client_id", data.clientId).eq("org_id", orgId),
      supabase.from("commitments").select("*").eq("client_id", data.clientId).eq("org_id", orgId),
    ]);

    const gaps = ((expectations ?? []) as Expectation[])
      .map((e) => `- ${e.label}: client believes "${e.client_view}", team believes "${e.team_view}" (gap ${e.gap_score})`)
      .join("\n");

    const verdict = await runPrompt(
      `CLIENT: ${client?.name ?? "Unknown"}\n\nEXPECTATION GAPS:\n${gaps || "none recorded"}\n\nOPEN COMMITMENTS:\n${commitmentLines((commitments ?? []) as Commitment[]) || "none"}`,
      "You prevent client conflicts before they happen. In at most 110 words, name the single most dangerous misalignment, what it will cost if unresolved, and the exact conversation to have this week.",
    );
    return { verdict: verdict.trim() };
  });

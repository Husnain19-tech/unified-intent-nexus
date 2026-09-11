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

    const { createLovableResponsesProvider, OMNIFLOW_REASONING_MODEL, REASONING_OPTIONS } = await import(
      "./ai-gateway.server"
    );
    const knowledge = await import("./knowledge.server");
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    const responses = createLovableResponsesProvider(key);

    const { data: people } = await supabase.from("people").select("id,name").eq("org_id", orgId);
    const { data: clients } = await supabase.from("clients").select("id,name").eq("org_id", orgId);

    const schema = z.object({
      summary: z.string(),
      topics: z.array(z.string()),
      decisions: z.array(z.object({ decision: z.string(), rationale: z.string() })),
      commitments: z.array(
        z.object({
          owner_name: z.string(),
          counterparty: z.string(),
          promise: z.string(),
          quote: z.string(),
          due_in_days: z.number(),
          client_name: z.string(),
          depends_on_promise: z.string(),
          risk_score: z.number(),
          risk_label: z.string(),
          risk_reason: z.string(),
        }),
      ),
    });

    const prompt = [
      `Today is ${new Date().toDateString()}.`,
      "You are a language-understanding engine for workplace communication. Read the text closely and resolve",
      "pronouns, nicknames and implicit subjects to real people before deciding who owns each promise.",
      "Known team members: " + ((people ?? []) as Person[]).map((p) => p.name).join(", "),
      "Known clients: " + ((clients ?? []) as Client[]).map((c) => c.name).join(", "),
      "",
      "Extract every commitment — explicit ('I will send X by Friday') and implied ('leave that with me').",
      "Ignore hypotheticals, questions and things already completed.",
      "For each: owner_name (resolved to a known team member when possible), counterparty (who it is owed to),",
      "promise (short imperative), quote (the exact sentence it came from),",
      "due_in_days as a whole number of days from today, resolving relative language such as 'end of week' or 'next Tuesday',",
      "client_name when clearly tied to a known client otherwise an empty string,",
      "depends_on_promise: if this promise can only happen after another promise in the same text, repeat that other promise here, otherwise an empty string,",
      "risk_score 0-100 for the chance it slips, risk_label exactly one of on_track, at_risk, slipping, and one sentence of risk_reason.",
      "Also return a one sentence summary, up to five topics, and every decision made with the reasoning behind it.",
      "Return empty arrays when nothing applies.",
      "",
      "TEXT:",
      data.content,
    ].join("\n");

    let parsed: z.infer<typeof schema>;
    try {
      const result = streamText({
        model: responses.responses(OMNIFLOW_REASONING_MODEL),
        output: Output.object({ schema }),
        prompt,
        providerOptions: REASONING_OPTIONS as any,
      });
      parsed = await result.output;
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

    const decisionNote = parsed.decisions
      .map((d) => `Decision: ${d.decision} — because ${d.rationale}`)
      .join("\n");

    const { data: source, error: sourceError } = await supabase
      .from("sources")
      .insert({
        org_id: orgId,
        title: data.title,
        channel: data.channel,
        content: data.content,
        summary: [parsed.summary, parsed.topics.length ? `Topics: ${parsed.topics.join(", ")}` : ""]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 600),
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (sourceError) throw new Error(sourceError.message);

    // Semantic index of the document itself (plus any decisions and their reasoning).
    const indexedChunks = await knowledge.indexSource(supabase, key, orgId, {
      id: source.id as string,
      title: data.title,
      content: decisionNote ? `${data.content}\n\n${decisionNote}` : data.content,
    });

    const peopleList = (people ?? []) as Person[];
    const clientList = (clients ?? []) as Client[];

    const candidates = parsed.commitments.slice(0, 25);
    const candidateTexts = candidates.map(
      (c) => `${c.owner_name} promised ${c.counterparty || "the team"}: ${c.promise}. ${c.quote ?? ""}`.trim(),
    );

    const { embedTexts } = await import("./ai-gateway.server");
    const candidateVectors = candidateTexts.length > 0 ? await embedTexts(key, candidateTexts) : [];

    const kept: { index: number; vector: number[] }[] = [];
    let duplicates = 0;
    for (let i = 0; i < candidates.length; i++) {
      const vector = candidateVectors[i] ?? [];
      const dup = vector.length ? await knowledge.findDuplicateCommitment(supabase, orgId, vector) : null;
      if (dup) {
        duplicates += 1;
        continue;
      }
      kept.push({ index: i, vector });
    }

    const rows = kept.map(({ index }) => {
      const c = candidates[index]!;
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

    let inserted: { id: string; promise: string }[] = [];
    if (rows.length > 0) {
      const { data: insertedRows, error: insertError } = await supabase
        .from("commitments")
        .insert(rows)
        .select("id,promise");
      if (insertError) throw new Error(insertError.message);
      inserted = (insertedRows ?? []) as { id: string; promise: string }[];

      // Index the new promises so future captures can be matched against them.
      await knowledge.indexCommitments(
        supabase,
        key,
        orgId,
        inserted.map((row, i) => ({ id: row.id, text: candidateTexts[kept[i]!.index] ?? row.promise })),
        kept.map((k) => k.vector),
      );

      // Link promise chains: "I'll review it once Devon sends the draft".
      for (let i = 0; i < inserted.length; i++) {
        const hint = candidates[kept[i]!.index]?.depends_on_promise?.trim();
        if (!hint) continue;
        let bestId: string | null = null;
        let bestScore = 0;
        for (let j = 0; j < inserted.length; j++) {
          if (i === j) continue;
          const score = knowledge.cosine(kept[i]!.vector, kept[j]!.vector);
          const textual = (candidates[kept[j]!.index]?.promise ?? "").toLowerCase();
          const overlap = textual && hint.toLowerCase().includes(textual.slice(0, 20)) ? 0.2 : 0;
          if (score + overlap > bestScore) {
            bestScore = score + overlap;
            bestId = inserted[j]!.id;
          }
        }
        if (bestId && bestScore >= 0.6) {
          await supabase.from("commitments").update({ depends_on_id: bestId }).eq("id", inserted[i]!.id);
        }
      }
    }

    return {
      sourceId: source.id as string,
      extracted: rows.length,
      duplicates,
      indexedChunks,
      decisions: parsed.decisions.length,
      summary: parsed.summary,
    };
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

export const reindexKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");
    const knowledge = await import("./knowledge.server");
    return await knowledge.reindexWorkspace(supabase, key, orgId);
  });

export const askKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ question: z.string().min(3).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const knowledge = await import("./knowledge.server");
    const { createLovableResponsesProvider, OMNIFLOW_REASONING_MODEL, REASONING_OPTIONS } = await import(
      "./ai-gateway.server"
    );
    const { streamText } = await import("ai");

    // Make sure everything recorded so far has a vector before searching.
    const { count } = await supabase
      .from("knowledge_chunks")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);
    if (!count) await knowledge.reindexWorkspace(supabase, key, orgId);

    const queryVector = await knowledge.embedQuery(key, data.question);
    const [passages, promiseMatches] = await Promise.all([
      knowledge.searchChunks(supabase, orgId, queryVector, "source", 10),
      knowledge.searchChunks(supabase, orgId, queryVector, "commitment", 6),
    ]);

    const sourceIds = Array.from(new Set(passages.map((p) => p.source_id).filter(Boolean))) as string[];
    const { data: sourceRows } = sourceIds.length
      ? await supabase.from("sources").select("id,title,channel,created_at").in("id", sourceIds)
      : { data: [] };
    const sourceById = new Map(
      ((sourceRows ?? []) as { id: string; title: string; channel: string; created_at: string }[]).map((s) => [s.id, s]),
    );

    const context_ = passages
      .map((p, i) => {
        const s = p.source_id ? sourceById.get(p.source_id) : undefined;
        const label = s ? `${s.title} [${s.channel}, ${new Date(s.created_at).toDateString()}]` : (p.heading ?? "Note");
        return `[${i + 1}] ${label} (relevance ${(p.similarity * 100).toFixed(0)}%)\n${p.content}`;
      })
      .join("\n\n---\n\n");

    const promiseContext = promiseMatches
      .map((m) => `- ${m.content} (relevance ${(m.similarity * 100).toFixed(0)}%)`)
      .join("\n");

    if (!context_ && !promiseContext) {
      return { answer: "There is nothing recorded yet, so the memory has no answer to give.", citations: [] };
    }

    const result = streamText({
      model: (createLovableResponsesProvider(key)).responses(OMNIFLOW_REASONING_MODEL),
      system:
        "You answer strictly from the organisation's own retrieved passages and tracked promises. Explain the reasoning behind decisions, quote sparingly, and cite the passage numbers you used like [2]. If the retrieved material does not contain the answer, say so plainly instead of guessing. Maximum 150 words.",
      prompt: `RETRIEVED PASSAGES:\n${context_ || "none"}\n\nRELATED TRACKED PROMISES:\n${promiseContext || "none"}\n\nQUESTION: ${data.question}`,
      providerOptions: REASONING_OPTIONS as any,
    });

    const answer = await result.text;

    const citations = passages.slice(0, 5).map((p, i) => {
      const s = p.source_id ? sourceById.get(p.source_id) : undefined;
      return {
        index: i + 1,
        title: s?.title ?? p.heading ?? "Note",
        channel: s?.channel ?? "note",
        similarity: Math.round(p.similarity * 100),
        excerpt: p.content.slice(0, 220),
      };
    });

    return { answer: answer.trim(), citations };
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

/* ---------------- Silent Dependency Monitor ---------------- */

export const addDependency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        kind: z.string().min(1).max(40),
        version: z.string().max(40).optional(),
        criticality: z.number().min(0).max(100),
        usage_note: z.string().max(600).optional(),
        debt_hours: z.number().min(0).max(10000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const risk = Math.round(Math.min(100, data.criticality * 0.6 + Math.min(40, data.debt_hours)));
    const { error } = await supabase.from("dependencies").insert({
      org_id: orgId,
      name: data.name,
      kind: data.kind,
      version: data.version ?? null,
      criticality: data.criticality,
      usage_note: data.usage_note ?? null,
      debt_hours: data.debt_hours,
      risk_score: risk,
      risk_note: null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const analyseDependency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const [{ data: dep }, { data: commitments }] = await Promise.all([
      supabase.from("dependencies").select("*").eq("id", data.id).eq("org_id", orgId).maybeSingle(),
      supabase.from("commitments").select("*").eq("org_id", orgId).eq("status", "open"),
    ]);
    if (!dep) throw new Error("Dependency not found.");
    const d = dep as Dependency;

    const forecast = await runPrompt(
      `DEPENDENCY: ${d.name} (${d.kind}, version ${d.version ?? "unknown"})\nCriticality: ${d.criticality}/100\nHow it is used: ${d.usage_note ?? "unspecified"}\nLogged shortcut cost: ${d.debt_hours} hours\n\nOPEN COMMITMENTS THAT COULD BE AFFECTED:\n${commitmentLines((commitments ?? []) as Commitment[]) || "none"}`,
      "You forecast breakage. In at most 110 words: state the specific way this dependency is most likely to break given how it is used, which of the listed commitments would be hit, and a concrete migration path with a first step. Plain sentences, no headings.",
    );
    await supabase.from("dependencies").update({ risk_note: forecast.trim() }).eq("id", data.id).eq("org_id", orgId);
    return { forecast: forecast.trim() };
  });

/* ---------------- AI Sales Orchestrator ---------------- */

export const addLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        company: z.string().min(1).max(120),
        contact_name: z.string().max(120).optional(),
        email: z.string().max(160).optional(),
        channel: z.string().min(1).max(40),
        value: z.number().min(0).max(100000000),
        notes: z.string().max(600).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const { error } = await supabase.from("leads").insert({
      org_id: orgId,
      company: data.company,
      contact_name: data.contact_name ?? null,
      email: data.email ?? null,
      channel: data.channel,
      value: data.value,
      notes: data.notes ?? null,
      stage: "new",
      sentiment: "neutral",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const logLeadTouch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        leadId: z.string().uuid(),
        channel: z.string().min(1).max(40),
        note: z.string().min(1).max(600),
        sentiment: z.enum(["cold", "neutral", "warm", "hot"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const { error } = await supabase.from("lead_touches").insert({
      org_id: orgId,
      lead_id: data.leadId,
      channel: data.channel,
      note: data.note,
      sentiment: data.sentiment,
    });
    if (error) throw new Error(error.message);
    await supabase
      .from("leads")
      .update({ sentiment: data.sentiment, last_touch_at: new Date().toISOString(), stage: "contacted" })
      .eq("id", data.leadId)
      .eq("org_id", orgId);
    return { ok: true };
  });

export const setLeadStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), stage: z.enum(["new", "contacted", "qualified", "proposal", "won", "lost"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const { error } = await supabase.from("leads").update({ stage: data.stage }).eq("id", data.id).eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const draftOutreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ leadId: z.string().uuid(), channel: z.enum(["email", "call", "linkedin"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const [{ data: lead }, { data: touches }] = await Promise.all([
      supabase.from("leads").select("*").eq("id", data.leadId).eq("org_id", orgId).maybeSingle(),
      supabase.from("lead_touches").select("*").eq("lead_id", data.leadId).eq("org_id", orgId).order("created_at", { ascending: false }),
    ]);
    if (!lead) throw new Error("Lead not found.");
    const l = lead as Lead;
    const history = ((touches ?? []) as LeadTouch[])
      .map((t) => `- ${new Date(t.created_at).toDateString()} via ${t.channel} (${t.sentiment}): ${t.note ?? ""}`)
      .join("\n");

    const draft = await runPrompt(
      `LEAD: ${l.company}\nContact: ${l.contact_name ?? "unknown"}\nStage: ${l.stage}\nDeal value: ${l.value}\nCurrent sentiment: ${l.sentiment}\nLast touch: ${l.last_touch_at ? new Date(l.last_touch_at).toDateString() : "never"}\nNotes: ${l.notes ?? "none"}\n\nTOUCH HISTORY:\n${history || "no touches yet"}\n\nCHANNEL TO WRITE FOR: ${data.channel}\nToday is ${new Date().toDateString()}.`,
      "You are a disciplined sales orchestrator. Return exactly two parts, separated by a line containing only ---. Part one: the outreach message itself for the requested channel, personalised to this lead, under 120 words, no placeholders. Part two: one sentence recommending when to follow up next and why, based on the last touch and sentiment.",
    );
    const [message, timing] = draft.split(/\n?---\n?/);
    return { message: (message ?? draft).trim(), timing: (timing ?? "").trim() };
  });

/* ---------------- VoIP Intelligence ---------------- */

export const analyseCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        participant: z.string().min(1).max(120),
        direction: z.enum(["inbound", "outbound"]),
        duration_seconds: z.number().min(0).max(86400),
        transcript: z.string().min(20).max(20000),
        clientId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const { createLovableAiGatewayProvider, OMNIFLOW_MODEL } = await import("./ai-gateway.server");
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    const gateway = createLovableAiGatewayProvider(key);

    const schema = z.object({
      summary: z.string(),
      sentiment: z.string(),
      objections: z.string(),
      talk_ratio: z.number(),
      action_items: z.array(z.string()),
    });

    let parsed: z.infer<typeof schema>;
    try {
      const result = streamText({
        model: gateway(OMNIFLOW_MODEL),
        output: Output.object({ schema }),
        prompt: `Analyse this call transcript. talk_ratio is the percentage of the conversation spoken by our side (0-100). sentiment is one of positive, neutral, mixed, negative. objections is a short comma separated list, or an empty string. action_items is a list of short imperative next steps, at most five.\n\nPARTICIPANT: ${data.participant}\nDIRECTION: ${data.direction}\n\nTRANSCRIPT:\n${data.transcript}`,
      });
      parsed = await result.output;
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

    const { data: row, error } = await supabase
      .from("calls")
      .insert({
        org_id: orgId,
        client_id: data.clientId ?? null,
        participant: data.participant,
        direction: data.direction,
        duration_seconds: data.duration_seconds,
        transcript: data.transcript,
        summary: parsed.summary.slice(0, 800),
        sentiment: parsed.sentiment.slice(0, 40),
        objections: parsed.objections.slice(0, 400),
        talk_ratio: Math.max(0, Math.min(100, Math.round(parsed.talk_ratio ?? 50))),
        action_items: parsed.action_items.slice(0, 5).map((a) => a.slice(0, 200)),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { callId: row.id as string, summary: parsed.summary, actionItems: parsed.action_items.slice(0, 5) };
  });

export const promoteToCommitment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        promise: z.string().min(3).max(400),
        owner_name: z.string().min(1).max(120),
        counterparty: z.string().max(120).optional(),
        clientId: z.string().uuid().nullable().optional(),
        due_in_days: z.number().min(0).max(365).default(5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const { error } = await supabase.from("commitments").insert({
      org_id: orgId,
      client_id: data.clientId ?? null,
      owner_name: data.owner_name,
      counterparty: data.counterparty ?? null,
      promise: data.promise,
      due_at: new Date(Date.now() + data.due_in_days * 86400000).toISOString(),
      status: "open",
      risk_score: 45,
      risk_label: "at_risk",
      risk_reason: "Promoted from a call or support ticket and not yet started.",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Autonomous Customer Support ---------------- */

export const addTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requester: z.string().min(1).max(120),
        channel: z.string().min(1).max(40),
        priority: z.enum(["low", "normal", "high", "urgent"]),
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(4000),
        clientId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const { error } = await supabase.from("tickets").insert({
      org_id: orgId,
      client_id: data.clientId ?? null,
      requester: data.requester,
      channel: data.channel,
      priority: data.priority,
      subject: data.subject,
      body: data.body,
      status: "open",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const draftTicketReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const [{ data: ticket }, { data: sources }, { data: commitments }] = await Promise.all([
      supabase.from("tickets").select("*").eq("id", data.id).eq("org_id", orgId).maybeSingle(),
      supabase.from("sources").select("title,content").eq("org_id", orgId).limit(20),
      supabase.from("commitments").select("*").eq("org_id", orgId).limit(60),
    ]);
    if (!ticket) throw new Error("Ticket not found.");
    const t = ticket as Ticket;

    const corpus = ((sources ?? []) as Source[]).map((s) => `${s.title}\n${s.content}`).join("\n\n---\n\n");

    const raw = await runPrompt(
      `TICKET FROM ${t.requester} (${t.priority} priority, via ${t.channel})\nSubject: ${t.subject}\n\n${t.body}\n\nOUR OWN RECORD:\n${corpus}\n\nTRACKED COMMITMENTS:\n${commitmentLines((commitments ?? []) as Commitment[])}`,
      "You are an AI receptionist that only answers from the organisation's own record. Reply with a line that reads exactly RESOLVE or ESCALATE, then a line containing only ---, then the customer-facing reply in under 120 words. Choose ESCALATE when the answer is not in the record, when a promise or date must be changed, or when the customer is upset.",
    );
    const [verdictLine, ...rest] = raw.split(/\n?---\n?/);
    const decision = /escalate/i.test(verdictLine ?? "") ? "human" : "auto";
    const reply = (rest.join("---") || raw).trim();

    await supabase
      .from("tickets")
      .update({ ai_reply: reply, resolution: decision, status: decision === "auto" ? "resolved" : "escalated" })
      .eq("id", data.id)
      .eq("org_id", orgId);

    return { reply, decision };
  });

export const setTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["open", "resolved", "escalated"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const { error } = await supabase.from("tickets").update({ status: data.status }).eq("id", data.id).eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Predictive Pipeline ---------------- */

export const setDealStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        stage: z.enum(["qualify", "discovery", "proposal", "negotiation", "closed_won", "closed_lost"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const probability =
      data.stage === "closed_won" ? 100 : data.stage === "closed_lost" ? 0 : { qualify: 30, discovery: 40, proposal: 55, negotiation: 75 }[data.stage];
    const { error } = await supabase
      .from("deals")
      .update({ stage: data.stage, probability })
      .eq("id", data.id)
      .eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const scoreDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const { data: deal } = await supabase.from("deals").select("*").eq("id", data.id).eq("org_id", orgId).maybeSingle();
    if (!deal) throw new Error("Deal not found.");
    const d = deal as Deal;

    const [{ data: expectations }, { data: commitments }] = await Promise.all([
      d.client_id
        ? supabase.from("expectations").select("*").eq("client_id", d.client_id).eq("org_id", orgId)
        : Promise.resolve({ data: [] }),
      d.client_id
        ? supabase.from("commitments").select("*").eq("client_id", d.client_id).eq("org_id", orgId)
        : Promise.resolve({ data: [] }),
    ]);

    const exp = (expectations ?? []) as Expectation[];
    const com = (commitments ?? []) as Commitment[];
    const avgGap = exp.length ? exp.reduce((s, e) => s + (e.gap_score ?? 0), 0) / exp.length : 0;
    const broken = com.filter((c) => c.status === "broken").length;
    const overdue = com.filter((c) => c.status === "open" && c.due_at && new Date(c.due_at).getTime() < Date.now()).length;
    const health = Math.max(0, Math.min(100, Math.round(d.probability - avgGap * 0.4 - broken * 12 - overdue * 6 + 15)));

    const note = await runPrompt(
      `DEAL: ${d.name}\nStage: ${d.stage}\nValue: ${d.value}\nProbability: ${d.probability}%\nClose date: ${d.close_date ?? "unset"}\nAverage client expectation gap: ${Math.round(avgGap)}\nBroken commitments to this client: ${broken}\nOverdue commitments to this client: ${overdue}\nComputed health score: ${health}`,
      "In at most 60 words, explain what is really driving this deal's health score and the one thing that would move it most. Plain sentences.",
    );

    await supabase.from("deals").update({ health_score: health, health_note: note.trim() }).eq("id", data.id).eq("org_id", orgId);
    return { health, note: note.trim() };
  });

export const analysePipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const [{ data: deals }, { data: leads }] = await Promise.all([
      supabase.from("deals").select("*").eq("org_id", orgId),
      supabase.from("leads").select("*").eq("org_id", orgId),
    ]);
    const rows = (deals ?? []) as Deal[];
    if (rows.length === 0) return { verdict: "No deals in the pipeline yet." };

    const dealLines = rows
      .map((d) => `- ${d.name} | ${d.stage} | ${d.value} | ${d.probability}% | health ${d.health_score ?? "unscored"} | closes ${d.close_date ?? "unset"}`)
      .join("\n");
    const leadLines = ((leads ?? []) as Lead[])
      .map((l) => `- ${l.company} | ${l.stage} | ${l.value} | ${l.sentiment}`)
      .join("\n");

    const verdict = await runPrompt(
      `Today is ${new Date().toDateString()}.\n\nDEALS:\n${dealLines}\n\nLEADS:\n${leadLines}`,
      "You are a revenue operator. In at most 120 words: name the stage where deals are stalling, the single deal most at risk of slipping this quarter, and where the team should spend this week for the biggest weighted gain. Plain sentences.",
    );
    return { verdict: verdict.trim() };
  });

/* ---------------- Financial Intelligence ---------------- */

export const setInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "sent", "paid", "overdue"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const { error } = await supabase.from("invoices").update({ status: data.status }).eq("id", data.id).eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        number: z.string().min(1).max(40),
        amount: z.number().min(0).max(100000000),
        due_in_days: z.number().min(0).max(365),
        clientId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const due = new Date(Date.now() + data.due_in_days * 86400000).toISOString().slice(0, 10);
    const { error } = await supabase.from("invoices").insert({
      org_id: orgId,
      client_id: data.clientId ?? null,
      number: data.number,
      amount: data.amount,
      due_at: due,
      status: "sent",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const analyseCashflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const orgId = await currentOrg(supabase);
    const [{ data: invoices }, { data: expenses }, { data: deals }] = await Promise.all([
      supabase.from("invoices").select("*").eq("org_id", orgId),
      supabase.from("expenses").select("*").eq("org_id", orgId),
      supabase.from("deals").select("name,stage,value,probability,close_date").eq("org_id", orgId),
    ]);

    const inv = ((invoices ?? []) as Invoice[])
      .map((i) => `- ${i.number} | ${Number(i.amount)} | ${i.status} | due ${i.due_at ?? "n/a"}`)
      .join("\n");
    const exp = ((expenses ?? []) as Expense[])
      .map((e) => `- ${e.category}: ${e.description} | ${Number(e.amount)} | ${e.incurred_at}`)
      .join("\n");
    const dl = ((deals ?? []) as Deal[])
      .map((d) => `- ${d.name} | ${d.stage} | ${Number(d.value)} | ${d.probability}% | closes ${d.close_date ?? "unset"}`)
      .join("\n");

    const commentary = await runPrompt(
      `Today is ${new Date().toDateString()}.\n\nINVOICES:\n${inv || "none"}\n\nEXPENSES:\n${exp || "none"}\n\nPIPELINE:\n${dl || "none"}`,
      "You are a CFO. In at most 120 words: state the cash position risk over the next 90 days, which receivable to chase first and why, and one cost or pricing action worth taking. Plain sentences, no headings.",
    );
    return { commentary: commentary.trim() };
  });


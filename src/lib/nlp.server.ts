import { z } from "zod";

type Db = { rpc: (fn: string, args?: Record<string, unknown>) => any; from: (table: string) => any };

export class AiBlocked extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function statusOf(error: unknown): number | undefined {
  const e = error as { statusCode?: number; status?: number; cause?: { statusCode?: number } };
  return e?.statusCode ?? e?.status ?? e?.cause?.statusCode;
}

/** One structured, reasoning-backed call on the Lovable AI Gateway. */
async function structured<T extends z.ZodTypeAny>(key: string, system: string, prompt: string, schema: T): Promise<z.infer<T>> {
  const { createLovableResponsesProvider, OMNIFLOW_REASONING_MODEL } = await import("./ai-gateway.server");
  const { streamText, Output, NoObjectGeneratedError } = await import("ai");
  const provider = createLovableResponsesProvider(key);
  try {
    const result = streamText({
      model: provider.responses(OMNIFLOW_REASONING_MODEL),
      system,
      prompt,
      output: Output.object({ schema }),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "medium",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      } as any,
    });
    return await result.output;
  } catch (error) {
    const status = statusOf(error);
    if (status === 402) throw new AiBlocked("Out of AI credits — add credits to keep the agents working.", 402);
    if (status === 403) throw new AiBlocked("AI access is blocked for this workspace.", 403);
    if (status === 429) throw new AiBlocked("The AI service is busy. Try again shortly.", 429);
    if (NoObjectGeneratedError.isInstance(error) && error.text) {
      try {
        return schema.parse(JSON.parse(error.text));
      } catch {
        /* fall through */
      }
    }
    throw new Error("The AI response could not be read. Try again.");
  }
}

/** Semantic retrieval over the organisation's memory (Knowledge Mesh). */
async function retrieve(db: Db, orgId: string, key: string, query: string, k = 6) {
  try {
    const knowledge = await import("./knowledge.server");
    const vector = await knowledge.embedQuery(key, query.slice(0, 4000));
    const [passages, promises] = await Promise.all([
      knowledge.searchChunks(db as any, orgId, vector, "source", k),
      knowledge.searchChunks(db as any, orgId, vector, "commitment", 4),
    ]);
    const useful = passages.filter((p) => p.similarity >= 0.35);
    return {
      text:
        useful.map((p, i) => `[${i + 1}] ${p.heading ?? "Note"}\n${p.content}`).join("\n\n---\n\n") || "nothing relevant",
      promises: promises.filter((p) => p.similarity >= 0.4).map((p) => `- ${p.content}`).join("\n") || "none",
      titles: useful.map((p) => p.heading ?? "Note"),
    };
  } catch {
    return { text: "unavailable", promises: "none", titles: [] as string[] };
  }
}

/* ---------------- Sales outreach ---------------- */

const OutreachSchema = z.object({
  angle: z.string(),
  subject: z.string(),
  message: z.string(),
  buyer_state: z.string(),
  sentiment: z.string(),
  followup_days: z.number(),
  followup_reason: z.string(),
});
export type Outreach = z.infer<typeof OutreachSchema>;

export async function writeOutreach(
  db: Db,
  orgId: string,
  key: string,
  lead: { company: string; contact_name: string | null; stage: string; value: number; sentiment: string; notes: string | null; last_touch_at: string | null },
  touches: { created_at: string; channel: string; sentiment: string; note: string | null }[],
  channel: "email" | "call" | "linkedin",
  sender: string,
): Promise<Outreach> {
  const memory = await retrieve(db, orgId, key, `${lead.company} ${lead.contact_name ?? ""} ${lead.notes ?? ""}`);
  const history =
    touches
      .slice(0, 10)
      .map((t) => `- ${new Date(t.created_at).toDateString()} via ${t.channel} (${t.sentiment}): ${t.note ?? ""}`)
      .join("\n") || "no touches yet";

  const out = await structured(
    key,
    [
      "You are a senior B2B account executive writing the next touch for a specific lead.",
      "Read the touch history and company memory first. Infer where the buyer really is, what they care about, and what objection or silence you are working against.",
      "Write a message that only this lead could receive: reference concrete details from the history or memory, make one clear ask, and sound like a person — no filler like 'just checking in' or 'hope this finds you well', no placeholders, no invented facts, prices or dates.",
      "email: subject plus 60–130 word body. linkedin: under 70 words, no subject (empty string). call: a talk track with opener, two discovery questions and the ask, under 130 words, no subject.",
      "angle: the one-line strategy you chose. buyer_state: one sentence on where they are. sentiment: cold, neutral, warm or hot. followup_days: whole days until the next touch if no reply, followup_reason: why.",
    ].join(" "),
    `TODAY: ${new Date().toDateString()}\nSENDER: ${sender}\nCHANNEL: ${channel}\n\nLEAD: ${lead.company}\nContact: ${lead.contact_name ?? "unknown"}\nStage: ${lead.stage}\nDeal value: ${lead.value}\nRecorded sentiment: ${lead.sentiment}\nLast touch: ${lead.last_touch_at ? new Date(lead.last_touch_at).toDateString() : "never"}\nNotes: ${lead.notes ?? "none"}\n\nTOUCH HISTORY (newest first):\n${history}\n\nCOMPANY MEMORY:\n${memory.text}\n\nOPEN PROMISES RELATED TO THIS LEAD:\n${memory.promises}`,
    OutreachSchema,
  );
  return {
    ...out,
    sentiment: ["cold", "neutral", "warm", "hot"].includes(out.sentiment) ? out.sentiment : lead.sentiment,
    followup_days: Math.max(1, Math.min(30, Math.round(out.followup_days || 3))),
    subject: channel === "email" ? out.subject : "",
  };
}

/* ---------------- Call intelligence ---------------- */

/** Measure talk share from speaker-labelled lines ("Name: ..."); null when the transcript is unlabelled. */
export function measureTalkRatio(transcript: string, participant: string): number | null {
  const words: Record<string, number> = {};
  for (const line of transcript.split(/\n+/)) {
    const m = /^\s*\[?([A-Za-z][\w .'-]{0,40})\]?\s*[:\-–]\s+(.+)$/.exec(line);
    if (!m) continue;
    const speaker = m[1]!.trim().toLowerCase();
    words[speaker] = (words[speaker] ?? 0) + m[2]!.split(/\s+/).length;
  }
  const speakers = Object.keys(words);
  if (speakers.length < 2) return null;
  const them = participant.toLowerCase().split(/\s+/);
  const theirs = speakers.filter((s) => them.some((t) => t.length > 2 && s.includes(t)));
  if (theirs.length === 0) return null;
  const total = Object.values(words).reduce((a, b) => a + b, 0);
  const their = theirs.reduce((a, s) => a + (words[s] ?? 0), 0);
  return Math.round(((total - their) / total) * 100);
}

const CallSchema = z.object({
  summary: z.string(),
  sentiment: z.string(),
  sentiment_shift: z.string(),
  objections: z.array(z.string()),
  buying_signals: z.array(z.string()),
  risks: z.array(z.string()),
  talk_ratio_estimate: z.number(),
  action_items: z.array(z.object({ owner: z.string(), task: z.string(), due_in_days: z.number() })),
  coaching_tip: z.string(),
});
export type CallAnalysis = z.infer<typeof CallSchema> & { talk_ratio: number };

export async function analyseTranscript(
  db: Db,
  orgId: string,
  key: string,
  call: { participant: string; direction: string; transcript: string },
): Promise<CallAnalysis> {
  const memory = await retrieve(db, orgId, key, `${call.participant}\n${call.transcript.slice(0, 1500)}`, 4);
  const out = await structured(
    key,
    [
      "You are a call-intelligence analyst. Read the whole transcript and work out what actually happened — not a paraphrase of the first lines.",
      "summary: 2–3 sentences covering the purpose, what was agreed and what is unresolved, naming people.",
      "sentiment: positive, neutral, mixed or negative for the other party at the END of the call; sentiment_shift: one phrase on how it moved during the call.",
      "objections: the concerns the other side raised, in their terms. buying_signals: concrete signs of intent. risks: things likely to derail the relationship or deal.",
      "action_items: only commitments or clearly needed next steps actually grounded in the call, each with the person who owns it (use names from the transcript; 'us' if unclear) and due_in_days resolved from what was said (e.g. 'by Friday'). At most five.",
      "talk_ratio_estimate: percentage of the conversation spoken by our side. coaching_tip: one specific, actionable tip for our rep based on this call.",
      "Use the company memory only to interpret context; never invent facts that are not in the transcript.",
    ].join(" "),
    `TODAY: ${new Date().toDateString()}\nOTHER PARTY: ${call.participant}\nDIRECTION: ${call.direction}\n\nCOMPANY MEMORY:\n${memory.text}\n\nTRANSCRIPT:\n${call.transcript.slice(0, 18000)}`,
    CallSchema,
  );
  const measured = measureTalkRatio(call.transcript, call.participant);
  return {
    ...out,
    sentiment: ["positive", "neutral", "mixed", "negative"].includes(out.sentiment) ? out.sentiment : "neutral",
    objections: out.objections.slice(0, 6),
    action_items: out.action_items.slice(0, 5),
    talk_ratio: measured ?? Math.max(0, Math.min(100, Math.round(out.talk_ratio_estimate || 50))),
  };
}

/* ---------------- Support replies ---------------- */

const ReplySchema = z.object({
  intent: z.string(),
  customer_emotion: z.string(),
  decision: z.string(),
  reply: z.string(),
  internal_note: z.string(),
  confidence: z.number(),
  used_sources: z.array(z.number()),
});
export type SupportReply = z.infer<typeof ReplySchema> & { sources: string[] };

export async function writeSupportReply(
  db: Db,
  orgId: string,
  key: string,
  ticket: { id: string; requester: string; channel: string; priority: string; subject: string; body: string },
): Promise<SupportReply> {
  const memory = await retrieve(db, orgId, key, `${ticket.subject}\n${ticket.body}`, 6);
  const { data: prior } = await db
    .from("tickets")
    .select("subject,ai_reply,resolution,status")
    .eq("org_id", orgId)
    .eq("requester", ticket.requester)
    .neq("id", ticket.id)
    .order("created_at", { ascending: false })
    .limit(4);
  const priorText =
    ((prior ?? []) as { subject: string; ai_reply: string | null; status: string }[])
      .map((p) => `- ${p.subject} (${p.status})${p.ai_reply ? `: we replied "${p.ai_reply.slice(0, 200)}"` : ""}`)
      .join("\n") || "none";

  const out = await structured(
    key,
    [
      "You are a first-line support specialist. Understand what the customer actually needs (intent) and how they feel (customer_emotion: calm, confused, frustrated, angry or urgent).",
      "Answer ONLY from the numbered company passages, open promises and prior conversations provided. Never invent policies, refunds, dates, features or prices.",
      "decision: resolve when the passages fully answer the request and no promise or money must change; wait when you need specific information from the customer (ask for it precisely); escalate when the answer is missing, a commitment/date/refund/contract must change, there is an outage or legal issue, or the customer is angry about a repeated problem.",
      "reply: the customer-facing message, warm and specific, acknowledging their situation in one line, then the answer or next step, under 140 words, signed 'Support team'. When escalating, tell them a person is taking over and what happens next — do not promise a time you cannot know.",
      "internal_note: one line for the human team. confidence: 0–100 that the reply is correct and complete. used_sources: passage numbers you relied on.",
    ].join(" "),
    `TODAY: ${new Date().toDateString()}\nTICKET FROM ${ticket.requester} (${ticket.priority} priority, via ${ticket.channel})\nSubject: ${ticket.subject}\n\n${ticket.body}\n\nCOMPANY PASSAGES:\n${memory.text}\n\nOPEN PROMISES:\n${memory.promises}\n\nPRIOR TICKETS FROM THIS CUSTOMER:\n${priorText}`,
    ReplySchema,
  );

  let decision = ["resolve", "wait", "escalate"].includes(out.decision) ? out.decision : "escalate";
  const confidence = Math.max(0, Math.min(100, Math.round(out.confidence || 0)));
  // Low-confidence answers never auto-resolve.
  if (decision === "resolve" && confidence < 60) decision = "escalate";
  const sources = out.used_sources
    .map((n) => memory.titles[n - 1])
    .filter((t): t is string => !!t)
    .filter((t, i, a) => a.indexOf(t) === i);
  return { ...out, decision, confidence, sources };
}

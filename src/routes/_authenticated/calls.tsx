import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useWorkspace } from "@/lib/use-workspace";
import { analyseCall, promoteToCommitment } from "@/lib/omniflow.functions";
import { Shell, PageHead } from "@/components/omniflow/shell";
import { toast } from "sonner";
import { PhoneCall } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calls")({
  head: () => ({
    meta: [
      { title: "VoIP Intelligence — OmniFlow" },
      {
        name: "description",
        content: "Turn raw call transcripts into summaries, sentiment, objections, talk ratio and tracked action items.",
      },
      { property: "og:title", content: "VoIP Intelligence — OmniFlow" },
      { property: "og:description", content: "Every call, analysed and turned into accountable follow-ups." },
    ],
  }),
  component: CallsPage,
});

const SENTIMENT_TONE: Record<string, string> = {
  positive: "bg-success/15 text-success",
  neutral: "bg-secondary text-muted-foreground",
  mixed: "bg-warn/15 text-warn",
  negative: "bg-destructive/15 text-destructive",
};

function CallsPage() {
  const { data, isLoading } = useWorkspace();
  const qc = useQueryClient();
  const analyseFn = useServerFn(analyseCall);
  const promoteFn = useServerFn(promoteToCommitment);

  const [form, setForm] = useState({
    participant: "",
    direction: "outbound" as "inbound" | "outbound",
    minutes: 20,
    clientId: "",
    transcript: "",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace"] });

  const analyse = useMutation({
    mutationFn: () =>
      analyseFn({
        data: {
          participant: form.participant,
          direction: form.direction,
          duration_seconds: Math.round(Number(form.minutes) * 60),
          transcript: form.transcript,
          clientId: form.clientId || null,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Call analysed — ${res.actionItems.length} action items found.`);
      setForm({ ...form, participant: "", transcript: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promote = useMutation({
    mutationFn: (vars: { promise: string; owner: string; counterparty: string; clientId: string | null }) =>
      promoteFn({
        data: {
          promise: vars.promise,
          owner_name: vars.owner,
          counterparty: vars.counterparty,
          clientId: vars.clientId,
          due_in_days: 5,
        },
      }),
    onSuccess: () => {
      toast.success("Tracked as a commitment.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const calls = data?.calls ?? [];
  const avgTalk = calls.length
    ? Math.round(calls.reduce((s, c) => s + (c.talk_ratio ?? 50), 0) / calls.length)
    : 0;
  const negative = calls.filter((c) => c.sentiment === "negative" || c.sentiment === "mixed").length;

  return (
    <Shell org={data?.orgName}>
      <PageHead
        title="VoIP Intelligence"
        subtitle="Paste a call transcript. OmniFlow reads it for sentiment, objections, who talked too much and what was promised."
      />

      <div className="panel mb-6 grid gap-3 p-5 md:grid-cols-4">
        <input
          value={form.participant}
          onChange={(e) => setForm({ ...form, participant: e.target.value })}
          placeholder="Who was on the call?"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
        />
        <select
          value={form.direction}
          onChange={(e) => setForm({ ...form, direction: e.target.value as "inbound" | "outbound" })}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </select>
        <select
          value={form.clientId}
          onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">No client</option>
          {(data?.clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <textarea
          value={form.transcript}
          onChange={(e) => setForm({ ...form, transcript: e.target.value })}
          rows={6}
          placeholder="Paste the transcript or your notes from the call…"
          className="rounded-md border border-border bg-background px-3 py-2 font-mono text-sm md:col-span-4"
        />
        <div className="flex items-center justify-between gap-3 md:col-span-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Length
            <input
              type="number"
              min={1}
              value={form.minutes}
              onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}
              className="w-20 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            min
          </label>
          <button
            onClick={() => analyse.mutate()}
            disabled={analyse.isPending || form.transcript.length < 20 || !form.participant}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {analyse.isPending ? "Listening…" : "Analyse call"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading calls…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Calls analysed</div>
              <div className="num mt-2 text-3xl font-bold">{calls.length}</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Avg talk ratio</div>
              <div className="num mt-2 text-3xl font-bold text-primary">{avgTalk}%</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Difficult calls</div>
              <div className={`num mt-2 text-3xl font-bold ${negative ? "text-warn" : "text-success"}`}>{negative}</div>
            </div>
          </div>

          <div className="space-y-3">
            {calls.map((c) => (
              <div key={c.id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">{c.participant}</h3>
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {c.direction} · {Math.round(c.duration_seconds / 60)} min
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.sentiment && (
                      <span className={`rounded px-2 py-1 text-xs ${SENTIMENT_TONE[c.sentiment] ?? "bg-secondary"}`}>
                        {c.sentiment}
                      </span>
                    )}
                    {c.talk_ratio != null && (
                      <span className="num rounded bg-secondary px-2 py-1 text-xs text-muted-foreground">
                        talk {c.talk_ratio}%
                      </span>
                    )}
                  </div>
                </div>
                {c.summary && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.summary}</p>}
                {c.objections && (
                  <p className="mt-2 text-sm text-warn">
                    <span className="uppercase tracking-widest text-xs">Objections </span>
                    {c.objections}
                  </p>
                )}
                {c.action_items.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {c.action_items.map((a, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background/40 p-3 text-sm"
                      >
                        <span className="min-w-0">{a}</span>
                        <button
                          onClick={() =>
                            promote.mutate({
                              promise: a,
                              owner: data?.displayName ?? "Owner",
                              counterparty: c.participant,
                              clientId: c.client_id,
                            })
                          }
                          disabled={promote.isPending}
                          className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                        >
                          Track it
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {calls.length === 0 && (
              <div className="panel p-8 text-center text-sm text-muted-foreground">No calls analysed yet.</div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

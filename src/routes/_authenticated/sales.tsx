import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useWorkspace } from "@/lib/use-workspace";
import { addLead, draftOutreach, logLeadTouch, setLeadStage } from "@/lib/omniflow.functions";
import { Shell, PageHead } from "@/components/omniflow/shell";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales Orchestrator — OmniFlow" },
      {
        name: "description",
        content: "AI-written outreach per lead, sentiment-aware follow-up timing and a full touch history in one place.",
      },
      { property: "og:title", content: "Sales Orchestrator — OmniFlow" },
      { property: "og:description", content: "Personalised outreach with the right timing." },
    ],
  }),
  component: SalesPage;
});

function money(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

const SENTIMENT_TONE: Record<string, string> = {
  hot: "bg-success/15 text-success",
  warm: "bg-primary/15 text-primary",
  neutral: "bg-secondary text-muted-foreground",
  cold: "bg-warn/15 text-warn",
};

function SalesPage() {
  const { data, isLoading } = useWorkspace();
  const qc = useQueryClient();
  const addFn = useServerFn(addLead);
  const draftFn = useServerFn(draftOutreach);
  const touchFn = useServerFn(logLeadTouch);
  const stageFn = useServerFn(setLeadStage);

  const [selected, setSelected] = useState<string | null>(null);
  const [channel, setChannel] = useState<"email" | "call" | "linkedin">("email");
  const [touchNote, setTouchNote] = useState("");
  const [form, setForm] = useState({ company: "", contact_name: "", email: "", channel: "email", value: 10000, notes: "" });
  const [showForm, setShowForm] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace"] });

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          company: form.company,
          contact_name: form.contact_name || undefined,
          email: form.email || undefined,
          channel: form.channel,
          value: Number(form.value),
          notes: form.notes || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Lead added.");
      setShowForm(false);
      setForm({ company: "", contact_name: "", email: "", channel: "email", value: 10000, notes: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const draft = useMutation({
    mutationFn: (leadId: string) => draftFn({ data: { leadId, channel } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const touch = useMutation({
    mutationFn: (vars: { leadId: string; sentiment: "cold" | "neutral" | "warm" | "hot" }) =>
      touchFn({ data: { leadId: vars.leadId, channel, note: touchNote, sentiment: vars.sentiment } }),
    onSuccess: () => {
      toast.success("Touch logged.");
      setTouchNote("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stage = useMutation({
    mutationFn: (vars: { id: string; stage: "new" | "contacted" | "qualified" | "proposal" | "won" | "lost" }) =>
      stageFn({ data: vars }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const leads = data?.leads ?? [];
  const lead = leads.find((l) => l.id === selected) ?? leads[0] ?? null;
  const touches = (data?.leadTouches ?? []).filter((t) => t.lead_id === lead?.id);
  const openValue = leads.filter((l) => l.stage !== "won" && l.stage !== "lost").reduce((s, l) => s + l.value, 0);
  const stale = leads.filter((l) => !l.last_touch_at || Date.now() - new Date(l.last_touch_at).getTime() > 7 * 86400000);

  return (
    <Shell org={data?.orgName}>
      <PageHead
        title="AI Sales Orchestrator"
        subtitle="Every lead, the last thing that happened, and the next message written for you."
        action={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {showForm ? "Close" : "Add lead"}
          </button>
        }
      />

      {showForm && (
        <div className="panel mb-6 grid gap-3 p-5 md:grid-cols-2">
          <input
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            placeholder="Company"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            placeholder="Contact name"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
            placeholder="Deal value"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="What do we know about them?"
            rows={2}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <div className="flex justify-end md:col-span-2">
            <button
              onClick={() => add.mutate()}
              disabled={!form.company || add.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {add.isPending ? "Saving…" : "Save lead"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading leads…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Open lead value</div>
              <div className="num mt-2 text-3xl font-bold text-success">{money(openValue)}</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Active leads</div>
              <div className="num mt-2 text-3xl font-bold">{leads.length}</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Going cold</div>
              <div className={`num mt-2 text-3xl font-bold ${stale.length ? "text-warn" : "text-success"}`}>{stale.length}</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="panel divide-y divide-border p-2">
              {leads.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setSelected(l.id);
                    draft.reset();
                  }}
                  className={`w-full rounded-md p-3 text-left transition-colors hover:bg-accent ${lead?.id === l.id ? "bg-accent" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{l.company}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] uppercase ${SENTIMENT_TONE[l.sentiment] ?? "bg-secondary"}`}>
                      {l.sentiment}
                    </span>
                  </div>
                  <div className="num mt-1 text-xs text-muted-foreground">
                    {money(l.value)} · {l.stage}
                  </div>
                </button>
              ))}
              {leads.length === 0 && <p className="p-4 text-sm text-muted-foreground">No leads yet.</p>}
            </div>

            {lead && (
              <div className="space-y-4">
                <div className="panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{lead.company}</h2>
                      <p className="text-sm text-muted-foreground">
                        {lead.contact_name ?? "unknown contact"} · {lead.email ?? "no email"}
                      </p>
                    </div>
                    <select
                      value={lead.stage}
                      onChange={(e) =>
                        stage.mutate({ id: lead.id, stage: e.target.value as "new" | "contacted" | "qualified" | "proposal" | "won" | "lost" })
                      }
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                    >
                      {["new", "contacted", "qualified", "proposal", "won", "lost"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  {lead.notes && <p className="mt-3 text-sm text-muted-foreground">{lead.notes}</p>}
                  <p className="num mt-3 text-xs text-muted-foreground">
                    Last touch: {lead.last_touch_at ? new Date(lead.last_touch_at).toDateString() : "never"}
                  </p>
                </div>

                <div className="panel p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Outreach</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as "email" | "call" | "linkedin")}
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                      >
                        <option value="email">Email</option>
                        <option value="call">Call script</option>
                        <option value="linkedin">LinkedIn</option>
                      </select>
                      <button
                        onClick={() => draft.mutate(lead.id)}
                        disabled={draft.isPending}
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
                      >
                        {draft.isPending ? "Writing…" : "Draft it"}
                      </button>
                    </div>
                  </div>
                  {draft.data && (
                    <div className="mt-4 space-y-3">
                      <pre className="whitespace-pre-wrap rounded-md border border-border bg-background/50 p-4 font-sans text-sm leading-relaxed">
                        {draft.data.message}
                      </pre>
                      {draft.data.timing && (
                        <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">{draft.data.timing}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="panel p-5">
                  <h3 className="font-semibold">Log a touch</h3>
                  <textarea
                    value={touchNote}
                    onChange={(e) => setTouchNote(e.target.value)}
                    rows={2}
                    placeholder="What happened?"
                    className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["cold", "neutral", "warm", "hot"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => touch.mutate({ leadId: lead.id, sentiment: s })}
                        disabled={!touchNote || touch.isPending}
                        className="rounded-md border border-border px-3 py-1.5 text-xs capitalize text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <ul className="mt-4 divide-y divide-border">
                    {touches.map((t) => (
                      <li key={t.id} className="py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate">{t.note}</span>
                          <span className="num shrink-0 text-xs text-muted-foreground">
                            {new Date(t.created_at).toDateString()}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t.channel} · {t.sentiment}
                        </span>
                      </li>
                    ))}
                    {touches.length === 0 && <li className="py-2 text-sm text-muted-foreground">No touches recorded.</li>}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

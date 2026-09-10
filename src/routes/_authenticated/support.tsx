import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useWorkspace } from "@/lib/use-workspace";
import { addTicket, draftTicketReply, promoteToCommitment, setTicketStatus } from "@/lib/omniflow.functions";
import { Shell, PageHead } from "@/components/omniflow/shell";
import { toast } from "sonner";
import { LifeBuoy, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Autonomous Support — OmniFlow" },
      {
        name: "description",
        content: "An AI receptionist that answers routine tickets from your own records and escalates only what truly needs a human.",
      },
      { property: "og:title", content: "Autonomous Support — OmniFlow" },
      { property: "og:description", content: "Most tickets answered before anyone opens the inbox." },
    ],
  }),
  component: SupportPage,
});

const PRIORITY_TONE: Record<string, string> = {
  urgent: "bg-destructive/15 text-destructive",
  high: "bg-warn/15 text-warn",
  normal: "bg-secondary text-muted-foreground",
  low: "bg-secondary text-muted-foreground",
};

function SupportPage() {
  const { data, isLoading } = useWorkspace();
  const qc = useQueryClient();
  const addFn = useServerFn(addTicket);
  const replyFn = useServerFn(draftTicketReply);
  const statusFn = useServerFn(setTicketStatus);
  const promoteFn = useServerFn(promoteToCommitment);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    requester: "",
    channel: "email",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    subject: "",
    body: "",
    clientId: "",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace"] });

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          requester: form.requester,
          channel: form.channel,
          priority: form.priority,
          subject: form.subject,
          body: form.body,
          clientId: form.clientId || null,
        },
      }),
    onSuccess: () => {
      toast.success("Ticket logged.");
      setShowForm(false);
      setForm({ ...form, requester: "", subject: "", body: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reply = useMutation({
    mutationFn: (id: string) => replyFn({ data: { id } }),
    onSuccess: (res) => {
      toast.success(res.decision === "human" ? "Escalated to a human." : "Draft reply ready.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = useMutation({
    mutationFn: (vars: { id: string; status: "open" | "resolved" | "escalated" }) => statusFn({ data: vars }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const promote = useMutation({
    mutationFn: (vars: { promise: string; counterparty: string; clientId: string | null }) =>
      promoteFn({
        data: {
          promise: vars.promise,
          owner_name: data?.displayName ?? "Support",
          counterparty: vars.counterparty,
          clientId: vars.clientId,
          due_in_days: 3,
        },
      }),
    onSuccess: () => {
      toast.success("Follow-up tracked.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tickets = data?.tickets ?? [];
  const open = tickets.filter((t) => t.status === "open");
  const resolved = tickets.filter((t) => t.status === "resolved");
  const escalated = tickets.filter((t) => t.status === "escalated");
  const deflection = tickets.length ? Math.round((resolved.length / tickets.length) * 100) : 0;

  return (
    <Shell org={data?.orgName}>
      <PageHead
        title="Autonomous Customer Support"
        subtitle="The AI receptionist answers from your own history and only escalates what genuinely needs a person."
        action={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {showForm ? "Close" : "Log ticket"}
          </button>
        }
      />

      {showForm && (
        <div className="panel mb-6 grid gap-3 p-5 md:grid-cols-2">
          <input
            value={form.requester}
            onChange={(e) => setForm({ ...form, requester: e.target.value })}
            placeholder="Who is asking?"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as "low" | "normal" | "high" | "urgent" })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {["low", "normal", "high", "urgent"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Subject"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
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
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={3}
            placeholder="What do they need?"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <div className="flex justify-end md:col-span-2">
            <button
              onClick={() => add.mutate()}
              disabled={!form.requester || !form.subject || !form.body || add.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {add.isPending ? "Saving…" : "Save ticket"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Opening the inbox…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Open</div>
              <div className="num mt-2 text-3xl font-bold">{open.length}</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Resolved by AI</div>
              <div className="num mt-2 text-3xl font-bold text-success">{resolved.length}</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Escalated</div>
              <div className={`num mt-2 text-3xl font-bold ${escalated.length ? "text-warn" : "text-foreground"}`}>
                {escalated.length}
              </div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Deflection rate</div>
              <div className="num mt-2 text-3xl font-bold text-primary">{deflection}%</div>
            </div>
          </div>

          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <LifeBuoy className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">{t.subject}</h3>
                      <span className={`rounded px-2 py-0.5 text-xs ${PRIORITY_TONE[t.priority] ?? "bg-secondary"}`}>
                        {t.priority}
                      </span>
                      <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{t.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.requester} · {t.channel}
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">{t.body}</p>
                  </div>
                  <button
                    onClick={() => reply.mutate(t.id)}
                    disabled={reply.isPending}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {reply.isPending && reply.variables === t.id ? "Writing…" : "AI reply"}
                  </button>
                </div>

                {t.ai_reply && (
                  <pre className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-background/50 p-4 font-sans text-sm leading-relaxed">
                    {t.ai_reply}
                  </pre>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {(["open", "resolved", "escalated"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => status.mutate({ id: t.id, status: s })}
                      disabled={t.status === s}
                      className="rounded-md border border-border px-3 py-1.5 text-xs capitalize text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      promote.mutate({ promise: t.subject, counterparty: t.requester, clientId: t.client_id })
                    }
                    disabled={promote.isPending}
                    className="rounded-md border border-primary/50 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-40"
                  >
                    Track as commitment
                  </button>
                </div>
              </div>
            ))}
            {tickets.length === 0 && (
              <div className="panel p-8 text-center text-sm text-muted-foreground">Inbox is empty.</div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

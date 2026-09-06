import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useWorkspace } from "@/lib/use-workspace";
import {
  ingestSource,
  setCommitmentStatus,
  deleteCommitment,
  type Commitment,
} from "@/lib/omniflow.functions";
import { Shell, PageHead, riskTone, dueLabel } from "@/components/omniflow/shell";
import { toast } from "sonner";
import { Check, Link2, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/commitments")({
  head: () => ({
    meta: [
      { title: "Commitments — OmniFlow" },
      {
        name: "description",
        content: "Paste any message and OmniFlow turns the promises inside it into tracked commitments with owners, due dates and risk.",
      },
      { property: "og:title", content: "Commitments — OmniFlow" },
      { property: "og:description", content: "Turn natural language promises into tracked, scored commitments." },
    ],
  }),
  component: CommitmentsPage,
});

const FILTERS = ["overdue", "today", "upcoming", "delivered", "broken"] as const;
type Filter = (typeof FILTERS)[number];

function bucket(c: Commitment): Filter {
  if (c.status === "delivered") return "delivered";
  if (c.status === "broken") return "broken";
  if (!c.due_at) return "upcoming";
  const diff = new Date(c.due_at).getTime() - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 86400000) return "today";
  return "upcoming";
}

function CommitmentsPage() {
  const { data, isLoading } = useWorkspace();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter | "all">("all");
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("slack");
  const [content, setContent] = useState("");

  const ingestFn = useServerFn(ingestSource);
  const statusFn = useServerFn(setCommitmentStatus);
  const deleteFn = useServerFn(deleteCommitment);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["workspace"] });

  const ingest = useMutation({
    mutationFn: () => ingestFn({ data: { title: title.trim() || "Untitled capture", channel, content } }),
    onSuccess: (result) => {
      toast.success(`${result.extracted} promise${result.extracted === 1 ? "" : "s"} extracted`);
      setContent("");
      setTitle("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: (vars: { id: string; status: "open" | "delivered" | "broken" }) => statusFn({ data: vars }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const commitments = data?.commitments ?? [];
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of commitments) map[bucket(c)] = (map[bucket(c)] ?? 0) + 1;
    return map;
  }, [commitments]);

  const visible = commitments.filter((c) => filter === "all" || bucket(c) === filter);
  const byId = new Map(commitments.map((c) => [c.id, c]));

  return (
    <Shell org={data?.orgName}>
      <PageHead
        title="Commitments"
        subtitle="Paste a chat thread, meeting note or email. OmniFlow reads it, finds every promise, and starts tracking it."
      />

      <div className="panel mb-6 p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is this? e.g. Tuesday client call"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          >
            <option value="slack">Chat</option>
            <option value="email">Email</option>
            <option value="call">Call / meeting</option>
            <option value="doc">Document</option>
            <option value="note">Note</option>
          </select>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="Paste the conversation here. For example: “I'll send the revised proposal by Thursday” — Devon"
          className="mt-3 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Nothing is sent anywhere else — this stays inside your workspace.
          </span>
          <button
            onClick={() => ingest.mutate()}
            disabled={ingest.isPending || content.trim().length < 10}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            {ingest.isPending ? "Reading…" : "Extract promises"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full border border-border px-3 py-1 text-xs ${filter === "all" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
        >
          All ({commitments.length})
        </button>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border border-border px-3 py-1 text-xs capitalize ${filter === f ? "bg-accent text-foreground" : "text-muted-foreground"}`}
          >
            {f} ({counts[f] ?? 0})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading commitments…</div>
      ) : (
        <div className="space-y-3">
          {visible.length === 0 && (
            <div className="panel p-8 text-center text-sm text-muted-foreground">Nothing in this view.</div>
          )}
          {visible.map((c) => {
            const tone = riskTone(c.risk_score);
            const parent = c.depends_on_id ? byId.get(c.depends_on_id) : undefined;
            const blocking = commitments.filter((x) => x.depends_on_id === c.id);
            return (
              <div key={c.id} className="panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`num rounded px-2 py-0.5 text-xs font-bold ${tone.bg}`}>
                        {c.risk_score ?? 0}
                      </span>
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">{tone.label}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span
                        className={`num text-xs ${bucket(c) === "overdue" ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {c.status === "open" ? dueLabel(c.due_at) : c.status}
                      </span>
                    </div>
                    <h3 className="mt-2 font-medium">{c.promise}</h3>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {c.owner_name} → {c.counterparty ?? "internal"}
                    </div>
                    {c.quote && <p className="mt-2 border-l-2 border-border pl-3 text-xs italic text-muted-foreground">“{c.quote}”</p>}
                    {c.risk_reason && <p className="mt-2 text-xs text-muted-foreground">{c.risk_reason}</p>}
                    {(parent || blocking.length > 0) && (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {parent && (
                          <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1">
                            <Link2 className="h-3 w-3" /> waits on “{parent.promise}”
                          </span>
                        )}
                        {blocking.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-warn/15 px-2 py-1 text-warn">
                            <Link2 className="h-3 w-3" /> blocks {blocking.length} other commitment
                            {blocking.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      title="Mark delivered"
                      onClick={() => changeStatus.mutate({ id: c.id, status: "delivered" })}
                      className="rounded-md border border-border p-2 text-success hover:bg-accent"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      title="Mark broken"
                      onClick={() => changeStatus.mutate({ id: c.id, status: "broken" })}
                      className="rounded-md border border-border p-2 text-destructive hover:bg-accent"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => remove.mutate(c.id)}
                      className="rounded-md border border-border p-2 text-muted-foreground hover:bg-accent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

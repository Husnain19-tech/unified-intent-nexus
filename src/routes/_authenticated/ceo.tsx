import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspace } from "@/lib/use-workspace";
import {
  getAgentConsole,
  runAgentsNow,
  undoAgentDecision,
  setAgentsPaused,
  type AgentDecision,
} from "@/lib/agents.functions";
import { Shell, PageHead } from "@/components/omniflow/shell";
import { toast } from "sonner";
import { Bot, Headphones, LifeBuoy, Pause, Play, RotateCcw, Target, TrendingUp, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ceo")({
  head: () => ({
    meta: [
      { title: "AI CEO — OmniFlow" },
      {
        name: "description",
        content: "Autonomous sales, call, support and pipeline agents that act every hour, log every decision and can be undone.",
      },
      { property: "og:title", content: "AI CEO — OmniFlow" },
      { property: "og:description", content: "Autonomous agents running your revenue and support operations, with full undo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CeoPage,
});

const AGENT_META = {
  sales: { label: "Sales agent", icon: Target, does: "Re-engages quiet leads, moves stages, books follow-ups", link: "/sales" },
  voip: { label: "Call agent", icon: Headphones, does: "Analyses new calls and turns next steps into promises", link: "/calls" },
  support: { label: "Support agent", icon: LifeBuoy, does: "Replies to open tickets, resolves or escalates", link: "/support" },
  pipeline: { label: "Pipeline agent", icon: TrendingUp, does: "Rescores deal health and win probability", link: "/pipeline" },
} as const;
type AgentKey = keyof typeof AGENT_META;

function ago(iso: string | null) {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

function changeText(d: AgentDecision) {
  if (d.created_record) return "Created new commitment";
  const after = d.after ?? {};
  const before = d.before ?? {};
  return Object.keys(after)
    .filter((k) => !["ai_reply", "summary", "health_note", "resolution", "action_items", "last_touch_at"].includes(k))
    .map((k) => `${k.replace(/_/g, " ")}: ${String(before[k] ?? "—")} → ${String(after[k])}`)
    .join(" · ");
}

export const agentConsoleKey = ["agent-console"] as const;

function CeoPage() {
  const { data: ws } = useWorkspace();
  const queryClient = useQueryClient();
  const consoleFn = useServerFn(getAgentConsole);
  const runFn = useServerFn(runAgentsNow);
  const undoFn = useServerFn(undoAgentDecision);
  const pauseFn = useServerFn(setAgentsPaused);

  const { data, isLoading } = useQuery({
    queryKey: agentConsoleKey,
    queryFn: () => consoleFn(),
    refetchInterval: 30000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: agentConsoleKey });
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
  };

  const run = useMutation({
    mutationFn: () => runFn(),
    onSuccess: (r) => {
      if (r.status === "paused") toast.warning(r.reason ?? "Agents are paused.");
      else if (r.status === "busy") toast.info("Agents are already running.");
      else toast.success(`Agents made ${r.decisions} decision${r.decisions === 1 ? "" : "s"}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const undo = useMutation({
    mutationFn: (id: string) => undoFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Decision reversed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pause = useMutation({
    mutationFn: (paused: boolean) => pauseFn({ data: { paused } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const decisions = data?.decisions ?? [];
  const today = decisions.filter((d) => Date.now() - new Date(d.created_at).getTime() < 86400000 && !d.undone_at);

  return (
    <Shell org={ws?.orgName}>
      <PageHead
        title="AI CEO"
        subtitle="Four autonomous agents work your revenue and support queues every hour. Every decision is logged with its reasoning and can be undone."
      />

      <div className="panel mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${data?.paused ? "bg-warn" : "bg-success animate-pulse"}`} />
          <div>
            <div className="font-semibold">
              {data?.paused ? "Agents paused" : run.isPending || data?.running ? "Agents working…" : "Agents active · hourly"}
            </div>
            <div className="text-xs text-muted-foreground">
              {data?.paused && data.pauseReason ? data.pauseReason : `Last run ${ago(data?.lastRunAt ?? null)}`} ·{" "}
              <span className="num">{today.length}</span> decisions in the last 24h
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => pause.mutate(!data?.paused)}
            disabled={pause.isPending || !data}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40"
          >
            {data?.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {data?.paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => run.mutate()}
            disabled={run.isPending || !!data?.paused}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            <Zap className="h-4 w-4" />
            {run.isPending ? "Running…" : "Run now"}
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(AGENT_META) as AgentKey[]).map((key) => {
          const meta = AGENT_META[key];
          const Icon = meta.icon;
          const mine = decisions.filter((d) => d.agent === key && !d.undone_at);
          return (
            <Link key={key} to={meta.link} className="panel block p-4 hover:border-primary/50">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-semibold">{meta.label}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{meta.does}</p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="num text-2xl font-bold">{mine.length}</span>
                <span className="text-xs text-muted-foreground">decisions · last {ago(mine[0]?.created_at ?? null)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Decision log</h2>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading decisions…</div>
          ) : decisions.length === 0 ? (
            <div className="panel p-8 text-center text-sm text-muted-foreground">
              <Bot className="mx-auto mb-2 h-6 w-6" />
              No decisions yet. Press Run now or wait for the next hourly run.
            </div>
          ) : (
            <div className="space-y-2">
              {decisions.map((d) => {
                const meta = AGENT_META[d.agent as AgentKey];
                return (
                  <div key={d.id} className={`panel p-4 ${d.undone_at ? "opacity-50" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded bg-secondary px-2 py-0.5 text-foreground">{meta?.label ?? d.agent}</span>
                          <span className="uppercase tracking-widest">{d.action.replace(/_/g, " ")}</span>
                          <span className="num">{ago(d.created_at)}</span>
                          {d.undone_at && <span className="text-warn">undone</span>}
                        </div>
                        <div className="mt-1.5 font-medium">{d.target_label}</div>
                        {changeText(d) && <div className="num mt-1 text-xs text-primary/90">{changeText(d)}</div>}
                        {d.rationale && <p className="mt-1 text-sm text-muted-foreground">{d.rationale}</p>}
                        {typeof d.after?.ai_reply === "string" && d.after.ai_reply && (
                          <p className="mt-2 border-l-2 border-border pl-3 text-xs italic text-muted-foreground line-clamp-3">
                            {d.after.ai_reply}
                          </p>
                        )}
                      </div>
                      {!d.undone_at && (
                        <button
                          onClick={() => undo.mutate(d.id)}
                          disabled={undo.isPending}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-40"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Undo
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Run history</h2>
          <div className="space-y-2">
            {(data?.runs ?? []).map((r) => (
              <div key={r.id} className="panel p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="capitalize">{r.trigger === "schedule" ? "Hourly" : "Manual"}</span>
                  <span className={r.status === "done" ? "text-success" : r.status === "running" ? "text-primary" : "text-warn"}>
                    {r.status}
                  </span>
                </div>
                <div className="num mt-1 text-muted-foreground">
                  {ago(r.started_at)} · {r.decisions} decisions
                </div>
                {r.summary && <div className="mt-1 text-muted-foreground">{r.summary}</div>}
                {r.error && <div className="mt-1 text-destructive">{r.error}</div>}
              </div>
            ))}
            {(data?.runs ?? []).length === 0 && <div className="text-xs text-muted-foreground">No runs yet.</div>}
          </div>
        </div>
      </div>
    </Shell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspace } from "@/lib/use-workspace";
import { generateBriefing, type Commitment } from "@/lib/omniflow.functions";
import { Shell, PageHead, riskTone, dueLabel } from "@/components/omniflow/shell";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/command")({
  head: () => ({
    meta: [
      { title: "Command Center — OmniFlow" },
      {
        name: "description",
        content: "Live view of every commitment in flight, workload per person and an AI briefing on what needs attention today.",
      },
      { property: "og:title", content: "Command Center — OmniFlow" },
      { property: "og:description", content: "What is on fire today, and who is overloaded." },
    ],
  }),
  component: CommandCenter,
});

function money(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string | undefined }) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`num mt-2 text-3xl font-bold ${tone ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}

function CommandCenter() {
  const { data, isLoading } = useWorkspace();
  const briefingFn = useServerFn(generateBriefing);
  const briefing = useMutation({
    mutationFn: () => briefingFn(),
    onError: (e: Error) => toast.error(e.message),
  });

  const commitments: Commitment[] = data?.commitments ?? [];
  const open = commitments.filter((c) => c.status === "open");
  const overdue = open.filter((c) => c.due_at && new Date(c.due_at).getTime() < Date.now());
  const delivered = commitments.filter((c) => c.status === "delivered");
  const broken = commitments.filter((c) => c.status === "broken");
  const reliability =
    delivered.length + broken.length > 0
      ? Math.round((delivered.length / (delivered.length + broken.length)) * 100)
      : 100;

  const load = (data?.people ?? []).map((p) => ({
    person: p,
    count: open.filter((c) => c.person_id === p.id).length,
    risk: Math.round(
      open.filter((c) => c.person_id === p.id).reduce((sum, c) => sum + (c.risk_score ?? 0), 0) /
        Math.max(1, open.filter((c) => c.person_id === p.id).length),
    ),
  }));
  const maxLoad = Math.max(1, ...load.map((l) => l.count));

  const hotspots = [...open].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)).slice(0, 5);

  const deals = data?.deals ?? [];
  const weightedPipeline = deals
    .filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")
    .reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  const invoices = data?.invoices ?? [];
  const overdueCash = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
  const tickets = data?.tickets ?? [];
  const deflection = tickets.length
    ? Math.round((tickets.filter((t) => t.status === "resolved").length / tickets.length) * 100)
    : 0;
  const fragileDeps = (data?.dependencies ?? []).filter((d) => d.risk_score >= 70).length;

  return (
    <Shell org={data?.orgName}>
      <PageHead
        title="Command Center"
        subtitle="Every promise your organization has made, scored and ranked by what will hurt if it slips."
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Waking the organizational brain…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Open commitments" value={open.length} />
            <Metric label="Overdue" value={overdue.length} tone={overdue.length ? "text-destructive" : undefined} />
            <Metric
              label="High risk"
              value={open.filter((c) => (c.risk_score ?? 0) >= 70).length}
              tone="text-warn"
            />
            <Metric label="Delivery rate" value={`${reliability}%`} tone="text-success" />
            <Metric label="Weighted pipeline" value={money(weightedPipeline)} tone="text-success" />
            <Metric
              label="Overdue receivables"
              value={money(overdueCash)}
              tone={overdueCash ? "text-destructive" : "text-foreground"}
            />
            <Metric label="Support deflection" value={`${deflection}%`} tone="text-primary" />
            <Metric
              label="Fragile dependencies"
              value={fragileDeps}
              tone={fragileDeps ? "text-warn" : "text-success"}
            />
          </div>

          <div className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold">AI daily briefing</h2>
              </div>
              <button
                onClick={() => briefing.mutate()}
                disabled={briefing.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {briefing.isPending ? "Thinking…" : "Generate briefing"}
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {briefing.data?.briefing ??
                "Generate a briefing to have OmniFlow read every open commitment and tell you where to spend today."}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <h2 className="text-lg font-semibold">Risk hotspots</h2>
              <div className="mt-4 space-y-3">
                {hotspots.length === 0 && <p className="text-sm text-muted-foreground">Nothing open right now.</p>}
                {hotspots.map((c) => {
                  const tone = riskTone(c.risk_score);
                  return (
                    <div key={c.id} className="rounded-md border border-border bg-background/40 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{c.promise}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {c.owner_name} → {c.counterparty ?? "internal"} · {dueLabel(c.due_at)}
                          </div>
                        </div>
                        <span className={`num shrink-0 rounded px-2 py-1 text-xs font-bold ${tone.bg}`}>
                          {c.risk_score ?? 0}
                        </span>
                      </div>
                      {c.risk_reason && <p className="mt-2 text-xs text-muted-foreground">{c.risk_reason}</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel p-5">
              <h2 className="text-lg font-semibold">Workload</h2>
              <div className="mt-4 space-y-4">
                {load.map((l) => (
                  <div key={l.person.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{l.person.name}</span>
                      <span className="num text-xs text-muted-foreground">{l.count} open</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full ${l.risk >= 70 ? "bg-destructive" : l.risk >= 45 ? "bg-warn" : "bg-primary"}`}
                        style={{ width: `${(l.count / maxLoad) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

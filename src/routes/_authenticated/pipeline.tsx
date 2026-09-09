import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspace } from "@/lib/use-workspace";
import { analysePipeline, scoreDeal, setDealStage } from "@/lib/omniflow.functions";
import { Shell, PageHead } from "@/components/omniflow/shell";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Predictive Pipeline — OmniFlow" },
      {
        name: "description",
        content: "Weighted forecast, deal health scores and the bottleneck stage where revenue is quietly stalling.",
      },
      { property: "og:title", content: "Predictive Pipeline — OmniFlow" },
      { property: "og:description", content: "Know which deal slips before it slips." },
    ],
  }),
  component: PipelinePage,
});

const STAGES = ["qualify", "discovery", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
type Stage = (typeof STAGES)[number];

function money(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

function PipelinePage() {
  const { data, isLoading } = useWorkspace();
  const qc = useQueryClient();
  const stageFn = useServerFn(setDealStage);
  const scoreFn = useServerFn(scoreDeal);
  const analyseFn = useServerFn(analysePipeline);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace"] });

  const stage = useMutation({
    mutationFn: (vars: { id: string; stage: Stage }) => stageFn({ data: vars }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const score = useMutation({
    mutationFn: (id: string) => scoreFn({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const analyse = useMutation({
    mutationFn: () => analyseFn(),
    onError: (e: Error) => toast.error(e.message),
  });

  const deals = data?.deals ?? [];
  const live = deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const weighted = live.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  const won = deals.filter((d) => d.stage === "closed_won").reduce((s, d) => s + d.value, 0);
  const atRisk = live.filter((d) => (d.health_score ?? 60) < 45);
  const byStage = STAGES.map((s) => ({
    stage: s,
    deals: deals.filter((d) => d.stage === s),
  }));
  const maxStage = Math.max(1, ...byStage.map((b) => b.deals.length));

  return (
    <Shell org={data?.orgName}>
      <PageHead
        title="Predictive Pipeline"
        subtitle="Weighted revenue, deal health and the stage where things quietly get stuck."
        action={
          <button
            onClick={() => analyse.mutate()}
            disabled={analyse.isPending}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4" />
            {analyse.isPending ? "Analysing…" : "Analyse pipeline"}
          </button>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading pipeline…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Weighted forecast</div>
              <div className="num mt-2 text-3xl font-bold text-success">{money(weighted)}</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Open deals</div>
              <div className="num mt-2 text-3xl font-bold">{live.length}</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Unhealthy</div>
              <div className={`num mt-2 text-3xl font-bold ${atRisk.length ? "text-destructive" : "text-success"}`}>
                {atRisk.length}
              </div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Closed won</div>
              <div className="num mt-2 text-3xl font-bold text-primary">{money(won)}</div>
            </div>
          </div>

          {analyse.data && (
            <div className="panel p-5 text-sm leading-relaxed text-muted-foreground">{analyse.data.verdict}</div>
          )}

          <div className="panel p-5">
            <h2 className="text-lg font-semibold">Stage distribution</h2>
            <div className="mt-4 space-y-3">
              {byStage.map((b) => (
                <div key={b.stage}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{b.stage.replace("_", " ")}</span>
                    <span className="num text-xs text-muted-foreground">
                      {b.deals.length} · {money(b.deals.reduce((s, d) => s + d.value, 0))}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(b.deals.length / maxStage) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {deals.map((d) => {
              const health = d.health_score ?? 60;
              return (
                <div key={d.id} className="panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{d.name}</h3>
                      <p className="num mt-1 text-xs text-muted-foreground">
                        {money(d.value)} · {d.probability}% · {d.owner_name ?? "unassigned"} ·{" "}
                        {d.close_date ? new Date(d.close_date).toDateString() : "no close date"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`num rounded px-2 py-1 text-xs font-bold ${health < 45 ? "bg-destructive/15 text-destructive" : health < 65 ? "bg-warn/15 text-warn" : "bg-success/15 text-success"}`}
                      >
                        health {health}
                      </span>
                      <select
                        value={d.stage}
                        onChange={(e) => stage.mutate({ id: d.id, stage: e.target.value as Stage })}
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => score.mutate(d.id)}
                        disabled={score.isPending}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                      >
                        {score.isPending && score.variables === d.id ? "Scoring…" : "Score health"}
                      </button>
                    </div>
                  </div>
                  {d.health_note && <p className="mt-3 text-sm text-muted-foreground">{d.health_note}</p>}
                </div>
              );
            })}
            {deals.length === 0 && (
              <div className="panel p-8 text-center text-sm text-muted-foreground">No deals yet.</div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

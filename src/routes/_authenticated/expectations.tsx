import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/use-workspace";
import { analyseExpectationGaps } from "@/lib/omniflow.functions";
import { Shell, PageHead, dueLabel } from "@/components/omniflow/shell";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/expectations")({
  head: () => ({
    meta: [
      { title: "Expectation Mapper — OmniFlow" },
      {
        name: "description",
        content: "See where a client's definition of done differs from your team's, before it turns into a dispute.",
      },
      { property: "og:title", content: "Expectation Mapper — OmniFlow" },
      { property: "og:description", content: "Quantify the gap between client and team expectations." },
    ],
  }),
  component: ExpectationsPage,
});

function ExpectationsPage() {
  const { data, isLoading } = useWorkspace();
  const [clientId, setClientId] = useState<string | null>(null);
  const analyseFn = useServerFn(analyseExpectationGaps);

  useEffect(() => {
    if (!clientId && data?.clients?.[0]) setClientId(data.clients[0].id);
  }, [data, clientId]);

  const analyse = useMutation({
    mutationFn: (id: string) => analyseFn({ data: { clientId: id } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const expectations = (data?.expectations ?? []).filter((e) => e.client_id === clientId);
  const commitments = (data?.commitments ?? []).filter((c) => c.client_id === clientId);
  const avgGap = expectations.length
    ? Math.round(expectations.reduce((s, e) => s + (e.gap_score ?? 0), 0) / expectations.length)
    : 0;

  return (
    <Shell org={data?.orgName}>
      <PageHead
        title="Expectation Mapper"
        subtitle="Two sides of every deal, side by side. Where the two columns disagree is where the argument will happen."
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading clients…</div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {(data?.clients ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => setClientId(c.id)}
                className={`rounded-full border border-border px-4 py-1.5 text-sm ${clientId === c.id ? "bg-accent text-foreground" : "text-muted-foreground"}`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Alignment index</div>
                <div
                  className={`num text-4xl font-bold ${avgGap >= 70 ? "text-destructive" : avgGap >= 45 ? "text-warn" : "text-success"}`}
                >
                  {100 - avgGap}
                  <span className="text-lg text-muted-foreground">/100</span>
                </div>
              </div>
              <button
                onClick={() => clientId && analyse.mutate(clientId)}
                disabled={!clientId || analyse.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                {analyse.isPending ? "Analysing…" : "Predict the conflict"}
              </button>
            </div>
            {analyse.data && (
              <div className="mt-4 flex gap-3 rounded-md border border-warn/40 bg-warn/10 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                <p className="text-sm leading-relaxed">{analyse.data.verdict}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {expectations.map((e) => {
              const gap = e.gap_score ?? 0;
              return (
                <div key={e.id} className="panel p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">{e.label}</h3>
                    <span
                      className={`num rounded px-2 py-1 text-xs font-bold ${gap >= 70 ? "bg-destructive/15 text-destructive" : gap >= 45 ? "bg-warn/15 text-warn" : "bg-success/15 text-success"}`}
                    >
                      gap {gap}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border border-border bg-background/50 p-3">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Client believes</div>
                      <p className="mt-1.5 text-sm">{e.client_view}</p>
                    </div>
                    <div className="rounded-md border border-border bg-background/50 p-3">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Team believes</div>
                      <p className="mt-1.5 text-sm">{e.team_view}</p>
                    </div>
                  </div>
                  {e.gap_note && <p className="mt-3 text-xs text-muted-foreground">{e.gap_note}</p>}
                </div>
              );
            })}
            {expectations.length === 0 && (
              <div className="panel p-8 text-center text-sm text-muted-foreground">
                No expectations recorded for this client yet.
              </div>
            )}
          </div>

          {commitments.length > 0 && (
            <div className="panel p-5">
              <h2 className="text-lg font-semibold">What we have actually promised them</h2>
              <ul className="mt-3 divide-y divide-border">
                {commitments.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{c.promise}</span>
                    <span className="num shrink-0 text-xs text-muted-foreground">
                      {c.status === "open" ? dueLabel(c.due_at) : c.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

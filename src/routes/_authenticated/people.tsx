import { createFileRoute } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/use-workspace";
import { Shell, PageHead, dueLabel } from "@/components/omniflow/shell";

export const Route = createFileRoute("/_authenticated/people")({
  head: () => ({
    meta: [
      { title: "People & Reliability — OmniFlow" },
      {
        name: "description",
        content: "Reliability scores built from real delivery history: who keeps their promises, who is overloaded, and who needs support.",
      },
      { property: "og:title", content: "People & Reliability — OmniFlow" },
      { property: "og:description", content: "Quantified trust across your team." },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  const { data, isLoading } = useWorkspace();
  const commitments = data?.commitments ?? [];

  const rows = (data?.people ?? []).map((person) => {
    const own = commitments.filter((c) => c.person_id === person.id);
    const delivered = own.filter((c) => c.status === "delivered").length;
    const broken = own.filter((c) => c.status === "broken").length;
    const open = own.filter((c) => c.status === "open");
    const overdue = open.filter((c) => c.due_at && new Date(c.due_at).getTime() < Date.now()).length;
    const closed = delivered + broken;
    const reliability = closed === 0 ? null : Math.round((delivered / closed) * 100);
    const avgRisk = open.length ? Math.round(open.reduce((s, c) => s + (c.risk_score ?? 0), 0) / open.length) : 0;
    return { person, delivered, broken, open, overdue, reliability, avgRisk };
  });

  return (
    <Shell org={data?.orgName}>
      <PageHead
        title="People & Reliability"
        subtitle="Trust, measured. Every score below is computed from promises actually kept or broken in your workspace."
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading team…</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <div key={row.person.id} className="panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{row.person.name}</h2>
                  <p className="text-sm text-muted-foreground">{row.person.role_title}</p>
                </div>
                <div className="text-right">
                  <div
                    className={`num text-3xl font-bold ${
                      row.reliability === null
                        ? "text-muted-foreground"
                        : row.reliability >= 80
                          ? "text-success"
                          : row.reliability >= 50
                            ? "text-warn"
                            : "text-destructive"
                    }`}
                  >
                    {row.reliability === null ? "—" : `${row.reliability}%`}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">reliability</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "open", value: row.open.length, tone: "text-foreground" },
                  { label: "overdue", value: row.overdue, tone: row.overdue ? "text-destructive" : "text-foreground" },
                  { label: "kept", value: row.delivered, tone: "text-success" },
                  { label: "broken", value: row.broken, tone: row.broken ? "text-destructive" : "text-foreground" },
                ].map((m) => (
                  <div key={m.label} className="rounded-md bg-background/50 p-2">
                    <div className={`num text-lg font-bold ${m.tone}`}>{m.value}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{m.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Average slip risk on open work</span>
                  <span className="num">{row.avgRisk}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full ${row.avgRisk >= 70 ? "bg-destructive" : row.avgRisk >= 45 ? "bg-warn" : "bg-success"}`}
                    style={{ width: `${row.avgRisk}%` }}
                  />
                </div>
              </div>

              {row.open.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {row.open.slice(0, 3).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-muted-foreground">{c.promise}</span>
                      <span className="num shrink-0 text-xs text-muted-foreground">{dueLabel(c.due_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

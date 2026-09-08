import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useWorkspace } from "@/lib/use-workspace";
import { addDependency, analyseDependency } from "@/lib/omniflow.functions";
import { Shell, PageHead } from "@/components/omniflow/shell";
import { toast } from "sonner";
import { GitBranch, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dependencies")({
  head: () => ({
    meta: [
      { title: "Dependency Monitor — OmniFlow" },
      {
        name: "description",
        content: "Track the packages, services and internal scripts you silently depend on, and forecast what breaks when they change.",
      },
      { property: "og:title", content: "Dependency Monitor — OmniFlow" },
      { property: "og:description", content: "Forecast breakage before it happens." },
    ],
  }),
  component: DependenciesPage,
});

function DependenciesPage() {
  const { data, isLoading } = useWorkspace();
  const qc = useQueryClient();
  const addFn = useServerFn(addDependency);
  const analyseFn = useServerFn(analyseDependency);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "package", version: "", criticality: 60, usage_note: "", debt_hours: 4 });
  const [forecast, setForecast] = useState<{ id: string; text: string } | null>(null);

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          name: form.name,
          kind: form.kind,
          version: form.version || undefined,
          criticality: Number(form.criticality),
          usage_note: form.usage_note || undefined,
          debt_hours: Number(form.debt_hours),
        },
      }),
    onSuccess: () => {
      toast.success("Dependency registered.");
      setForm({ name: "", kind: "package", version: "", criticality: 60, usage_note: "", debt_hours: 4 });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const analyse = useMutation({
    mutationFn: (id: string) => analyseFn({ data: { id } }),
    onSuccess: (res, id) => {
      setForecast({ id, text: res.forecast });
      qc.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deps = data?.dependencies ?? [];
  const debt = deps.reduce((s, d) => s + Number(d.debt_hours ?? 0), 0);
  const fragile = deps.filter((d) => d.risk_score >= 70).length;

  return (
    <Shell org={data?.orgName}>
      <PageHead
        title="Silent Dependency Monitor"
        subtitle="The things nobody thinks about until they break. Ranked by how much of your business leans on them."
        action={
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {open ? "Close" : "Register dependency"}
          </button>
        }
      />

      {open && (
        <div className="panel mb-6 grid gap-3 p-5 md:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="package">Package</option>
            <option value="service">Service</option>
            <option value="internal">Internal script</option>
            <option value="vendor">Vendor</option>
          </select>
          <input
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            placeholder="Version"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            Criticality
            <input
              type="range"
              min={0}
              max={100}
              value={form.criticality}
              onChange={(e) => setForm({ ...form, criticality: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="num text-foreground">{form.criticality}</span>
          </label>
          <textarea
            value={form.usage_note}
            onChange={(e) => setForm({ ...form, usage_note: e.target.value })}
            placeholder="How is it actually used?"
            rows={2}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            Shortcut cost (hours)
            <input
              type="number"
              min={0}
              value={form.debt_hours}
              onChange={(e) => setForm({ ...form, debt_hours: Number(e.target.value) })}
              className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="flex justify-end md:col-span-2">
            <button
              onClick={() => add.mutate()}
              disabled={!form.name || add.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {add.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Mapping dependencies…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Tracked</div>
              <div className="num mt-2 text-3xl font-bold">{deps.length}</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Fragile</div>
              <div className={`num mt-2 text-3xl font-bold ${fragile ? "text-destructive" : "text-success"}`}>{fragile}</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Technical debt interest</div>
              <div className="num mt-2 text-3xl font-bold text-warn">{debt}h</div>
            </div>
          </div>

          <div className="space-y-3">
            {deps.map((d) => (
              <div key={d.id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">{d.name}</h3>
                      <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {d.kind} {d.version ? `· ${d.version}` : ""}
                      </span>
                    </div>
                    {d.usage_note && <p className="mt-2 text-sm text-muted-foreground">{d.usage_note}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`num rounded px-2 py-1 text-xs font-bold ${d.risk_score >= 70 ? "bg-destructive/15 text-destructive" : d.risk_score >= 45 ? "bg-warn/15 text-warn" : "bg-success/15 text-success"}`}
                    >
                      risk {d.risk_score}
                    </span>
                    <button
                      onClick={() => analyse.mutate(d.id)}
                      disabled={analyse.isPending}
                      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {analyse.isPending && analyse.variables === d.id ? "Forecasting…" : "Breaking change forecast"}
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>criticality {d.criticality}/100</span>
                  <span>{Number(d.debt_hours)}h of shortcut cost</span>
                </div>
                {(forecast?.id === d.id ? forecast.text : d.risk_note) && (
                  <p className="mt-3 rounded-md border border-border bg-background/50 p-3 text-sm leading-relaxed">
                    {forecast?.id === d.id ? forecast.text : d.risk_note}
                  </p>
                )}
              </div>
            ))}
            {deps.length === 0 && (
              <div className="panel p-8 text-center text-sm text-muted-foreground">Nothing registered yet.</div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

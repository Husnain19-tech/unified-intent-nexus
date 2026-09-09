import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useWorkspace } from "@/lib/use-workspace";
import { addInvoice, analyseCashflow, setInvoiceStatus } from "@/lib/omniflow.functions";
import { Shell, PageHead } from "@/components/omniflow/shell";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Financial Intelligence — OmniFlow" },
      {
        name: "description",
        content: "Cash position, receivables to chase, spend by category and a 90-day outlook written by AI.",
      },
      { property: "og:title", content: "Financial Intelligence — OmniFlow" },
      { property: "og:description", content: "Know your cash runway before it becomes a problem." },
    ],
  }),
  component: FinancePage,
});

function money(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

const STATUS_TONE: Record<string, string> = {
  paid: "bg-success/15 text-success",
  sent: "bg-primary/15 text-primary",
  overdue: "bg-destructive/15 text-destructive",
  draft: "bg-secondary text-muted-foreground",
};

function FinancePage() {
  const { data, isLoading } = useWorkspace();
  const qc = useQueryClient();
  const addFn = useServerFn(addInvoice);
  const statusFn = useServerFn(setInvoiceStatus);
  const analyseFn = useServerFn(analyseCashflow);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ number: "", amount: 5000, due_in_days: 30, clientId: "" });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace"] });

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          number: form.number,
          amount: Number(form.amount),
          due_in_days: Number(form.due_in_days),
          clientId: form.clientId || null,
        },
      }),
    onSuccess: () => {
      toast.success("Invoice added.");
      setShowForm(false);
      setForm({ number: "", amount: 5000, due_in_days: 30, clientId: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = useMutation({
    mutationFn: (vars: { id: string; status: "draft" | "sent" | "paid" | "overdue" }) => statusFn({ data: vars }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const analyse = useMutation({
    mutationFn: () => analyseFn(),
    onError: (e: Error) => toast.error(e.message),
  });

  const invoices = data?.invoices ?? [];
  const expenses = data?.expenses ?? [];
  const collected = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const receivable = invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.amount, 0);
  const overdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
  const spend = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...byCategory.map(([, v]) => v));

  return (
    <Shell org={data?.orgName}>
      <PageHead
        title="Financial Intelligence"
        subtitle="Money in, money out, and what the next ninety days look like if nothing changes."
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {showForm ? "Close" : "Add invoice"}
            </button>
            <button
              onClick={() => analyse.mutate()}
              disabled={analyse.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" />
              {analyse.isPending ? "Modelling…" : "Cash outlook"}
            </button>
          </div>
        }
      />

      {showForm && (
        <div className="panel mb-6 grid gap-3 p-5 md:grid-cols-4">
          <input
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
            placeholder="Invoice number"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            placeholder="Amount"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={form.due_in_days}
            onChange={(e) => setForm({ ...form, due_in_days: Number(e.target.value) })}
            placeholder="Due in days"
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
          <div className="flex justify-end md:col-span-4">
            <button
              onClick={() => add.mutate()}
              disabled={!form.number || add.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {add.isPending ? "Saving…" : "Save invoice"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Counting the money…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Collected</div>
              <div className="num mt-2 text-3xl font-bold text-success">{money(collected)}</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Receivables</div>
              <div className="num mt-2 text-3xl font-bold">{money(receivable)}</div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Overdue</div>
              <div className={`num mt-2 text-3xl font-bold ${overdue ? "text-destructive" : "text-success"}`}>
                {money(overdue)}
              </div>
            </div>
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Spend</div>
              <div className="num mt-2 text-3xl font-bold text-warn">{money(spend)}</div>
            </div>
          </div>

          {analyse.data && (
            <div className="panel p-5 text-sm leading-relaxed text-muted-foreground">{analyse.data.commentary}</div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="panel p-5">
              <h2 className="text-lg font-semibold">Invoices</h2>
              <div className="mt-4 space-y-3">
                {invoices.map((i) => (
                  <div
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="num text-sm font-medium">{i.number}</span>
                        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_TONE[i.status] ?? "bg-secondary"}`}>
                          {i.status}
                        </span>
                      </div>
                      <div className="num mt-1 text-xs text-muted-foreground">
                        {money(i.amount)} · due {i.due_at ? new Date(i.due_at).toDateString() : "n/a"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(["sent", "paid", "overdue"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => status.mutate({ id: i.id, status: s })}
                          disabled={i.status === s}
                          className="rounded-md border border-border px-2.5 py-1 text-xs capitalize text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
              </div>
            </div>

            <div className="panel p-5">
              <h2 className="text-lg font-semibold">Spend by category</h2>
              <div className="mt-4 space-y-3">
                {byCategory.map(([cat, amount]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{cat}</span>
                      <span className="num text-xs text-muted-foreground">{money(amount)}</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-warn" style={{ width: `${(amount / maxCat) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {byCategory.length === 0 && <p className="text-sm text-muted-foreground">No expenses recorded.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

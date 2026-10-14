import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  addProject,
  addTask,
  deleteTask,
  getTasks,
  planMyDay,
  tasksFromCommitments,
  updateTask,
  type DayPlan,
  type Task,
} from "@/lib/tasks.functions";
import { Shell, PageHead } from "@/components/omniflow/shell";
import { toast } from "sonner";
import { CalendarDays, Columns3, List, Plus, Sparkles, Trash2, Handshake } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks & Projects — OmniFlow" },
      { name: "description", content: "Boards, lists and calendars for every project, with AI that plans each person's day by priority." },
      { property: "og:title", content: "Tasks & Projects — OmniFlow" },
      { property: "og:description", content: "Kanban, list and calendar views with AI daily planning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

const STATUSES: { key: Task["status"]; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];
const PRIORITY_TONE: Record<Task["priority"], string> = {
  urgent: "bg-destructive/15 text-destructive",
  high: "bg-warn/15 text-warn",
  normal: "bg-secondary text-muted-foreground",
  low: "bg-secondary text-muted-foreground/70",
};
const PRIORITY_RANK: Record<Task["priority"], number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function TasksPage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getTasks);
  const { data, isLoading } = useQuery({ queryKey: ["tasks"], queryFn: () => fetchFn() });
  const addFn = useServerFn(addTask);
  const updFn = useServerFn(updateTask);
  const delFn = useServerFn(deleteTask);
  const projFn = useServerFn(addProject);
  const fromCFn = useServerFn(tasksFromCommitments);
  const planFn = useServerFn(planMyDay);

  const [view, setView] = useState<"board" | "list" | "calendar">("board");
  const [project, setProject] = useState<string>("all");
  const [person, setPerson] = useState<string>("all");
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [form, setForm] = useState({ title: "", priority: "normal" as Task["priority"], assigneeId: "", dueAt: "", parentId: "" });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["workspace"] });
  };
  const onErr = (e: Error) => toast.error(e.message);

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          title: form.title,
          priority: form.priority,
          status: "todo",
          assigneeId: form.assigneeId || null,
          dueAt: form.dueAt || null,
          parentId: form.parentId || null,
          projectId: project === "all" ? (data?.projects[0]?.id ?? null) : project,
        },
      }),
    onSuccess: () => {
      setForm({ title: "", priority: "normal", assigneeId: "", dueAt: "", parentId: "" });
      refresh();
    },
    onError: onErr,
  });
  type Upd = { id: string; status?: Task["status"]; priority?: Task["priority"]; assigneeId?: string | null; dueAt?: string | null };
  const upd = useMutation({ mutationFn: (d: Upd) => updFn({ data: d }), onSuccess: refresh, onError: onErr });
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: refresh, onError: onErr });
  const newProj = useMutation({
    mutationFn: (name: string) => projFn({ data: { name } }),
    onSuccess: (r) => {
      setProject(r.id);
      refresh();
    },
    onError: onErr,
  });
  const fromC = useMutation({
    mutationFn: () => fromCFn(),
    onSuccess: (r) => {
      toast.success(r.created ? `${r.created} promises turned into tasks` : "Every open promise already has a task");
      refresh();
    },
    onError: onErr,
  });
  const planM = useMutation({ mutationFn: () => planFn(), onSuccess: setPlan, onError: onErr });

  const people = data?.people ?? [];
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.name ?? "Unassigned";
  const all = data?.tasks ?? [];
  const subtasksOf = (id: string) => all.filter((t) => t.parent_id === id);
  const visible = useMemo(
    () =>
      all
        .filter((t) => !t.parent_id)
        .filter((t) => project === "all" || t.project_id === project)
        .filter((t) => person === "all" || t.assignee_id === person)
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.due_at ?? "9").localeCompare(b.due_at ?? "9")),
    [all, project, person],
  );

  const card = (t: Task) => {
    const subs = subtasksOf(t.id);
    const overdue = t.due_at && t.status !== "done" && t.due_at < new Date().toISOString().slice(0, 10);
    return (
      <div key={t.id} className="rounded-md border border-border bg-panel p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className={t.status === "done" ? "text-muted-foreground line-through" : ""}>{t.title}</div>
          <button aria-label="Delete task" onClick={() => del.mutate(t.id)} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className={`rounded px-1.5 py-0.5 ${PRIORITY_TONE[t.priority]}`}>{t.priority}</span>
          {t.commitment_id && (
            <span className="flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-primary">
              <Handshake className="h-3 w-3" /> promise
            </span>
          )}
          <span className="text-muted-foreground">{nameOf(t.assignee_id)}</span>
          {t.due_at && <span className={overdue ? "text-destructive" : "text-muted-foreground"}>· {t.due_at}</span>}
        </div>
        {subs.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-border pt-2">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={s.status === "done"}
                  onChange={(e) => upd.mutate({ id: s.id, status: e.target.checked ? "done" : "todo" })}
                />
                <span className={s.status === "done" ? "text-muted-foreground line-through" : ""}>{s.title}</span>
              </li>
            ))}
          </ul>
        )}
        <select
          aria-label="Move task"
          value={t.status}
          onChange={(e) => upd.mutate({ id: t.id, status: e.target.value as Task["status"] })}
          className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // Calendar: current month grid
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const iso = (d: number) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <Shell>
      <PageHead
        title="Tasks & Projects"
        subtitle="Boards, lists and calendars for every project. Promises from calls and messages become tasks, and AI plans each person's day by priority."
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => fromC.mutate()} disabled={fromC.isPending} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
              <Handshake className="h-4 w-4" /> {fromC.isPending ? "Converting…" : "Promises → tasks"}
            </button>
            <button onClick={() => planM.mutate()} disabled={planM.isPending} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
              <Sparkles className="h-4 w-4" /> {planM.isPending ? "Planning…" : "Plan today"}
            </button>
          </div>
        }
      />

      {plan && (
        <div className="mb-6 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Today's plan</h2>
            <button onClick={() => setPlan(null)} className="text-xs text-muted-foreground">Close</button>
          </div>
          {plan.length === 0 && <p className="text-sm text-muted-foreground">Nothing open — everyone is clear.</p>}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plan.map((p) => (
              <div key={p.person} className="rounded-md border border-border bg-panel p-3">
                <div className="font-medium">{p.person}</div>
                <p className="mb-2 text-xs text-muted-foreground">{p.note}</p>
                <ol className="list-decimal space-y-1 pl-4 text-sm">
                  {p.items.map((i) => (
                    <li key={i.task_id}>
                      {i.title}
                      <div className="text-xs text-muted-foreground">{i.why}</div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={project} onChange={(e) => setProject(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
          <option value="all">All projects</option>
          {data?.projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          onClick={() => {
            const name = window.prompt("Project name");
            if (name?.trim()) newProj.mutate(name.trim());
          }}
          className="rounded-md border border-border px-2 py-1.5 text-sm hover:bg-accent"
        >
          + Project
        </button>
        <select value={person} onChange={(e) => setPerson(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
          <option value="all">Everyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="ml-auto flex rounded-md border border-border">
          {([
            ["board", Columns3, "Board"],
            ["list", List, "List"],
            ["calendar", CalendarDays, "Calendar"],
          ] as const).map(([k, Icon, label]) => (
            <button key={k} onClick={() => setView(k)} className={`flex items-center gap-1 px-3 py-1.5 text-sm ${view === k ? "bg-accent" : "text-muted-foreground"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (form.title.trim()) add.mutate();
        }}
        className="mb-6 flex flex-wrap gap-2 rounded-lg border border-border bg-panel/60 p-3"
      >
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="New task…" className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" />
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })} className="rounded-md border border-border bg-background px-2 text-sm">
          {(["urgent", "high", "normal", "low"] as const).map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })} className="rounded-md border border-border bg-background px-2 text-sm">
          <option value="">Unassigned</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} className="rounded-md border border-border bg-background px-2 text-sm" />
        <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className="max-w-[180px] rounded-md border border-border bg-background px-2 text-sm">
          <option value="">Top-level task</option>
          {visible.map((t) => <option key={t.id} value={t.id}>Subtask of: {t.title}</option>)}
        </select>
        <button disabled={add.isPending} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Loading tasks…</p>}

      {view === "board" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((s) => {
            const col = visible.filter((t) => t.status === s.key);
            return (
              <div key={s.key} className="rounded-lg border border-border bg-panel/40 p-3">
                <div className="mb-3 flex justify-between text-xs uppercase tracking-widest text-muted-foreground">
                  <span>{s.label}</span>
                  <span>{col.length}</span>
                </div>
                <div className="space-y-2">{col.map(card)}</div>
              </div>
            );
          })}
        </div>
      )}

      {view === "list" && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-panel/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr><th className="p-3">Task</th><th className="p-3">Priority</th><th className="p-3">Owner</th><th className="p-3">Due</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="p-3">{t.title}{subtasksOf(t.id).length > 0 && <span className="ml-2 text-xs text-muted-foreground">{subtasksOf(t.id).filter((s) => s.status === "done").length}/{subtasksOf(t.id).length} subtasks</span>}</td>
                  <td className="p-3">
                    <select value={t.priority} onChange={(e) => upd.mutate({ id: t.id, priority: e.target.value as Task["priority"] })} className={`rounded px-1.5 py-0.5 text-xs ${PRIORITY_TONE[t.priority]}`}>
                      {(["urgent", "high", "normal", "low"] as const).map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <select value={t.assignee_id ?? ""} onChange={(e) => upd.mutate({ id: t.id, assigneeId: e.target.value || null })} className="rounded border border-border bg-background px-1 text-xs">
                      <option value="">Unassigned</option>
                      {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <input type="date" value={t.due_at ?? ""} onChange={(e) => upd.mutate({ id: t.id, dueAt: e.target.value || null })} className="rounded border border-border bg-background px-1 text-xs" />
                  </td>
                  <td className="p-3">
                    <select value={t.status} onChange={(e) => upd.mutate({ id: t.id, status: e.target.value as Task["status"] })} className="rounded border border-border bg-background px-1 text-xs">
                      {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "calendar" && (
        <div>
          <h2 className="mb-2 font-semibold">{now.toLocaleString(undefined, { month: "long", year: "numeric" })}</h2>
          <div className="grid grid-cols-7 gap-1 text-xs">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="p-1 text-muted-foreground">{d}</div>)}
            {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
              const dayTasks = visible.filter((t) => t.due_at === iso(d));
              const today = d === now.getDate();
              return (
                <div key={d} className={`min-h-[90px] rounded border p-1 ${today ? "border-primary" : "border-border"} bg-panel/40`}>
                  <div className={today ? "font-bold text-primary" : "text-muted-foreground"}>{d}</div>
                  {dayTasks.map((t) => (
                    <div key={t.id} className={`mt-1 truncate rounded px-1 ${PRIORITY_TONE[t.priority]} ${t.status === "done" ? "line-through opacity-60" : ""}`} title={t.title}>
                      {t.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Shell>
  );
}

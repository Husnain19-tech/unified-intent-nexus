import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type Project = { id: string; name: string; color: string; client_id: string | null };
export type Task = {
  id: string;
  project_id: string | null;
  parent_id: string | null;
  commitment_id: string | null;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "urgent" | "high" | "normal" | "low";
  assignee_id: string | null;
  due_at: string | null;
  position: number;
  created_at: string;
};
export type DayPlan = { person: string; items: { task_id: string; title: string; why: string }[]; note: string }[];

type Db = { rpc: (fn: string, args?: Record<string, unknown>) => any; from: (t: string) => any };

async function org(db: Db): Promise<string> {
  const { data, error } = await db.rpc("bootstrap_workspace");
  if (error) throw new Error(error.message);
  return data as string;
}

export const getTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    const orgId = await org(db);
    const [p, t, people] = await Promise.all([
      db.from("projects").select("id,name,color,client_id").eq("org_id", orgId).order("created_at"),
      db.from("tasks").select("*").eq("org_id", orgId).order("position"),
      db.from("people").select("id,name").eq("org_id", orgId).order("name"),
    ]);
    return {
      projects: (p.data ?? []) as Project[],
      tasks: (t.data ?? []) as Task[],
      people: (people.data ?? []) as { id: string; name: string }[],
    };
  });

export const addProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ name: z.string().min(1).max(80) }).parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const orgId = await org(db);
    const { data: row, error } = await db.from("projects").insert({ org_id: orgId, name: data.name }).select("id").single();
    if (error) throw new Error(error.message);
    return row as { id: string };
  });

const TaskInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  projectId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  priority: z.enum(["urgent", "high", "normal", "low"]).default("normal"),
  status: z.enum(["todo", "in_progress", "review", "done"]).default("todo"),
  dueAt: z.string().nullable().optional(),
});

export const addTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TaskInput.parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const orgId = await org(db);
    const { error } = await db.from("tasks").insert({
      org_id: orgId,
      title: data.title,
      description: data.description ?? null,
      project_id: data.projectId ?? null,
      parent_id: data.parentId ?? null,
      assignee_id: data.assigneeId ?? null,
      priority: data.priority,
      status: data.status,
      due_at: data.dueAt || null,
      position: Date.now() / 1000,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["todo", "in_progress", "review", "done"]).optional(),
        priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
        assigneeId: z.string().uuid().nullable().optional(),
        dueAt: z.string().nullable().optional(),
        title: z.string().min(1).max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const orgId = await org(db);
    const patch: Record<string, unknown> = {};
    if (data.status) patch["status"] = data.status;
    if (data.priority) patch["priority"] = data.priority;
    if (data.assigneeId !== undefined) patch["assignee_id"] = data.assigneeId;
    if (data.dueAt !== undefined) patch["due_at"] = data.dueAt || null;
    if (data.title) patch["title"] = data.title;
    const { error } = await db.from("tasks").update(patch).eq("id", data.id).eq("org_id", orgId);
    if (error) throw new Error(error.message);
    // Keep the linked promise in step with its task.
    if (data.status === "done") {
      const { data: t } = await db.from("tasks").select("commitment_id").eq("id", data.id).maybeSingle();
      if (t?.commitment_id) await db.from("commitments").update({ status: "delivered" }).eq("id", t.commitment_id);
    }
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const orgId = await org(db);
    const { error } = await db.from("tasks").delete().eq("id", data.id).eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Turn every open promise without a task into a task for its owner. */
export const tasksFromCommitments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    const orgId = await org(db);
    const [{ data: cs }, { data: existing }] = await Promise.all([
      db.from("commitments").select("id,promise,person_id,due_at,risk_score,quote").eq("org_id", orgId).eq("status", "open"),
      db.from("tasks").select("commitment_id").eq("org_id", orgId).not("commitment_id", "is", null),
    ]);
    const taken = new Set(((existing ?? []) as { commitment_id: string }[]).map((r) => r.commitment_id));
    const rows = ((cs ?? []) as { id: string; promise: string; person_id: string | null; due_at: string | null; risk_score: number | null; quote: string | null }[])
      .filter((c) => !taken.has(c.id))
      .map((c, i) => ({
        org_id: orgId,
        commitment_id: c.id,
        title: c.promise,
        description: c.quote ? `From a promise: "${c.quote}"` : null,
        assignee_id: c.person_id,
        due_at: c.due_at ? c.due_at.slice(0, 10) : null,
        priority: (c.risk_score ?? 0) >= 70 ? "urgent" : (c.risk_score ?? 0) >= 45 ? "high" : "normal",
        position: Date.now() / 1000 + i,
      }));
    if (rows.length) {
      const { error } = await db.from("tasks").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { created: rows.length };
  });

/** Claude builds today's plan per person from open tasks, priority, due dates and load. */
export const planMyDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DayPlan> => {
    const db = context.supabase as unknown as Db;
    const orgId = await org(db);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");
    const [{ data: tasks }, { data: people }] = await Promise.all([
      db.from("tasks").select("id,title,status,priority,assignee_id,due_at").eq("org_id", orgId).neq("status", "done"),
      db.from("people").select("id,name,role_title").eq("org_id", orgId),
    ]);
    const open = (tasks ?? []) as Task[];
    if (open.length === 0) return [];
    const ppl = (people ?? []) as { id: string; name: string; role_title: string | null }[];
    const name = (id: string | null) => ppl.find((p) => p.id === id)?.name ?? "Unassigned";

    const { createLovableClaudeProvider, OMNIFLOW_CLAUDE_MODEL } = await import("./ai-gateway.server");
    const { streamText, Output } = await import("ai");
    const schema = z.object({
      plans: z.array(
        z.object({
          person: z.string(),
          note: z.string(),
          items: z.array(z.object({ task_id: z.string(), why: z.string() })),
        }),
      ),
    });
    try {
      const result = streamText({
        model: createLovableClaudeProvider(key)(OMNIFLOW_CLAUDE_MODEL),
        output: Output.object({ schema }),
        maxOutputTokens: 16000,
        system:
          "You are an operations lead planning today's work. For each team member pick at most 5 of their open tasks for today, ordered by what must happen first: overdue and urgent first, then due soon, then high priority; in-progress work before new work. Unassigned urgent tasks go to the person with the lightest load whose role fits — put them in that person's list and say so in 'why'. 'why' is one short reason. 'note' is one sentence flagging overload or risk for that person. Use only task ids given.",
        prompt: `TODAY: ${new Date().toDateString()}\nTEAM: ${ppl.map((p) => `${p.name} (${p.role_title ?? "team"})`).join(", ")}\n\nOPEN TASKS:\n${open
          .map((t) => `- id=${t.id} | ${t.title} | ${t.status} | ${t.priority} | owner ${name(t.assignee_id)} | due ${t.due_at ?? "none"}`)
          .join("\n")}`,
      });
      const out = await result.output;
      const byId = new Map(open.map((t) => [t.id, t]));
      return out.plans
        .map((p) => ({
          person: p.person,
          note: p.note,
          items: p.items.filter((i) => byId.has(i.task_id)).map((i) => ({ task_id: i.task_id, title: byId.get(i.task_id)!.title, why: i.why })),
        }))
        .filter((p) => p.items.length);
    } catch (error) {
      const s = (error as { statusCode?: number }).statusCode;
      if (s === 402) throw new Error("Out of AI credits — add credits to plan the day.");
      if (s === 429) throw new Error("The AI service is busy. Try again shortly.");
      console.error("planMyDay failed", error);
      throw new Error("Could not build today's plan. Try again.");
    }
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AgentDecision = {
  id: string;
  agent: string;
  action: string;
  target_table: string;
  target_label: string | null;
  before: Record<string, string | number | boolean | null | string[]> | null;
  after: Record<string, string | number | boolean | null | string[]> | null;
  created_record: boolean;
  rationale: string | null;
  undone_at: string | null;
  created_at: string;
};

export type AgentRun = {
  id: string;
  trigger: string;
  status: string;
  decisions: number;
  summary: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

export type AgentConsole = {
  paused: boolean;
  pauseReason: string | null;
  lastRunAt: string | null;
  running: boolean;
  runs: AgentRun[];
  decisions: AgentDecision[];
};

async function orgOf(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc("bootstrap_workspace");
  if (error) throw new Error(error.message);
  return data as string;
}

export const getAgentConsole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgentConsole> => {
    const supabase = context.supabase as any;
    const orgId = await orgOf(supabase);
    const [{ data: settings }, { data: runs }, { data: decisions }] = await Promise.all([
      supabase.from("agent_settings").select("*").eq("org_id", orgId).maybeSingle(),
      supabase.from("agent_runs").select("*").eq("org_id", orgId).order("started_at", { ascending: false }).limit(15),
      supabase.from("agent_decisions").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(80),
    ]);
    return {
      paused: !!settings?.paused,
      pauseReason: settings?.pause_reason ?? null,
      lastRunAt: settings?.last_run_at ?? null,
      running: !!settings?.lease_until && new Date(settings.lease_until).getTime() > Date.now(),
      runs: (runs ?? []) as AgentRun[],
      decisions: (decisions ?? []) as AgentDecision[],
    };
  });

export const runAgentsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const orgId = await orgOf(supabase);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");
    const { runAgents } = await import("./agents.server");
    return await runAgents(supabase, orgId, key, "manual");
  });

export const undoAgentDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const orgId = await orgOf(supabase);
    const { undoDecision } = await import("./agents.server");
    return await undoDecision(supabase, orgId, data.id);
  });

export const setAgentsPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ paused: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const orgId = await orgOf(supabase);
    const { error } = await supabase
      .from("agent_settings")
      .upsert({ org_id: orgId, paused: data.paused, pause_reason: data.paused ? "Paused by you." : null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/agents/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;

        // Verify the caller holds the private scheduler token.
        const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { data: row } = await db.from("scheduler_tokens").select("token").eq("id", 1).maybeSingle();
        const { createHash, timingSafeEqual } = await import("node:crypto");
        const h = (v: string) => createHash("sha256").update(v).digest();
        if (!row?.token || !timingSafeEqual(h(token), h(row.token))) {
          return new Response("Unauthorized", { status: 401 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("AI not configured", { status: 500 });

        const { runAgents } = await import("@/lib/agents.server");
        const { data: orgs } = await db.from("organizations").select("id").limit(20);
        const results: Record<string, unknown> = {};
        for (const org of (orgs ?? []) as { id: string }[]) {
          try {
            results[org.id] = await runAgents(db, org.id, key, "schedule");
          } catch (error) {
            results[org.id] = { status: "error", reason: (error as Error).message };
          }
        }
        return Response.json({ ok: true, results });
      },
    },
  },
});

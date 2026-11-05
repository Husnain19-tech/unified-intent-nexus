import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type Doc = {
  id: string;
  parent_id: string | null;
  source_id: string | null;
  title: string;
  content: string;
  icon: string | null;
  updated_at: string;
};

type Db = { rpc: (fn: string, args?: Record<string, unknown>) => any; from: (t: string) => any };

async function org(db: Db): Promise<string> {
  const { data, error } = await db.rpc("bootstrap_workspace");
  if (error) throw new Error(error.message);
  return data as string;
}

export const getDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    const orgId = await org(db);
    const { data, error } = await db
      .from("docs")
      .select("id,parent_id,source_id,title,content,icon,updated_at")
      .eq("org_id", orgId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return (data ?? []) as Doc[];
  });

export const createDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ parent_id: z.string().uuid().nullable().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const orgId = await org(db);
    const { data: row, error } = await db
      .from("docs")
      .insert({ org_id: orgId, parent_id: data.parent_id ?? null, title: "Untitled", created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string };
  });

/** Save a doc and keep its company-memory source and embeddings in sync. */
export const saveDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ id: z.string().uuid(), title: z.string().min(1).max(200), content: z.string().max(100000) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const orgId = await org(db);
    const { data: doc, error } = await db
      .from("docs")
      .update({ title: data.title, content: data.content })
      .eq("id", data.id)
      .eq("org_id", orgId)
      .select("id,source_id")
      .single();
    if (error) throw new Error(error.message);

    const text = data.content.trim();
    let sourceId = (doc as { source_id: string | null }).source_id;

    // A never-indexed empty document has no memory source to synchronize.
    if (!text && !sourceId) return { indexed: 0, memory: "empty" as const };

    const fields = { title: data.title, content: text, channel: "doc", summary: "Wiki page" };
    if (sourceId) {
      const { error: sourceError } = await db
        .from("sources")
        .update(fields)
        .eq("id", sourceId)
        .eq("org_id", orgId);
      if (sourceError) throw new Error(sourceError.message);
    } else {
      const { data: src, error: sourceError } = await db
        .from("sources")
        .insert({ org_id: orgId, created_by: context.userId, ...fields })
        .select("id")
        .single();
      if (sourceError) throw new Error(sourceError.message);
      sourceId = (src as { id: string }).id;

      const { error: linkError } = await db
        .from("docs")
        .update({ source_id: sourceId })
        .eq("id", data.id)
        .eq("org_id", orgId);
      if (linkError) throw new Error(linkError.message);
    }

    try {
      const key = process.env["LOVABLE_API_KEY"];
      // Empty content needs no provider call; indexSource still removes stale chunks.
      if (text && !key) throw new Error("AI key missing");
      const { indexSource } = await import("./knowledge.server");
      const n = await indexSource(db, key ?? "", orgId, { id: sourceId!, title: data.title, content: text });
      return { indexed: n, memory: text ? ("ok" as const) : ("empty" as const) };
    } catch (e) {
      return { indexed: 0, memory: "pending" as const, reason: e instanceof Error ? e.message : String(e) };
    }
  });

export const deleteDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const orgId = await org(db);
    const { data: doc, error: lookupError } = await db
      .from("docs")
      .select("source_id")
      .eq("id", data.id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!doc) return { ok: true };

    const sid = (doc as { source_id: string | null }).source_id;
    if (sid) {
      const { error: chunksError } = await db
        .from("knowledge_chunks")
        .delete()
        .eq("source_id", sid)
        .eq("org_id", orgId);
      if (chunksError) throw new Error(chunksError.message);

      const { error: sourceError } = await db.from("sources").delete().eq("id", sid).eq("org_id", orgId);
      if (sourceError) throw new Error(sourceError.message);
    }

    const { error } = await db.from("docs").delete().eq("id", data.id).eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

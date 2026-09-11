import { chunkText, embedTexts, cosine } from "./ai-gateway.server";

type SupabaseLike = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => any;
};

const vec = (values: number[]) => JSON.stringify(values);

export type ChunkMatch = {
  id: string;
  source_id: string | null;
  commitment_id: string | null;
  heading: string | null;
  content: string;
  similarity: number;
};

/** Chunk a source document and store one embedding per chunk. */
export async function indexSource(
  supabase: SupabaseLike,
  key: string,
  orgId: string,
  source: { id: string; title: string; content: string },
): Promise<number> {
  const chunks = chunkText(source.content);
  if (chunks.length === 0) return 0;

  const inputs = chunks.map((c) => `${source.title}\n\n${c}`);
  const vectors = await embedTexts(key, inputs);

  await supabase.from("knowledge_chunks").delete().eq("source_id", source.id).eq("kind", "source");

  const rows = chunks.map((content, i) => ({
    org_id: orgId,
    kind: "source",
    source_id: source.id,
    chunk_index: i,
    heading: source.title.slice(0, 200),
    content,
    embedding: vec(vectors[i] ?? []),
  }));

  const { error } = await supabase.from("knowledge_chunks").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

/** Store one embedding per commitment so promises can be matched semantically. */
export async function indexCommitments(
  supabase: SupabaseLike,
  key: string,
  orgId: string,
  commitments: { id: string; text: string }[],
  precomputed?: number[][],
): Promise<number[][]> {
  if (commitments.length === 0) return [];
  const vectors = precomputed ?? (await embedTexts(key, commitments.map((c) => c.text)));
  const rows = commitments.map((c, i) => ({
    org_id: orgId,
    kind: "commitment",
    commitment_id: c.id,
    chunk_index: 0,
    heading: null,
    content: c.text,
    embedding: vec(vectors[i] ?? []),
  }));
  const { error } = await supabase.from("knowledge_chunks").insert(rows);
  if (error) throw new Error(error.message);
  return vectors;
}

export async function embedQuery(key: string, text: string): Promise<number[]> {
  const [v] = await embedTexts(key, [text]);
  return v ?? [];
}

export async function searchChunks(
  supabase: SupabaseLike,
  orgId: string,
  embedding: number[],
  kind: "source" | "commitment",
  count: number,
): Promise<ChunkMatch[]> {
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    v_org: orgId,
    query_embedding: vec(embedding),
    match_count: count,
    v_kind: kind,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChunkMatch[];
}

/** Find open commitments that already say the same thing as a candidate promise. */
export async function findDuplicateCommitment(
  supabase: SupabaseLike,
  orgId: string,
  embedding: number[],
  threshold = 0.9,
): Promise<ChunkMatch | null> {
  const matches = await searchChunks(supabase, orgId, embedding, "commitment", 3);
  const best = matches[0];
  return best && best.similarity >= threshold ? best : null;
}

export { cosine };

/** Embed anything in the workspace that has no vector yet. */
export async function reindexWorkspace(supabase: SupabaseLike, key: string, orgId: string) {
  const [{ data: sources }, { data: commitments }, { data: existing }] = await Promise.all([
    supabase.from("sources").select("id,title,content").eq("org_id", orgId),
    supabase.from("commitments").select("id,promise,owner_name,counterparty,quote").eq("org_id", orgId),
    supabase.from("knowledge_chunks").select("source_id,commitment_id").eq("org_id", orgId),
  ]);

  const indexedSources = new Set(
    ((existing ?? []) as { source_id: string | null }[]).map((r) => r.source_id).filter(Boolean) as string[],
  );
  const indexedCommitments = new Set(
    ((existing ?? []) as { commitment_id: string | null }[]).map((r) => r.commitment_id).filter(Boolean) as string[],
  );

  let chunks = 0;
  for (const s of ((sources ?? []) as { id: string; title: string; content: string }[])) {
    if (indexedSources.has(s.id)) continue;
    chunks += await indexSource(supabase, key, orgId, s);
  }

  const pending = ((commitments ?? []) as {
    id: string;
    promise: string;
    owner_name: string;
    counterparty: string | null;
    quote: string | null;
  }[])
    .filter((c) => !indexedCommitments.has(c.id))
    .map((c) => ({
      id: c.id,
      text: `${c.owner_name} promised ${c.counterparty ?? "the team"}: ${c.promise}. ${c.quote ?? ""}`.trim(),
    }));

  for (let i = 0; i < pending.length; i += 40) {
    await indexCommitments(supabase, key, orgId, pending.slice(i, i + 40));
  }

  return { chunks, commitments: pending.length };
}

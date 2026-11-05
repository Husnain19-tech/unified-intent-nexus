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

type KnowledgeSource = { id: string; title: string; content: string };
type KnowledgeCommitment = {
  id: string;
  promise: string;
  owner_name: string;
  counterparty: string | null;
  quote: string | null;
};
type ExistingChunk = {
  kind: string;
  source_id: string | null;
  commitment_id: string | null;
  chunk_index: number;
};

/**
 * Return sources and commitments whose indexes are missing or incomplete.
 * A source is complete only when every expected chunk index exists exactly once.
 * A commitment is complete only when it has exactly one commitment chunk.
 */
export function findIncompleteKnowledgeItems(
  sources: KnowledgeSource[],
  commitments: KnowledgeCommitment[],
  existing: ExistingChunk[],
): { sources: KnowledgeSource[]; commitments: KnowledgeCommitment[] } {
  const sourceIndexes = new Map<string, number[]>();
  const commitmentCounts = new Map<string, number>();

  for (const chunk of existing) {
    if (chunk.kind === "source" && chunk.source_id) {
      const indexes = sourceIndexes.get(chunk.source_id) ?? [];
      indexes.push(chunk.chunk_index);
      sourceIndexes.set(chunk.source_id, indexes);
    }
    if (chunk.kind === "commitment" && chunk.commitment_id) {
      commitmentCounts.set(chunk.commitment_id, (commitmentCounts.get(chunk.commitment_id) ?? 0) + 1);
    }
  }

  const incompleteSources = sources.filter((source) => {
    const expectedCount = chunkText(source.content).length;
    const indexes = sourceIndexes.get(source.id) ?? [];
    if (expectedCount === 0) return indexes.length > 0;
    if (indexes.length !== expectedCount) return true;
    const actual = new Set(indexes);
    return actual.size !== expectedCount || Array.from({ length: expectedCount }, (_, index) => index).some((i) => !actual.has(i));
  });

  const incompleteCommitments = commitments.filter((commitment) => commitmentCounts.get(commitment.id) !== 1);
  return { sources: incompleteSources, commitments: incompleteCommitments };
}

/** Chunk a source document and store one embedding per chunk. */
export async function indexSource(
  supabase: SupabaseLike,
  key: string,
  orgId: string,
  source: KnowledgeSource,
): Promise<number> {
  const chunks = chunkText(source.content);
  const removePrevious = async () => {
    const { error } = await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("source_id", source.id)
      .eq("org_id", orgId)
      .eq("kind", "source");
    if (error) throw new Error(error.message);
  };

  if (chunks.length === 0) {
    await removePrevious();
    return 0;
  }

  // Generate all embeddings before replacing the current index so provider failures
  // never erase a previously usable index.
  const inputs = chunks.map((c) => `${source.title}\n\n${c}`);
  const vectors = await embedTexts(key, inputs);
  await removePrevious();

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

  // Re-indexing must replace existing vectors rather than append duplicates.
  const { error: deleteError } = await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("org_id", orgId)
    .eq("kind", "commitment")
    .in("commitment_id", commitments.map((c) => c.id));
  if (deleteError) throw new Error(deleteError.message);

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

/** Repair missing, partial, and duplicate workspace embeddings. */
export async function reindexWorkspace(supabase: SupabaseLike, key: string, orgId: string) {
  const [{ data: sources, error: sourcesError }, { data: commitments, error: commitmentsError }, { data: existing, error: existingError }] =
    await Promise.all([
      supabase.from("sources").select("id,title,content").eq("org_id", orgId),
      supabase.from("commitments").select("id,promise,owner_name,counterparty,quote").eq("org_id", orgId),
      supabase.from("knowledge_chunks").select("kind,source_id,commitment_id,chunk_index").eq("org_id", orgId),
    ]);

  for (const error of [sourcesError, commitmentsError, existingError]) {
    if (error) throw new Error(error.message);
  }

  const sourceRows = (sources ?? []) as KnowledgeSource[];
  const commitmentRows = (commitments ?? []) as KnowledgeCommitment[];
  const existingRows = (existing ?? []) as ExistingChunk[];
  const pending = findIncompleteKnowledgeItems(sourceRows, commitmentRows, existingRows);

  let chunks = 0;
  for (const source of pending.sources) {
    chunks += await indexSource(supabase, key, orgId, source);
  }

  const pendingCommitments = pending.commitments.map((commitment) => ({
    id: commitment.id,
    text: `${commitment.owner_name} promised ${commitment.counterparty ?? "the team"}: ${commitment.promise}. ${commitment.quote ?? ""}`.trim(),
  }));

  for (let i = 0; i < pendingCommitments.length; i += 40) {
    await indexCommitments(supabase, key, orgId, pendingCommitments.slice(i, i + 40));
  }

  return { chunks, commitments: pendingCommitments.length };
}

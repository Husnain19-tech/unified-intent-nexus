import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

/** Reasoning provider (OpenAI Responses API) used by the language-understanding features. */
export function createLovableResponsesProvider(apiKey: string) {
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

export const OMNIFLOW_REASONING_MODEL = "openai/gpt-6-astra";
export const REASONING_OPTIONS = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
} as const;

export const OMNIFLOW_MODEL = "google/gemini-3.7-flash";
export const OMNIFLOW_EMBEDDING_MODEL = "google/gemini-embedding-2";

/** Split long text into overlapping, sentence-aware chunks for embedding. */
export function chunkText(text: string, target = 1100, overlap = 180): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= target) return clean ? [clean] : [];

  const sentences = clean.split(/(?<=[.!?\n])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length > target && current) {
      chunks.push(current.trim());
      current = current.slice(Math.max(0, current.length - overlap));
    }
    current = (current ? current + " " : "") + sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 0);
}

/** Embed a batch of texts with the Lovable AI Gateway (max 100 inputs per request). */
export async function embedTexts(apiKey: string, inputs: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += 50) {
    const batch = inputs.slice(i, i + 50);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({ model: OMNIFLOW_EMBEDDING_MODEL, input: batch }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 402) throw new Error("The workspace is out of AI credits. Add credits to keep indexing.");
      if (res.status === 429) throw new Error("The AI service is busy right now. Try again in a moment.");
      throw new Error(`Could not build the semantic index (${res.status}). ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) out.push(item.embedding);
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useWorkspace } from "@/lib/use-workspace";
import { askKnowledge } from "@/lib/omniflow.functions";
import { Shell, PageHead } from "@/components/omniflow/shell";
import { toast } from "sonner";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge Mesh — OmniFlow" },
      {
        name: "description",
        content: "A searchable memory of every message, call and decision, with an AI that answers why things were decided.",
      },
      { property: "og:title", content: "Knowledge Mesh — OmniFlow" },
      { property: "og:description", content: "Ask your organization's own memory why a decision was made." },
    ],
  }),
  component: KnowledgePage,
});

function KnowledgePage() {
  const { data, isLoading } = useWorkspace();
  const [question, setQuestion] = useState("");
  const [search, setSearch] = useState("");
  const askFn = useServerFn(askKnowledge);

  const ask = useMutation({
    mutationFn: () => askFn({ data: { question: question.trim() } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const sources = (data?.sources ?? []).filter((s) =>
    search.trim() ? (s.title + s.content).toLowerCase().includes(search.toLowerCase()) : true,
  );
  const commitments = data?.commitments ?? [];

  return (
    <Shell org={data?.orgName}>
      <PageHead
        title="Knowledge Mesh"
        subtitle="Everything your organization has recorded, in order, with the promises and decisions pulled out of it."
      />

      <div className="panel mb-6 p-5">
        <h2 className="text-lg font-semibold">Ask the organizational memory</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Answers come only from your own notes — for example: “Why did we choose the managed queue?”
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && question.trim().length > 3) ask.mutate();
            }}
            placeholder="Why was that decided?"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <button
            onClick={() => ask.mutate()}
            disabled={ask.isPending || question.trim().length < 4}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            {ask.isPending ? "Searching…" : "Ask"}
          </button>
        </div>
        {ask.data && (
          <div className="mt-4 rounded-md border border-border bg-background/50 p-4 text-sm leading-relaxed">
            {ask.data.answer}
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter the timeline"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading memory…</div>
      ) : (
        <div className="relative space-y-4 border-l border-border pl-6">
          {sources.length === 0 && (
            <div className="panel p-8 text-center text-sm text-muted-foreground">Nothing recorded yet.</div>
          )}
          {sources.map((s) => {
            const linked = commitments.filter((c) => c.source_id === s.id);
            return (
              <div key={s.id} className="relative">
                <span className="absolute -left-[31px] top-4 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="panel p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                    <span className="rounded bg-secondary px-2 py-0.5">{s.channel}</span>
                    <span className="num">{new Date(s.created_at).toLocaleString()}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                  {s.summary && <p className="mt-1 text-sm text-primary/90">{s.summary}</p>}
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{s.content}</p>
                  {linked.length > 0 && (
                    <div className="mt-4 border-t border-border pt-3">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">
                        {linked.length} commitment{linked.length === 1 ? "" : "s"} extracted
                      </div>
                      <ul className="mt-2 space-y-1">
                        {linked.map((c) => (
                          <li key={c.id} className="text-sm">
                            <span className="text-foreground">{c.owner_name}</span>{" "}
                            <span className="text-muted-foreground">— {c.promise}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

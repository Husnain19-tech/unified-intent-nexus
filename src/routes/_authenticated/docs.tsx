import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FilePlus, FileText, Trash2 } from "lucide-react";
import { Shell, PageHead } from "@/components/omniflow/shell";
import { useWorkspace } from "@/lib/use-workspace";
import { createDoc, deleteDoc, getDocs, saveDoc, type Doc } from "@/lib/docs.functions";

export const Route = createFileRoute("/_authenticated/docs")({
  head: () => ({
    meta: [
      { title: "Docs & Wiki — OmniFlow" },
      { name: "description", content: "Write team docs and wiki pages that feed the company memory automatically." },
      { property: "og:title", content: "Docs & Wiki — OmniFlow" },
      { property: "og:description", content: "Team docs that the AI remembers and cites." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const getFn = useServerFn(getDocs);
  const createFn = useServerFn(createDoc);
  const saveFn = useServerFn(saveDoc);
  const deleteFn = useServerFn(deleteDoc);
  const { data: docs = [], isLoading } = useQuery({ queryKey: ["docs"], queryFn: () => getFn() });
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = docs.find((d) => d.id === activeId) ?? null;
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!activeId && docs[0]) setActiveId(docs[0].id);
  }, [docs, activeId]);
  useEffect(() => {
    setTitle(active?.title ?? "");
    setContent(active?.content ?? "");
  }, [active?.id]);

  const tree = useMemo(() => {
    const kids = new Map<string | null, Doc[]>();
    for (const d of docs) kids.set(d.parent_id, [...(kids.get(d.parent_id) ?? []), d]);
    return kids;
  }, [docs]);

  const create = useMutation({
    mutationFn: (parent_id: string | null) => createFn({ data: { parent_id } }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["docs"] });
      setActiveId(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const save = useMutation({
    mutationFn: () => saveFn({ data: { id: activeId!, title: title.trim() || "Untitled", content } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["docs"] });
      qc.invalidateQueries({ queryKey: ["workspace"] });
      if (r.memory === "ok") toast.success(`Saved and added to company memory (${r.indexed} passages)`);
      else if (r.memory === "pending")
        toast.warning("Saved. It couldn't be added to memory yet — press Re-index memory on Knowledge Mesh later.");
      else toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      setActiveId(null);
      qc.invalidateQueries({ queryKey: ["docs"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty = !!active && (title !== active.title || content !== active.content);

  function renderTree(parent: string | null, depth: number) {
    return (tree.get(parent) ?? []).map((d) => (
      <div key={d.id}>
        <button
          onClick={() => setActiveId(d.id)}
          style={{ paddingLeft: 8 + depth * 14 }}
          className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm ${
            d.id === activeId ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60"
          }`}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{d.title}</span>
          {d.source_id && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" title="In memory" />}
        </button>
        {renderTree(d.id, depth + 1)}
      </div>
    ));
  }

  return (
    <Shell org={ws?.orgName}>
      <PageHead
        title="Docs & Wiki"
        subtitle="Write processes, decisions and onboarding pages. Every saved page joins the company memory, so Knowledge Mesh and the AI agents can cite it."
        action={
          <button
            onClick={() => create.mutate(null)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <FilePlus className="h-4 w-4" /> New page
          </button>
        }
      />
      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <div className="panel p-2">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading…</div>
          ) : docs.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No pages yet.</div>
          ) : (
            renderTree(null, 0)
          )}
        </div>
        <div className="panel p-5">
          {!active ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Create a page to start writing.</div>
          ) : (
            <>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Page title"
                className="w-full bg-transparent text-2xl font-bold outline-none"
              />
              <div className="mt-1 text-xs text-muted-foreground">
                {active.source_id ? "In company memory" : "Not in memory yet"} · edited{" "}
                {new Date(active.updated_at).toLocaleString()}
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write here… e.g. how we onboard a new client, why we chose a vendor."
                className="mt-4 min-h-[420px] w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-relaxed outline-none focus:border-ring"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => save.mutate()}
                  disabled={save.isPending || !dirty}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                >
                  {save.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => create.mutate(active.id)}
                  className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Add sub-page
                </button>
                <button
                  onClick={() => confirm("Delete this page?") && remove.mutate(active.id)}
                  className="ml-auto flex items-center gap-1 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

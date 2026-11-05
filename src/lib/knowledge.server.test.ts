import { describe, expect, it } from "bun:test";
import { findIncompleteKnowledgeItems } from "./knowledge.server";

const source = {
  id: "source-1",
  title: "Long source",
  content: `${"a".repeat(1101)}. ${"b".repeat(100)}`,
};
const commitment = {
  id: "commitment-1",
  promise: "Send the report",
  owner_name: "A",
  counterparty: "B",
  quote: null,
};

describe("findIncompleteKnowledgeItems", () => {
  it("reindexes a source when only some expected chunks exist", () => {
    const result = findIncompleteKnowledgeItems(
      [source],
      [],
      [{ kind: "source", source_id: source.id, commitment_id: null, chunk_index: 0 }],
    );

    expect(result.sources.map((item) => item.id)).toEqual([source.id]);
  });

  it("does not reindex a source when every expected chunk exists", () => {
    const result = findIncompleteKnowledgeItems(
      [source],
      [],
      [
        { kind: "source", source_id: source.id, commitment_id: null, chunk_index: 0 },
        { kind: "source", source_id: source.id, commitment_id: null, chunk_index: 1 },
      ],
    );

    expect(result.sources).toEqual([]);
  });

  it("repairs duplicate or missing chunk indexes", () => {
    const duplicate = findIncompleteKnowledgeItems(
      [source],
      [],
      [
        { kind: "source", source_id: source.id, commitment_id: null, chunk_index: 0 },
        { kind: "source", source_id: source.id, commitment_id: null, chunk_index: 0 },
      ],
    );
    const missing = findIncompleteKnowledgeItems([source], [], []);

    expect(duplicate.sources.map((item) => item.id)).toEqual([source.id]);
    expect(missing.sources.map((item) => item.id)).toEqual([source.id]);
  });

  it("removes stale chunks for sources whose content is now empty", () => {
    const emptySource = { ...source, content: "  " };
    const result = findIncompleteKnowledgeItems(
      [emptySource],
      [],
      [{ kind: "source", source_id: source.id, commitment_id: null, chunk_index: 0 }],
    );

    expect(result.sources.map((item) => item.id)).toEqual([source.id]);
  });

  it("repairs missing and duplicate commitment vectors", () => {
    const missing = findIncompleteKnowledgeItems([], [commitment], []);
    const duplicate = findIncompleteKnowledgeItems(
      [],
      [commitment],
      [
        { kind: "commitment", source_id: null, commitment_id: commitment.id, chunk_index: 0 },
        { kind: "commitment", source_id: null, commitment_id: commitment.id, chunk_index: 0 },
      ],
    );

    expect(missing.commitments.map((item) => item.id)).toEqual([commitment.id]);
    expect(duplicate.commitments.map((item) => item.id)).toEqual([commitment.id]);
  });

  it("keeps a commitment with exactly one vector indexed", () => {
    const result = findIncompleteKnowledgeItems(
      [],
      [commitment],
      [{ kind: "commitment", source_id: null, commitment_id: commitment.id, chunk_index: 0 }],
    );

    expect(result.commitments).toEqual([]);
  });
});

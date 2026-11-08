import { describe, expect, it } from "bun:test";
import { runAgents } from "./agents.server";

function createDb(options: {
  settings?: { paused?: boolean; pause_reason?: string | null } | null;
  settingsError?: { message: string } | null;
  lease?: boolean;
  leaseError?: { message: string } | null;
}) {
  const calls: string[] = [];
  const settingsQuery = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() {
      return { data: options.settings ?? null, error: options.settingsError ?? null };
    },
  };
  return {
    calls,
    db: {
      from(table: string) {
        calls.push(`from:${table}`);
        return settingsQuery;
      },
      async rpc(name: string) {
        calls.push(`rpc:${name}`);
        return { data: options.lease ?? false, error: options.leaseError ?? null };
      },
    },
  };
}

describe("runAgents safety guards", () => {
  it("fails closed when the pause state cannot be read", async () => {
    const { db, calls } = createDb({ settingsError: { message: "database unavailable" } });
    let thrown: unknown;
    try {
      await runAgents(db as never, "org-1", "key", "schedule");
    } catch (error) {
      thrown = error;
    }
    expect(thrown instanceof Error ? thrown.message : "").toBe(
      "Unable to verify agent pause state: database unavailable",
    );
    expect(calls).toEqual(["from:agent_settings"]);
  });

  it("does not acquire a lease or run agents when paused", async () => {
    const { db, calls } = createDb({ settings: { paused: true, pause_reason: "Paused by operator" } });
    const result = await runAgents(db as never, "org-1", "key", "schedule");
    expect(result).toEqual({ status: "paused", reason: "Paused by operator", decisions: 0 });
    expect(calls).toEqual(["from:agent_settings"]);
  });

  it("surfaces lease acquisition errors before creating a run", async () => {
    const { db, calls } = createDb({ settings: { paused: false }, leaseError: { message: "lease rpc failed" } });
    let thrown: unknown;
    try {
      await runAgents(db as never, "org-1", "key", "schedule");
    } catch (error) {
      thrown = error;
    }
    expect(thrown instanceof Error ? thrown.message : "").toBe("lease rpc failed");
    expect(calls).toEqual(["from:agent_settings", "rpc:acquire_agent_lease"]);
  });

  it("returns busy without creating a run when another invocation owns the lease", async () => {
    const { db, calls } = createDb({ settings: { paused: false }, lease: false });
    const result = await runAgents(db as never, "org-1", "key", "schedule");
    expect(result).toEqual({ status: "busy", reason: "Agents are already running.", decisions: 0 });
    expect(calls).toEqual(["from:agent_settings", "rpc:acquire_agent_lease"]);
  });
});

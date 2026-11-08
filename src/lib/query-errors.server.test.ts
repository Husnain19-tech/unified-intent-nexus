import { describe, expect, it } from "bun:test";
import { assertQuerySuccess } from "./query-errors.server";

describe("assertQuerySuccess", () => {
  it("allows successful required reads", () => {
    expect(() => assertQuerySuccess(
      { label: "tasks", error: null },
      { label: "people", error: null },
    )).not.toThrow();
  });

  it("surfaces the first failed required read with its context", () => {
    expect(() => assertQuerySuccess(
      { label: "tasks", error: null },
      { label: "people", error: { message: "permission denied" } },
      { label: "projects", error: { message: "connection lost" } },
    )).toThrow("people: permission denied");
  });
});

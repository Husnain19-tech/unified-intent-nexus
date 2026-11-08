import { describe, expect, it } from "bun:test";
import { assertQuerySuccess } from "./query-errors.server";

describe("assertQuerySuccess", () => {
  it("allows successful required reads", () => {
    assertQuerySuccess(
      { label: "tasks", error: null },
      { label: "people", error: null },
    );
    expect(true).toBe(true);
  });

  it("surfaces the first failed required read with its context", () => {
    let message = "";
    try {
      assertQuerySuccess(
        { label: "tasks", error: null },
        { label: "people", error: { message: "permission denied" } },
        { label: "projects", error: { message: "connection lost" } },
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe("people: permission denied");
  });
});

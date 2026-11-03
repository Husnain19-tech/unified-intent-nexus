import { describe, expect, it } from "bun:test";
import { getHttpStatus } from "./ai-errors.server";

describe("getHttpStatus", () => {
  it("reads a direct HTTP status", () => {
    expect(getHttpStatus({ status: 402 })).toBe(402);
  });

  it("reads statusCode from a nested provider cause", () => {
    expect(getHttpStatus({ name: "NoOutputGeneratedError", cause: { statusCode: 403 } })).toBe(403);
  });

  it("reads a nested response status", () => {
    expect(getHttpStatus({ cause: { response: { status: 429 } } })).toBe(429);
  });

  it("searches aggregate errors", () => {
    expect(getHttpStatus({ errors: [{ message: "parse failed" }, { statusCode: 503 }] })).toBe(503);
  });

  it("handles cyclic causes without looping", () => {
    const error: { cause?: unknown; status?: number } = {};
    error.cause = error;
    expect(getHttpStatus(error)).toBeUndefined();
  });

  it("ignores invalid status values", () => {
    expect(getHttpStatus({ status: "402", cause: { statusCode: 99 } })).toBeUndefined();
  });

  it("handles primitive and null values", () => {
    expect(getHttpStatus(null)).toBeUndefined();
    expect(getHttpStatus("provider failed")).toBeUndefined();
  });
});

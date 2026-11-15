import { describe, expect, it } from "bun:test";
import { resolveOmniFlowAiProviderConfig } from "./ai-gateway.server";

function thrownMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

describe("resolveOmniFlowAiProviderConfig", () => {
  it("defaults to the existing Lovable provider", () => {
    expect(resolveOmniFlowAiProviderConfig({})).toEqual({ provider: "lovable" });
    expect(resolveOmniFlowAiProviderConfig({ AZURE_FOUNDRY_API_KEY: "unused" })).toEqual({ provider: "lovable" });
  });

  it("accepts a complete HTTPS Foundry OpenAI-compatible configuration", () => {
    expect(
      resolveOmniFlowAiProviderConfig({
        OMNIFLOW_AI_PROVIDER: "azure-foundry",
        AZURE_FOUNDRY_ENDPOINT: "https://sample.services.ai.azure.com/openai/v1/",
        AZURE_FOUNDRY_API_KEY: "test-only",
        AZURE_FOUNDRY_MODEL: "test-deployment",
      }),
    ).toEqual({
      provider: "azure-foundry",
      endpoint: "https://sample.services.ai.azure.com/openai/v1",
      apiKey: "test-only",
      model: "test-deployment",
    });
  });

  it("fails closed when Azure is selected but configuration is incomplete", () => {
    expect(thrownMessage(() => resolveOmniFlowAiProviderConfig({ OMNIFLOW_AI_PROVIDER: "azure-foundry" }))).toBe(
      "Azure Foundry requires AZURE_FOUNDRY_ENDPOINT, AZURE_FOUNDRY_API_KEY, and AZURE_FOUNDRY_MODEL.",
    );
  });

  it("rejects non-HTTPS and non-OpenAI-compatible endpoints", () => {
    const base = {
      OMNIFLOW_AI_PROVIDER: "azure-foundry",
      AZURE_FOUNDRY_API_KEY: "test-only",
      AZURE_FOUNDRY_MODEL: "test-deployment",
    };
    expect(
      thrownMessage(() =>
        resolveOmniFlowAiProviderConfig({ ...base, AZURE_FOUNDRY_ENDPOINT: "http://sample.services.ai.azure.com/openai/v1" }),
      ),
    ).toBe(thrownMessage(() => resolveOmniFlowAiProviderConfig({ ...base, AZURE_FOUNDRY_ENDPOINT: "http://sample.services.ai.azure.com/openai/v1" })).includes("HTTPS"));
    expect(
      thrownMessage(() =>
        resolveOmniFlowAiProviderConfig({ ...base, AZURE_FOUNDRY_ENDPOINT: "https://sample.services.ai.azure.com/models" }),
      ),
    ).toBe(thrownMessage(() => resolveOmniFlowAiProviderConfig({ ...base, AZURE_FOUNDRY_ENDPOINT: "https://sample.services.ai.azure.com/models" })).includes("/openai/v1"));
  });

  it("rejects unknown provider names", () => {
    expect(thrownMessage(() => resolveOmniFlowAiProviderConfig({ OMNIFLOW_AI_PROVIDER: "unknown" }))).toBe(thrownMessage(() => resolveOmniFlowAiProviderConfig({ OMNIFLOW_AI_PROVIDER: "unknown" })).includes("must be"));
  });
});

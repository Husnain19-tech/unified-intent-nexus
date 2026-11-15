import { describe, expect, test } from "bun:test";
import { resolveOmniFlowAiProviderConfig } from "./ai-gateway.server";

describe("resolveOmniFlowAiProviderConfig", () => {
  test("defaults to the existing Lovable provider", () => {
    expect(resolveOmniFlowAiProviderConfig({})).toEqual({ provider: "lovable" });
    expect(resolveOmniFlowAiProviderConfig({ AZURE_FOUNDRY_API_KEY: "unused" })).toEqual({ provider: "lovable" });
  });

  test("accepts a complete HTTPS Foundry OpenAI-compatible configuration", () => {
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

  test("fails closed when Azure is selected but configuration is incomplete", () => {
    expect(() =>
      resolveOmniFlowAiProviderConfig({ OMNIFLOW_AI_PROVIDER: "azure-foundry" }),
    ).toThrow("Azure Foundry requires");
  });

  test("rejects non-HTTPS and non-OpenAI-compatible endpoints", () => {
    const base = {
      OMNIFLOW_AI_PROVIDER: "azure-foundry",
      AZURE_FOUNDRY_API_KEY: "test-only",
      AZURE_FOUNDRY_MODEL: "test-deployment",
    };
    expect(() =>
      resolveOmniFlowAiProviderConfig({ ...base, AZURE_FOUNDRY_ENDPOINT: "http://sample.services.ai.azure.com/openai/v1" }),
    ).toThrow("HTTPS");
    expect(() =>
      resolveOmniFlowAiProviderConfig({ ...base, AZURE_FOUNDRY_ENDPOINT: "https://sample.services.ai.azure.com/models" }),
    ).toThrow("/openai/v1");
  });

  test("rejects unknown provider names", () => {
    expect(() => resolveOmniFlowAiProviderConfig({ OMNIFLOW_AI_PROVIDER: "unknown" })).toThrow("must be");
  });
});

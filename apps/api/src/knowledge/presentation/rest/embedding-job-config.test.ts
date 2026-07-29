import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { resolveKnowledgeEmbeddingJobConfig } from "./embedding-job-config.js";

const activeConfig = {
  provider: "gemini" as const,
  model: "gemini-embedding-001",
  dimensions: 768
};

describe("resolveKnowledgeEmbeddingJobConfig", () => {
  it("uses the active server embedding config when the request omits provider details", () => {
    expect(resolveKnowledgeEmbeddingJobConfig({ limit: 100, refreshExisting: true }, activeConfig)).toEqual(activeConfig);
  });

  it("keeps an explicit embedding config when all provider details are present", () => {
    expect(
      resolveKnowledgeEmbeddingJobConfig(
        {
          provider: "openai",
          model: "text-embedding-3-small",
          dimensions: 1536,
          refreshExisting: true
        },
        activeConfig
      )
    ).toEqual({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 1536
    });
  });

  it("rejects partial embedding configs instead of silently mixing defaults", () => {
    expect(() =>
      resolveKnowledgeEmbeddingJobConfig(
        {
          provider: "gemini",
          refreshExisting: true
        },
        activeConfig
      )
    ).toThrow(BadRequestException);
  });
});

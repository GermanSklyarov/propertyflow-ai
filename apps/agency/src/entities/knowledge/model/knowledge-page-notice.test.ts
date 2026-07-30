import { describe, expect, it } from "vitest";
import { buildKnowledgePageNotice } from "./knowledge-page-notice";

describe("buildKnowledgePageNotice", () => {
  it("announces automatic indexing after source creation", () => {
    expect(buildKnowledgePageNotice({ created: "Buying guide", ingest: "queued" })).toEqual({
      message: "Buying guide was added. AI is indexing this source now, and worker progress appears below.",
      tone: "success"
    });
  });

  it("announces manual re-ingestion", () => {
    expect(buildKnowledgePageNotice({ document: "Visa FAQ", ingest: "queued" })).toEqual({
      message: "Visa FAQ was queued for re-ingestion. Worker progress appears below.",
      tone: "success"
    });
  });

  it("announces embedding jobs", () => {
    expect(buildKnowledgePageNotice({ embed: "queued" })).toEqual({
      message: "Knowledge chunk embedding was queued for the current tenant.",
      tone: "success"
    });
  });

  it("announces REST listing source sync jobs", () => {
    expect(buildKnowledgePageNotice({ listingSync: "queued", source: "Partner API" })).toEqual({
      message: "Partner API sync was queued. Worker progress appears below.",
      tone: "success"
    });
  });

  it("announces REST listing source setup errors", () => {
    expect(buildKnowledgePageNotice({ error: "Canonical mapping contains invalid JSON.", listingSync: "invalid" })).toEqual({
      message: "Canonical mapping contains invalid JSON.",
      tone: "warning"
    });
  });

  it("stays empty without a supported status", () => {
    expect(buildKnowledgePageNotice({})).toBeUndefined();
  });
});

import type { BackgroundJobMonitorItem } from "@propertyflow/contracts";
import { describe, expect, it } from "vitest";
import { countRunningKnowledgeJobs, hasRunningKnowledgeJobs, isRunningBackgroundJob } from "./background-jobs";

describe("background job model", () => {
  it("treats queued and active worker states as running", () => {
    expect(isRunningBackgroundJob(job({ state: "waiting" }))).toBe(true);
    expect(isRunningBackgroundJob(job({ state: "active" }))).toBe(true);
    expect(isRunningBackgroundJob(job({ state: "delayed" }))).toBe(true);
    expect(isRunningBackgroundJob(job({ state: "waiting-children" }))).toBe(true);
  });

  it("does not poll for terminal jobs", () => {
    expect(isRunningBackgroundJob(job({ state: "completed" }))).toBe(false);
    expect(isRunningBackgroundJob(job({ state: "failed" }))).toBe(false);
  });

  it("detects running knowledge jobs only", () => {
    expect(hasRunningKnowledgeJobs([job({ name: "knowledge.documents.ingest", state: "waiting" })])).toBe(true);
    expect(hasRunningKnowledgeJobs([job({ name: "properties.import", state: "waiting" })])).toBe(false);
  });

  it("counts running knowledge jobs for Starter launch gates", () => {
    expect(
      countRunningKnowledgeJobs([
        job({ id: "job-1", name: "knowledge.documents.ingest", state: "waiting" }),
        job({ id: "job-2", name: "knowledge.chunks.embed", state: "active" }),
        job({ id: "job-3", name: "knowledge.chunks.embed", state: "completed" }),
        job({ id: "job-4", name: "properties.import", state: "active" })
      ])
    ).toBe(2);
  });
});

function job(overrides: Partial<BackgroundJobMonitorItem> = {}): BackgroundJobMonitorItem {
  return {
    attemptsMade: 0,
    id: "job-1",
    name: "knowledge.documents.ingest",
    payload: { documentId: "10000000-0000-4000-8000-000000000001", reason: "manual", tenantId: "demo-tenant" },
    progress: 0,
    queue: "propertyflow.jobs",
    state: "waiting",
    tenantId: "demo-tenant",
    ...overrides
  };
}

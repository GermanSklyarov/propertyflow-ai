import type { BackgroundJobMonitorItem } from "@propertyflow/contracts";

const runningStates = new Set<BackgroundJobMonitorItem["state"]>(["active", "waiting", "delayed", "waiting-children"]);

export function isRunningBackgroundJob(job: BackgroundJobMonitorItem) {
  return runningStates.has(job.state);
}

export function hasRunningKnowledgeJobs(jobs: BackgroundJobMonitorItem[]) {
  return jobs.some((job) => isKnowledgeJob(job) && isRunningBackgroundJob(job));
}

export function countRunningKnowledgeJobs(jobs: BackgroundJobMonitorItem[]) {
  return jobs.filter((job) => isKnowledgeJob(job) && isRunningBackgroundJob(job)).length;
}

export function isKnowledgeJob(job: BackgroundJobMonitorItem) {
  return job.name === "knowledge.documents.ingest" || job.name === "knowledge.chunks.embed";
}

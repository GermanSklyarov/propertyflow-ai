"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DatabaseZap } from "lucide-react";
import { hasRunningKnowledgeJobs } from "@entities/jobs/model/background-jobs";
import { BackgroundJobCard } from "@entities/jobs/ui/background-job-card";
import type { BackgroundJobMonitorItem } from "@propertyflow/contracts";
import styles from "./knowledge-jobs-panel.module.css";

export function KnowledgeJobsPanel({ jobs }: { jobs: BackgroundJobMonitorItem[] }) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const hasRunningJobs = hasRunningKnowledgeJobs(jobs);

  useEffect(() => {
    if (!hasRunningJobs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      startRefresh(() => router.refresh());
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [hasRunningJobs, router]);

  if (!jobs.length) {
    return (
      <div className={styles.emptyState}>
        <DatabaseZap size={24} />
        <strong>No knowledge jobs yet</strong>
        <p>Create a document, re-ingest a source, or queue embeddings to see worker activity here.</p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.syncStatus} data-active={hasRunningJobs || isRefreshing}>
        <DatabaseZap size={16} />
        <strong>{hasRunningJobs ? "AI is indexing knowledge" : "Knowledge workers are settled"}</strong>
        <span>{hasRunningJobs ? "Refreshing worker status every 2.5 seconds." : "No active indexing jobs are blocking widget setup."}</span>
      </div>

      <div className={styles.list}>
        {jobs.map((job) => (
          <BackgroundJobCard job={job} key={job.id} />
        ))}
      </div>
    </>
  );
}

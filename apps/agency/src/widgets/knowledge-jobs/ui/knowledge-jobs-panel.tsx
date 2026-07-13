import { DatabaseZap } from "lucide-react";
import { BackgroundJobCard } from "@entities/jobs/ui/background-job-card";
import type { BackgroundJobMonitorItem } from "@propertyflow/contracts";
import styles from "./knowledge-jobs-panel.module.css";

export function KnowledgeJobsPanel({ jobs }: { jobs: BackgroundJobMonitorItem[] }) {
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
    <div className={styles.list}>
      {jobs.map((job) => (
        <BackgroundJobCard job={job} key={job.id} />
      ))}
    </div>
  );
}

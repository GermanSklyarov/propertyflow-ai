import type { BackgroundJobMonitorItem } from "@propertyflow/contracts";
import { formatBucket } from "@shared/lib/formatters";
import styles from "./background-job-card.module.css";

export function BackgroundJobCard({ job }: { job: BackgroundJobMonitorItem }) {
  return (
    <article className={styles.card}>
      <div>
        <strong>{formatJobName(job.name)}</strong>
        <span>{formatJobPayload(job)}</span>
      </div>
      <span className={styles.state}>{formatBucket(job.state)}</span>
      <small>{formatJobTime(job)}</small>
      <small>{job.attemptsMade ? `${job.attemptsMade} attempts` : "first attempt"}</small>
    </article>
  );
}

function formatJobName(name: BackgroundJobMonitorItem["name"]) {
  return name
    .split(".")
    .map((part) => formatBucket(part))
    .join(" / ");
}

function formatJobPayload(job: BackgroundJobMonitorItem) {
  const payload = job.payload;

  if ("documentId" in payload && payload.documentId) {
    return `document ${payload.documentId.slice(0, 8)}`;
  }

  if ("provider" in payload) {
    return `${formatBucket(payload.provider)} · ${payload.model} · ${payload.dimensions} dimensions`;
  }

  if ("propertyId" in payload) {
    return `property ${payload.propertyId.slice(0, 8)}`;
  }

  return "tenant scoped job";
}

function formatJobTime(job: BackgroundJobMonitorItem) {
  const timestamp = job.finishedAt ?? job.processedAt ?? job.createdAt;

  if (!timestamp) {
    return "time pending";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(timestamp));
}

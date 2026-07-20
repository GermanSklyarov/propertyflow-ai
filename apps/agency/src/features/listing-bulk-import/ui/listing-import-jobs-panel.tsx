"use client";

import { useEffect, useMemo, useState } from "react";
import type { BackgroundJobMonitorItem, BackgroundJobMonitorResponse } from "@propertyflow/contracts";
import styles from "./listing-bulk-import-panel.module.css";

interface ListingImportJobsPanelProps {
  initialJobs: BackgroundJobMonitorItem[];
  queuedJobId?: string;
}

export function ListingImportJobsPanel({ initialJobs, queuedJobId }: ListingImportJobsPanelProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const [pollAfterQueue, setPollAfterQueue] = useState(Boolean(queuedJobId));
  const hasRunningJob = useMemo(() => jobs.some(isRunningJob), [jobs]);
  const hasQueuedJobSnapshot = queuedJobId ? jobs.some((job) => job.id === queuedJobId) : true;
  const shouldPoll = pollAfterQueue || hasRunningJob;

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    if (queuedJobId) {
      setPollAfterQueue(true);
    }
  }, [queuedJobId]);

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    const controller = new AbortController();
    const loadJobs = () => {
      const url = queuedJobId
        ? `/api/listing-import-jobs?jobId=${encodeURIComponent(queuedJobId)}`
        : "/api/listing-import-jobs";

      fetch(url, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : undefined))
        .then((body: BackgroundJobMonitorResponse | undefined) => {
          if (body) {
            setJobs(body.items);
            setPollAfterQueue(body.items.length === 0 || body.items.some(isRunningJob));
          }
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
        });
    };

    loadJobs();
    const intervalId = window.setInterval(loadJobs, 2_000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [shouldPoll]);

  if (!jobs.length && !queuedJobId) {
    return null;
  }

  return (
    <div className={styles.jobsPanel}>
      <div className={styles.jobsHeader}>
        <span>Recent import jobs</span>
        <small>{jobs.length ? `${jobs.length} visible` : "syncing"}</small>
      </div>
      {!hasQueuedJobSnapshot && queuedJobId ? (
        <article className={styles.jobCard} aria-live="polite">
          <div className={styles.jobTopline}>
            <strong>Job {queuedJobId}</strong>
            <span className={`${styles.jobState} ${styles["job-active"]}`}>queued</span>
          </div>
          <div className={styles.progressTrack} aria-label="Import queued">
            <span className={styles.progressPulse} />
          </div>
          <div className={styles.jobMeta}>
            <small>Waiting for worker snapshot</small>
            <small>Refreshing every 2 seconds</small>
          </div>
        </article>
      ) : null}
      <div className={styles.jobList}>
        {jobs.map((job) => {
          const progress = getImportProgress(job);
          const result = getImportResult(job);

          return (
            <article className={styles.jobCard} key={job.id}>
              <div className={styles.jobTopline}>
                <strong>Job {job.id}</strong>
                <span className={`${styles.jobState} ${styles[`job-${job.state}`] ?? ""}`}>{job.state}</span>
              </div>
              <div className={styles.progressTrack} aria-label={`Import progress ${progress.percent}%`}>
                <span style={{ width: `${progress.percent}%` }} />
              </div>
              <div className={styles.jobMeta}>
                <small>{progress.imported} imported</small>
                <small>{progress.skipped} skipped</small>
                <small>{progress.total} total</small>
                <small>{formatJobTime(job)}</small>
              </div>
              {result ? (
                <div className={styles.resultSummary}>
                  <strong>{result.dryRun ? "Dry-run complete" : formatImportMode(result.importMode)}</strong>
                  <span>
                    {result.imported} imported · {result.skipped} skipped · {result.crmRecordsCreated} CRM records ·{" "}
                    {result.knowledgeDocumentsCreated} knowledge docs · {result.aiIndexCandidates} AI candidates ·{" "}
                    {result.indexed} indexed · {result.total} rows
                  </span>
                </div>
              ) : null}
              {result?.rowsMissingExternalId ? (
                <div className={styles.importWarning}>
                  <strong>{result.rowsMissingExternalId} rows without externalId</strong>
                  <span>They can create duplicate drafts on recurring CRM imports.</span>
                </div>
              ) : null}
              {result?.issues?.length ? (
                <div className={styles.issueList}>
                  {result.issues.map((issue) => (
                    <small key={`${job.id}-${issue.rowNumber}-${issue.reason}`}>
                      Row {issue.rowNumber}: {issue.reason}
                    </small>
                  ))}
                </div>
              ) : null}
              {job.failedReason ? <p className={styles.failure}>{job.failedReason}</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function getImportProgress(job: BackgroundJobMonitorItem) {
  const progress = isProgressObject(job.progress) ? job.progress : {};
  const imported = getProgressNumber(progress.imported);
  const skipped = getProgressNumber(progress.skipped);
  const total = getProgressNumber(progress.total);
  const percent =
    getProgressNumber(progress.percent) ||
    (typeof job.progress === "number" ? job.progress : total > 0 ? Math.round(((imported + skipped) / total) * 100) : 0);

  return {
    imported,
    percent: Math.max(0, Math.min(percent, 100)),
    skipped,
    total
  };
}

function isRunningJob(job: BackgroundJobMonitorItem) {
  return job.state === "active" || job.state === "waiting";
}

function getImportResult(job: BackgroundJobMonitorItem): ImportJobResult | undefined {
  if (!isRecord(job.result)) {
    return undefined;
  }

  const imported = getProgressNumber(job.result.imported);
  const skipped = getProgressNumber(job.result.skipped);
  const total = getProgressNumber(job.result.total);
  const indexed = getProgressNumber(job.result.indexed);
  const aiIndexCandidates = getProgressNumber(job.result.aiIndexCandidates);
  const crmRecordsCreated = getProgressNumber(job.result.crmRecordsCreated);
  const knowledgeDocumentsCreated = getProgressNumber(job.result.knowledgeDocumentsCreated);
  const importMode = getImportMode(job.result.importMode);
  const rowsMissingExternalId = getProgressNumber(job.result.rowsMissingExternalId);
  const rowsWithExternalId = getProgressNumber(job.result.rowsWithExternalId);
  const dryRun = job.result.dryRun === true;
  const issues = Array.isArray(job.result.issues) ? job.result.issues.filter(isImportIssue).slice(0, 3) : [];

  return {
    aiIndexCandidates,
    crmRecordsCreated,
    dryRun,
    imported,
    importMode,
    indexed,
    knowledgeDocumentsCreated,
    issues,
    rowsMissingExternalId,
    rowsWithExternalId,
    skipped,
    total
  };
}

function isProgressObject(value: BackgroundJobMonitorItem["progress"]): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ImportJobResult {
  aiIndexCandidates: number;
  crmRecordsCreated: number;
  dryRun: boolean;
  importMode: "crm_inventory" | "concierge_index_only" | "hybrid";
  imported: number;
  indexed: number;
  knowledgeDocumentsCreated: number;
  issues: ImportIssue[];
  rowsMissingExternalId: number;
  rowsWithExternalId: number;
  skipped: number;
  total: number;
}

function getImportMode(value: unknown): ImportJobResult["importMode"] {
  if (value === "crm_inventory" || value === "concierge_index_only" || value === "hybrid") {
    return value;
  }

  return "crm_inventory";
}

function formatImportMode(value: ImportJobResult["importMode"]) {
  const labels = {
    concierge_index_only: "AI Concierge only",
    crm_inventory: "CRM inventory",
    hybrid: "CRM + AI index"
  } satisfies Record<ImportJobResult["importMode"], string>;

  return labels[value];
}

interface ImportIssue {
  reason: string;
  rowNumber: number;
}

function isImportIssue(value: unknown): value is ImportIssue {
  return isRecord(value) && typeof value.reason === "string" && typeof value.rowNumber === "number";
}

function getProgressNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

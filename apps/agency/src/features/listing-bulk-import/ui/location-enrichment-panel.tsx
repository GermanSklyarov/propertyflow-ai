"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPinned, RefreshCw, RotateCcw } from "lucide-react";
import type { BackgroundJobMonitorItem, LocationEnrichmentStatusResponse } from "@propertyflow/contracts";
import styles from "./listing-bulk-import-panel.module.css";

interface LocationEnrichmentPanelProps {
  initialJobs: BackgroundJobMonitorItem[];
  initialStatus?: LocationEnrichmentStatusResponse;
}

interface LocationEnrichmentPayload {
  jobs: BackgroundJobMonitorItem[];
  status: LocationEnrichmentStatusResponse;
}

export function LocationEnrichmentPanel({ initialJobs, initialStatus }: LocationEnrichmentPanelProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const [status, setStatus] = useState(initialStatus);
  const [pendingAction, setPendingAction] = useState<"enrich-missing" | "retry-failed" | undefined>();
  const running = Boolean(status?.running || jobs.some(isRunningJob) || pendingAction);
  const failedListings = Math.max(status?.failedListings ?? 0, countRecentFailures(jobs));
  const progress = useMemo(() => {
    const total = status?.totalListings ?? 0;
    const enriched = status?.enrichedListings ?? 0;

    return total > 0 ? Math.round((enriched / total) * 100) : 0;
  }, [status]);

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (!running) {
      return;
    }

    const controller = new AbortController();
    const load = () => {
      fetch("/api/location-enrichment", { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : undefined))
        .then((payload: LocationEnrichmentPayload | undefined) => {
          if (payload) {
            setJobs(payload.jobs);
            setStatus(payload.status);
            if (!payload.status.running) {
              setPendingAction(undefined);
            }
          }
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
        });
    };

    load();
    const intervalId = window.setInterval(load, 3_000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [running]);

  if (!status || status.totalListings === 0) {
    return null;
  }

  async function enqueue(action: "enrich-missing" | "retry-failed") {
    setPendingAction(action);
    const response = await fetch("/api/location-enrichment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action })
    });

    if (!response.ok) {
      setPendingAction(undefined);
      return;
    }

    const payload = await fetch("/api/location-enrichment").then((refreshResponse) =>
      refreshResponse.ok ? refreshResponse.json() : undefined
    );

    if (payload) {
      setJobs((payload as LocationEnrichmentPayload).jobs);
      setStatus((payload as LocationEnrichmentPayload).status);
    }
  }

  return (
    <section className={styles.locationPanel} aria-label="Location enrichment status">
      <div className={styles.locationHeader}>
        <div>
          <p className="section-kicker">Location enrichment</p>
          <h2>Listing location data</h2>
          <span>Concierge inventory is available now. Location records continue syncing in the background.</span>
        </div>
        <span className={running ? styles.locationRunning : styles.locationReady}>
          {running ? "Enriching" : status.pendingListings > 0 ? "Needs enrichment" : "Ready"}
        </span>
      </div>

      <div className={styles.locationProgress}>
        <div className={styles.progressTrack} aria-label={`Location enrichment progress ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <strong>
          {formatNumber(status.enrichedListings)} / {formatNumber(status.totalListings)} location records enriched
        </strong>
      </div>

      <div className={styles.locationStats}>
        <span>{formatNumber(status.pendingListings)} pending</span>
        <span>{formatNumber(status.missingCoordinates)} missing coordinates</span>
        <span>{formatNumber(failedListings)} failed</span>
        {status.latestJobId ? <span>Last job {status.latestJobId}</span> : null}
      </div>

      <div className={styles.locationActions}>
        <button disabled={running || status.pendingListings === 0} onClick={() => void enqueue("enrich-missing")} type="button">
          <MapPinned size={16} />
          Enrich missing
        </button>
        <button disabled={running || failedListings === 0} onClick={() => void enqueue("retry-failed")} type="button">
          {pendingAction === "retry-failed" ? <RefreshCw size={16} /> : <RotateCcw size={16} />}
          Retry failed
        </button>
      </div>
    </section>
  );
}

function isRunningJob(job: BackgroundJobMonitorItem) {
  return job.state === "active" || job.state === "waiting" || job.state === "delayed";
}

function countRecentFailures(jobs: BackgroundJobMonitorItem[]) {
  return jobs.reduce((total, job) => {
    if (!isRecord(job.result)) {
      return total;
    }

    const failures = Array.isArray(job.result.failures) ? job.result.failures.length : 0;
    const importFailures = Array.isArray(job.result.locationEnrichmentFailures) ? job.result.locationEnrichmentFailures.length : 0;

    return total + failures + importFailures;
  }, 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

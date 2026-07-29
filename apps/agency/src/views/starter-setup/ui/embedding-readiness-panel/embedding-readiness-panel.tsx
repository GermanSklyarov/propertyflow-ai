"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatabaseZap } from "lucide-react";
import type { BackgroundJobMonitorItem, KnowledgeEmbeddingHealthSnapshot } from "@propertyflow/contracts";
import { buildStarterEmbeddingReadiness } from "../../model/starter-setup";
import styles from "../starter-setup-page.module.css";

type RefreshState = "completed" | "failed" | "idle" | "queueing" | "refreshing";
type KnowledgeVectorRefreshSnapshot = {
  health: KnowledgeEmbeddingHealthSnapshot;
  job: BackgroundJobMonitorItem | null;
};

const maxPollAttempts = 30;
const pollIntervalMs = 2000;
const runningJobStates = new Set<BackgroundJobMonitorItem["state"]>(["active", "waiting", "delayed", "waiting-children"]);

export function EmbeddingReadinessPanel({
  initialHealth
}: {
  initialHealth: KnowledgeEmbeddingHealthSnapshot;
}) {
  const [health, setHealth] = useState(initialHealth);
  const [job, setJob] = useState<BackgroundJobMonitorItem | null>(null);
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const [feedback, setFeedback] = useState("");
  const pollAttempts = useRef(0);
  const pollTimer = useRef<number | null>(null);
  const readiness = useMemo(() => buildStarterEmbeddingReadiness(health), [health]);
  const hasRunningJob = job ? runningJobStates.has(job.state) : false;
  const isRefreshing = refreshState === "queueing" || refreshState === "refreshing" || hasRunningJob;

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const loadSnapshot = useCallback(async () => {
    const response = await fetch("/api/knowledge-vectors", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Failed to load vector health: ${response.status}`);
    }

    return (await response.json()) as KnowledgeVectorRefreshSnapshot;
  }, []);

  const settleFromSnapshot = useCallback((snapshot: KnowledgeVectorRefreshSnapshot) => {
    const nextHealth = snapshot.health;
    const nextJob = snapshot.job;
    const hasWorkLeft = nextHealth.pendingChunks > 0 || nextHealth.staleChunks > 0;
    const hasSettledLongEnough = pollAttempts.current >= 2;

    if (nextJob && runningJobStates.has(nextJob.state)) {
      setRefreshState("refreshing");
      setFeedback("Worker is refreshing vectors. This panel checks progress every 2 seconds.");
      return false;
    }

    if (nextHealth.ready) {
      setRefreshState("completed");
      setFeedback("Vectors are current. Concierge retrieval can use the refreshed index.");
      return true;
    }

    if (nextJob?.state === "failed") {
      setRefreshState("failed");
      setFeedback(nextJob.failedReason ? `Embedding job failed: ${nextJob.failedReason}` : "Embedding job failed. Check worker logs before launch.");
      return true;
    }

    if (!hasWorkLeft && nextHealth.failedChunks > 0 && hasSettledLongEnough) {
      setRefreshState("failed");
      setFeedback(`${nextHealth.failedChunks} chunks still failed after refresh. Check worker logs before launch.`);
      return true;
    }

    if (pollAttempts.current >= maxPollAttempts) {
      setRefreshState("idle");
      setFeedback("Refresh is still running in the background. Reload later or check background jobs.");
      return true;
    }

    setRefreshState("refreshing");
    setFeedback("Worker is refreshing vectors. This panel checks progress every 2 seconds.");
    return false;
  }, []);

  const pollHealth = useCallback(async () => {
    try {
      pollAttempts.current += 1;
      const snapshot = await loadSnapshot();
      setHealth(snapshot.health);
      setJob(snapshot.job);

      if (settleFromSnapshot(snapshot)) {
        stopPolling();
      }
    } catch {
      setRefreshState("failed");
      setFeedback("Could not refresh vector status. Check the API connection and try again.");
      stopPolling();
    }
  }, [loadSnapshot, settleFromSnapshot, stopPolling]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    let mounted = true;

    async function syncActiveJob() {
      try {
        const snapshot = await loadSnapshot();

        if (!mounted) {
          return;
        }

        setHealth(snapshot.health);
        setJob(snapshot.job);

        if (snapshot.job && runningJobStates.has(snapshot.job.state)) {
          pollAttempts.current = 0;
          setRefreshState("refreshing");
          setFeedback("Vector refresh is already running. Tracking worker progress now.");
          pollTimer.current = window.setInterval(pollHealth, pollIntervalMs);
        }
      } catch {
        // Keep the server-rendered health snapshot if the live check is temporarily unavailable.
      }
    }

    void syncActiveJob();

    return () => {
      mounted = false;
    };
  }, [loadSnapshot, pollHealth]);

  async function refreshVectors() {
    if (isRefreshing || !readiness.total) {
      return;
    }

    stopPolling();
    pollAttempts.current = 0;
    setRefreshState("queueing");
    setFeedback("Queueing vector refresh...");

    try {
      const response = await fetch("/api/knowledge-vectors", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`Failed to queue vector refresh: ${response.status}`);
      }

      setRefreshState("refreshing");
      setFeedback("Refresh queued. Waiting for worker progress...");
      pollTimer.current = window.setInterval(pollHealth, pollIntervalMs);
      await pollHealth();
    } catch {
      setRefreshState("failed");
      setFeedback("Could not start vector refresh. Check the API and worker, then try again.");
      stopPolling();
    }
  }

  return (
    <section
      className={styles.embeddingPanel}
      data-ready={String(readiness.ready)}
      data-refreshing={String(isRefreshing)}
      id="ai-retrieval-readiness"
      aria-label="AI retrieval readiness"
    >
      <div className={styles.embeddingHeader}>
        <DatabaseZap size={18} />
        <div>
          <strong>{readiness.ready ? "AI retrieval vectors current" : "AI retrieval vectors need refresh"}</strong>
          <span>{readiness.providerLabel}</span>
        </div>
      </div>
      <p>{readiness.summary}</p>
      <div className={styles.embeddingStats}>
        <span>
          <strong>{readiness.current}</strong>
          current
        </span>
        <span>
          <strong>{readiness.stale}</strong>
          stale
        </span>
        <span>
          <strong>{readiness.pending}</strong>
          pending
        </span>
        <span>
          <strong>{readiness.failed}</strong>
          failed
        </span>
      </div>
      <div className={styles.embeddingAction}>
        <button data-refreshing={String(isRefreshing)} disabled={!readiness.total || isRefreshing} onClick={refreshVectors} type="button">
          <DatabaseZap size={16} />
          {refreshState === "queueing" ? "Queueing..." : refreshState === "refreshing" ? "Refreshing..." : readiness.actionLabel}
        </button>
      </div>
      {job && (isRefreshing || refreshState !== "idle") ? (
        <div className={styles.embeddingJob} data-state={job.state}>
          <span>Job #{job.id}</span>
          <strong>{job.state}</strong>
          <span>{formatJobProgress(job.progress)}</span>
        </div>
      ) : null}
      {feedback ? (
        <p className={styles.embeddingFeedback} data-state={refreshState} aria-live="polite">
          {feedback}
        </p>
      ) : null}
    </section>
  );
}

function formatJobProgress(progress: BackgroundJobMonitorItem["progress"]) {
  if (typeof progress === "number") {
    return `${Math.max(0, Math.min(100, Math.round(progress)))}% progress`;
  }

  if (typeof progress === "string" && progress.trim()) {
    return progress;
  }

  if (progress && typeof progress === "object") {
    return "worker progress received";
  }

  return "waiting for worker snapshot";
}

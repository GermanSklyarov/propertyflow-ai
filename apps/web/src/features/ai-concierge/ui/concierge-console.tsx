"use client";

import { ArrowRight, Loader2, MapPinned, Sparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import type { ConciergeResponse } from "@propertyflow/contracts";
import { askConcierge } from "../../../shared/api/propertyflow-client";

const starterPrompts = [
  "Moving to Pattaya with family, remote work, quiet area, budget 3.5M THB",
  "Investment condo in Pattaya above 6% yield near the beach",
  "Winter home close to Terminal 21, walkable cafes, reliable internet"
];

export function ConciergeConsole() {
  const [message, setMessage] = useState(starterPrompts[0]);
  const [response, setResponse] = useState<ConciergeResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const primaryArea = response?.areaRecommendation;
  const recommendationTone = useMemo(() => {
    if (!response) {
      return "Ready";
    }

    return response.stage === "recommendation" ? "Recommendation" : "Intake";
  }, [response]);

  function submit() {
    startTransition(async () => {
      const nextResponse = await askConcierge({
        locale: "en",
        message,
        profile: {
          market: "pattaya",
          budgetThb: 3500000,
          remoteWork: true,
          purpose: "living",
          prefersQuiet: true
        }
      });

      setResponse(nextResponse);
    });
  }

  return (
    <section className="concierge-panel" aria-label="AI concierge">
      <div className="console-topline">
        <span className="status-dot" />
        <span>{recommendationTone}</span>
        <span className="console-model">Concierge AI</span>
      </div>

      <label className="prompt-shell">
        <span>Describe the move, budget, or investment target</span>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} />
      </label>

      <div className="prompt-actions">
        <div className="prompt-chips">
          {starterPrompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => setMessage(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
        <button className="primary-action" type="button" onClick={submit} disabled={isPending}>
          {isPending ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
          <span>Advise</span>
        </button>
      </div>

      <div className="answer-grid">
        <article className="answer-card area-card">
          <div className="answer-icon">
            <MapPinned size={18} />
          </div>
          <div>
            <p className="answer-label">Area pick</p>
            <h2>{primaryArea ? primaryArea.area : "Wongamat"}</h2>
            <p>
              {response?.summary ??
                "A quieter beach-side base with enough cafes, strong rental demand, and a better daily-life profile than the busiest tourist streets."}
            </p>
          </div>
        </article>

        <div className="reason-stack">
          {(primaryArea?.reasons ?? ["quiet beach access", "remote-work friendly buildings", "balanced rental demand"]).map(
            (reason) => (
              <div className="reason-row" key={reason}>
                <ArrowRight size={16} />
                <span>{reason}</span>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}

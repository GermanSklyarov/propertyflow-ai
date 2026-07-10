"use client";

import { ArrowRight, Loader2, MapPinned, Sparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import type { ConciergeResponse } from "@propertyflow/contracts";
import { askConcierge } from "../../../shared/api/propertyflow-client";

const starterPrompts = [
  "Moving to Pattaya with family, remote work, quiet area, budget 3.5M THB",
  "Need to rent in Pattaya for 6 months, beach access, good internet, under 30k THB/month",
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
    <section
      className="border border-white/30 bg-[rgba(250,252,248,0.9)] p-[clamp(18px,2vw,26px)] shadow-[var(--shadow)] backdrop-blur-2xl min-[1081px]:max-w-none max-[1080px]:max-w-[760px]"
      aria-label="AI concierge"
    >
      <div className="flex items-center gap-2 text-[0.86rem] font-extrabold text-[var(--teal-dark)]">
        <span className="size-[9px] rounded-full bg-[#21b17b] shadow-[0_0_0_6px_rgba(33,177,123,0.15)]" />
        <span>{recommendationTone}</span>
        <span className="ml-auto font-bold text-[var(--muted)]">Concierge AI</span>
      </div>

      <label className="mt-[22px] grid gap-2.5">
        <span className="text-[0.86rem] font-bold text-[var(--muted)]">Describe the move, budget, or investment target</span>
        <textarea
          className="min-h-[126px] w-full resize-y border border-[var(--line)] bg-[var(--panel-strong)] p-4 leading-normal text-[var(--ink)] outline-none focus:border-[rgba(15,118,110,0.55)] focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
        />
      </label>

      <div className="mt-4 grid gap-4">
        <div className="flex flex-wrap gap-2">
          {starterPrompts.map((prompt) => (
            <button
              className="cursor-pointer border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[0.78rem] font-extrabold text-[var(--teal-dark)]"
              key={prompt}
              type="button"
              onClick={() => setMessage(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
        <button
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2.5 border-0 bg-[var(--teal)] px-4 py-3.5 font-black text-white disabled:cursor-wait disabled:opacity-75"
          type="button"
          onClick={submit}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
          <span>Advise</span>
        </button>
      </div>

      <div className="mt-[22px] grid gap-3.5">
        <article className="grid grid-cols-[42px_1fr] gap-3.5 border border-[rgba(15,118,110,0.16)] bg-[#edf8f4] p-4">
          <div className="grid size-[42px] place-items-center bg-[var(--teal)] text-white">
            <MapPinned size={18} />
          </div>
          <div>
            <p className="m-0 text-[0.78rem] font-extrabold uppercase tracking-[0.12em] text-[var(--coral)]">Area pick</p>
            <h2 className="mb-2 mt-1 text-[1.6rem]">{primaryArea ? primaryArea.area : "Wongamat"}</h2>
            <p className="m-0 leading-normal text-[#42524e]">
              {response?.summary ??
                "A quieter beach-side base with enough cafes, strong rental demand, and a better daily-life profile than the busiest tourist streets."}
            </p>
          </div>
        </article>

        <div className="grid gap-2">
          {(primaryArea?.reasons ?? ["quiet beach access", "remote-work friendly buildings", "balanced rental demand"]).map(
            (reason) => (
              <div
                className="flex items-center gap-2.5 border border-[var(--line)] bg-white/70 px-3 py-2.5 text-[0.9rem] font-bold text-[#31413d]"
                key={reason}
              >
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

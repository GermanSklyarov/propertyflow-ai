"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2, MapPinned, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { askConciergeMutationOptions } from "@entities/concierge/api/concierge-mutations";
import {
  buildConciergeProfile,
  buildConciergeProfileChips,
  buildConciergeRequest
} from "@features/ai-concierge/model/concierge-profile-builder";
import {
  conciergeRequestSchema,
  type ConciergeRequestFormValues
} from "@features/ai-concierge/model/concierge-request-schema";

const starterPrompts = [
  "Moving to Pattaya with family, remote work, quiet area, budget 3.5M THB",
  "Need to rent in Pattaya for 6 months, beach access, good internet, under 30k THB/month",
  "Investment condo in Pattaya above 6% yield near the beach",
  "Winter home close to Terminal 21, walkable cafes, reliable internet"
];

export function ConciergeConsole() {
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch
  } = useForm<ConciergeRequestFormValues>({
    resolver: zodResolver(conciergeRequestSchema),
    defaultValues: {
      message: starterPrompts[0]
    }
  });
  const conciergeMutation = useMutation(askConciergeMutationOptions());
  const response = conciergeMutation.data ?? null;
  const message = watch("message");
  const inferredProfile = useMemo(() => buildConciergeProfile(message), [message]);
  const profileChips = useMemo(() => buildConciergeProfileChips(inferredProfile), [inferredProfile]);

  const primaryArea = response?.areaRecommendation;
  const recommendationTone = useMemo(() => {
    if (!response) {
      return "Ready";
    }

    return response.stage === "recommendation" ? "Recommendation" : "Intake";
  }, [response]);

  function submit(values: ConciergeRequestFormValues) {
    conciergeMutation.mutate(buildConciergeRequest(values.message));
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

      <form onSubmit={handleSubmit(submit)}>
        <label className="mt-[22px] grid gap-2.5">
          <span className="text-[0.86rem] font-bold text-[var(--muted)]">
            Describe the move, budget, or investment target
          </span>
          <textarea
            className="min-h-[126px] w-full resize-y border border-[var(--line)] bg-[var(--panel-strong)] p-4 leading-normal text-[var(--ink)] outline-none focus:border-[rgba(15,118,110,0.55)] focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
            rows={4}
            {...register("message")}
          />
        </label>

        {errors.message ? (
          <p className="mb-0 mt-3 text-[0.86rem] font-bold text-[var(--coral)]">{errors.message.message}</p>
        ) : null}

        <div className="mt-4 grid gap-4">
          <div className="flex flex-wrap gap-2" aria-label="Inferred concierge profile">
            {profileChips.map((chip) => (
              <span
                className="inline-flex min-h-[30px] items-center gap-1.5 border border-[rgba(15,118,110,0.16)] bg-[#edf8f4] px-2.5 py-1 text-[0.76rem] font-black text-[var(--teal-dark)]"
                key={`${chip.label}-${chip.value}`}
              >
                <span className="text-[var(--muted)]">{chip.label}</span>
                {chip.value}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {starterPrompts.map((prompt) => (
              <button
                className="cursor-pointer border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[0.78rem] font-extrabold text-[var(--teal-dark)] transition duration-150 hover:-translate-y-0.5 hover:border-[rgba(15,118,110,0.42)] hover:bg-[#edf8f4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(15,118,110,0.18)]"
                key={prompt}
                type="button"
                onClick={() => setValue("message", prompt, { shouldDirty: true, shouldValidate: true })}
              >
                {prompt}
              </button>
            ))}
          </div>
          <button
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2.5 border-0 bg-[var(--teal)] px-4 py-3.5 font-black text-white transition duration-150 hover:-translate-y-0.5 hover:bg-[var(--teal-dark)] hover:shadow-[0_14px_28px_rgba(37,50,46,0.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(15,118,110,0.18)] disabled:cursor-wait disabled:opacity-75 disabled:hover:translate-y-0 disabled:hover:bg-[var(--teal)] disabled:hover:shadow-none"
            type="submit"
            disabled={conciergeMutation.isPending}
          >
            {conciergeMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            <span>Advise</span>
          </button>
        </div>
      </form>

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

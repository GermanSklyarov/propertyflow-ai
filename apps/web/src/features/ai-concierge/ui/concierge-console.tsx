"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Loader2, MapPinned, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { ConciergeProfile, ConciergeResponse } from "@propertyflow/contracts";
import { askConciergeMutationOptions } from "@entities/concierge/api/concierge-mutations";
import {
  conciergeConsoleStorageKey,
  parseConciergeConsoleState,
  stringifyConciergeConsoleState,
} from "@features/ai-concierge/model/concierge-console-storage";
import {
  buildFollowUpOptions,
  parseBudgetAnswer,
} from "@features/ai-concierge/model/concierge-follow-up";
import {
  buildConciergeProfile,
  buildConciergeProfileChips,
  buildConciergeRequest,
} from "@features/ai-concierge/model/concierge-profile-builder";
import { buildConciergeRecommendationCards } from "@features/ai-concierge/model/concierge-recommendation-cards";
import {
  conciergeRequestSchema,
  type ConciergeRequestFormValues,
} from "@features/ai-concierge/model/concierge-request-schema";
import styles from "./concierge-console.module.css";

const starterPrompts = [
  "Moving to Pattaya with family, remote work, quiet area, budget 3.5M THB",
  "Need to rent in Pattaya for 6 months, beach access, good internet, under 30k THB/month",
  "Investment condo in Pattaya above 6% yield near the beach",
  "Winter home close to Terminal 21, walkable cafes, reliable internet",
];

export function ConciergeConsole() {
  const followUpRef = useRef<HTMLElement | null>(null);
  const recommendationsRef = useRef<HTMLElement | null>(null);
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm<ConciergeRequestFormValues>({
    resolver: zodResolver(conciergeRequestSchema),
    defaultValues: {
      message: starterPrompts[0],
    },
  });
  const [profileOverride, setProfileOverride] = useState<ConciergeProfile>({});
  const [budgetAnswer, setBudgetAnswer] = useState("");
  const [storedResponse, setStoredResponse] =
    useState<ConciergeResponse | null>(null);
  const [hasRestoredConsoleState, setHasRestoredConsoleState] =
    useState(false);
  const [shouldScrollToConciergeResult, setShouldScrollToConciergeResult] =
    useState(false);
  const conciergeMutation = useMutation(askConciergeMutationOptions());
  const response = conciergeMutation.data ?? storedResponse;
  const message = watch("message");
  const inferredProfile = useMemo(
    () => ({ ...buildConciergeProfile(message), ...profileOverride }),
    [message, profileOverride],
  );
  const profileChips = useMemo(
    () => buildConciergeProfileChips(inferredProfile),
    [inferredProfile],
  );
  const recommendationCards = useMemo(
    () => buildConciergeRecommendationCards(response),
    [response],
  );

  const primaryArea = response?.areaRecommendation;
  const shouldShowFollowUp =
    response?.stage === "intake" && response.nextQuestions.length > 0;
  const shouldShowRecommendations = recommendationCards.length > 0;
  const recommendationTone = useMemo(() => {
    if (!response) {
      return "Ready";
    }

    return response.stage === "recommendation" ? "Recommendation" : "Intake";
  }, [response]);

  function submit(values: ConciergeRequestFormValues) {
    setStoredResponse(null);
    setShouldScrollToConciergeResult(true);
    conciergeMutation.reset();
    conciergeMutation.mutate(
      buildConciergeRequest(values.message, profileOverride),
    );
  }

  function answerFollowUp(patch: ConciergeProfile) {
    const nextProfileOverride = {
      ...profileOverride,
      ...patch,
    };

    setProfileOverride(nextProfileOverride);
    setStoredResponse(null);
    setShouldScrollToConciergeResult(true);
    conciergeMutation.reset();
    conciergeMutation.mutate(
      buildConciergeRequest(message, nextProfileOverride),
    );
  }

  function submitCustomBudget() {
    const budgetThb = parseBudgetAnswer(budgetAnswer);

    if (!budgetThb) {
      return;
    }

    setBudgetAnswer("");
    answerFollowUp({ budgetThb });
  }

  useEffect(() => {
    const savedState = parseConciergeConsoleState(
      window.sessionStorage.getItem(conciergeConsoleStorageKey),
    );

    if (savedState) {
      setValue("message", savedState.message, {
        shouldDirty: false,
        shouldValidate: true,
      });
      setProfileOverride(savedState.profileOverride);
      setBudgetAnswer(savedState.budgetAnswer);
      setStoredResponse(savedState.response);
    }

    setHasRestoredConsoleState(true);
  }, [setValue]);

  useEffect(() => {
    if (conciergeMutation.data) {
      setStoredResponse(conciergeMutation.data);
    }
  }, [conciergeMutation.data]);

  useEffect(() => {
    if (!hasRestoredConsoleState) {
      return;
    }

    window.sessionStorage.setItem(
      conciergeConsoleStorageKey,
      stringifyConciergeConsoleState({
        budgetAnswer,
        message,
        profileOverride,
        response,
      }),
    );
  }, [budgetAnswer, hasRestoredConsoleState, message, profileOverride, response]);

  useEffect(() => {
    const shouldHonorConciergeHash =
      window.location.hash === "#concierge-recommendations";

    if (!shouldScrollToConciergeResult && !shouldHonorConciergeHash) {
      return;
    }

    const target = shouldShowFollowUp
      ? followUpRef.current
      : shouldShowRecommendations
        ? recommendationsRef.current
        : null;

    if (!target) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus({ preventScroll: true });
      setShouldScrollToConciergeResult(false);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    response?.id,
    shouldScrollToConciergeResult,
    shouldShowFollowUp,
    shouldShowRecommendations,
  ]);

  return (
    <section
      className={`border border-white/30 bg-[rgba(250,252,248,0.9)] p-[clamp(18px,2vw,26px)] shadow-[var(--shadow)] backdrop-blur-2xl ${styles.root}`}
      aria-label="AI concierge"
    >
      <div className="flex items-center gap-2 text-[0.86rem] font-extrabold text-[var(--teal-dark)]">
        <span className="size-[9px] rounded-full bg-[#21b17b] shadow-[0_0_0_6px_rgba(33,177,123,0.15)]" />
        <span>{recommendationTone}</span>
        <span className="ml-auto font-bold text-[var(--muted)]">
          Concierge AI
        </span>
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
          <p className="mb-0 mt-3 text-[0.86rem] font-bold text-[var(--coral)]">
            {errors.message.message}
          </p>
        ) : null}

        <div className="mt-4 grid gap-4">
          <div
            className="flex flex-wrap gap-2"
            aria-label="Inferred concierge profile"
          >
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
                onClick={() => {
                  setProfileOverride({});
                  setBudgetAnswer("");
                  setStoredResponse(null);
                  setShouldScrollToConciergeResult(false);
                  conciergeMutation.reset();
                  setValue("message", prompt, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
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
            {conciergeMutation.isPending ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Sparkles size={18} />
            )}
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
            <p className="m-0 text-[0.78rem] font-extrabold uppercase tracking-[0.12em] text-[var(--coral)]">
              Area pick
            </p>
            <h2 className="mb-2 mt-1 text-[1.6rem]">
              {primaryArea ? primaryArea.area : "Wongamat"}
            </h2>
            <p className="m-0 leading-normal text-[#42524e]">
              {response?.summary ??
                "A quieter beach-side base with enough cafes, strong rental demand, and a better daily-life profile than the busiest tourist streets."}
            </p>
          </div>
        </article>

        {shouldShowFollowUp ? (
          <section
            aria-label="Concierge follow-up questions"
            className="grid scroll-mt-6 gap-2.5 border border-[rgba(15,118,110,0.36)] bg-white/90 p-4 shadow-[0_18px_42px_rgba(15,118,110,0.14)] outline-none ring-4 ring-[rgba(15,118,110,0.08)]"
            ref={followUpRef}
            tabIndex={-1}
          >
            <p className="m-0 text-[0.78rem] font-extrabold uppercase tracking-[0.12em] text-[var(--coral)]">
              Quick follow-up
            </p>
            {response.nextQuestions.map((question) => (
              <article
                className="grid gap-2 border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0"
                key={question.id}
              >
                <div>
                  <h3 className="mb-1 mt-0 text-[0.98rem]">
                    {question.question}
                  </h3>
                  <p className="m-0 text-[0.82rem] font-bold leading-normal text-[var(--muted)]">
                    {question.reason}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {buildFollowUpOptions(question, inferredProfile).map(
                    (option) => (
                      <button
                        className="cursor-pointer border border-[var(--line)] bg-white px-2.5 py-2 text-[0.78rem] font-extrabold text-[var(--teal-dark)] transition duration-150 hover:-translate-y-0.5 hover:border-[rgba(15,118,110,0.42)] hover:bg-[#edf8f4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(15,118,110,0.18)] disabled:cursor-wait disabled:opacity-70"
                        disabled={conciergeMutation.isPending}
                        key={option.label}
                        onClick={() => answerFollowUp(option.patch)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ),
                  )}
                </div>
                {question.id === "budgetThb" ? (
                  <div className={`grid gap-2 ${styles.inlineAction}`}>
                    <input
                      aria-label="Custom budget"
                      className="min-h-[38px] border border-[var(--line)] bg-white px-3 py-2 text-[0.82rem] font-bold text-[var(--ink)] outline-none focus:border-[rgba(15,118,110,0.55)] focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]"
                      onChange={(event) => setBudgetAnswer(event.target.value)}
                      placeholder={
                        inferredProfile.listingIntent === "rent"
                          ? "Your monthly budget, e.g. 45k"
                          : "Your purchase budget, e.g. 4.2M"
                      }
                      type="text"
                      value={budgetAnswer}
                    />
                    <button
                      className="cursor-pointer border border-[rgba(15,118,110,0.42)] bg-[#edf8f4] px-3 py-2 text-[0.78rem] font-extrabold text-[var(--teal-dark)] transition duration-150 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(15,118,110,0.18)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                      disabled={
                        !parseBudgetAnswer(budgetAnswer) ||
                        conciergeMutation.isPending
                      }
                      onClick={submitCustomBudget}
                      type="button"
                    >
                      Use this budget
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}

        <div className="grid gap-2">
          {(
            primaryArea?.reasons ?? [
              "quiet beach access",
              "remote-work friendly buildings",
              "balanced rental demand",
            ]
          ).map((reason) => (
            <div
              className="flex items-center gap-2.5 border border-[var(--line)] bg-white/70 px-3 py-2.5 text-[0.9rem] font-bold text-[#31413d]"
              key={reason}
            >
              <ArrowRight size={16} />
              <span>{reason}</span>
            </div>
          ))}
        </div>

        {recommendationCards.length ? (
          <section
            aria-label="Concierge recommended listings"
            className="grid scroll-mt-6 gap-2.5 border border-[rgba(15,118,110,0.36)] bg-white/90 p-4 shadow-[0_18px_42px_rgba(15,118,110,0.14)] outline-none ring-4 ring-[rgba(15,118,110,0.08)]"
            id="concierge-recommendations"
            ref={recommendationsRef}
            tabIndex={-1}
          >
            <div>
              <p className="m-0 text-[0.78rem] font-extrabold uppercase tracking-[0.12em] text-[var(--coral)]">
                Recommended listings
              </p>
              <h3 className="mb-0 mt-1 text-[1.05rem]">
                Best matches from this advice
              </h3>
              <p className="m-0 mt-1 text-[0.82rem] font-bold leading-normal text-[var(--muted)]">
                The concierge has enough context now, so the next step is to
                review these suggested properties.
              </p>
            </div>
            <div className="grid gap-2.5">
              {recommendationCards.map((card) => (
                <article
                  className="grid gap-2.5 border border-[var(--line)] bg-[var(--panel-strong)] p-3"
                  key={card.propertyId}
                >
                  <div className={`grid gap-2 ${styles.recommendationHeader}`}>
                    <div>
                      <h4 className="m-0 text-[0.98rem]">{card.title}</h4>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span
                          className={`border px-2 py-1 text-[0.72rem] font-black uppercase ${card.toneClassName}`}
                        >
                          {card.fitLabel}
                        </span>
                        <span className="border border-[var(--line)] bg-white px-2 py-1 text-[0.72rem] font-black uppercase text-[var(--muted)]">
                          {card.scoreLabel}
                        </span>
                      </div>
                    </div>
                    <Link
                      className="inline-flex w-fit items-center gap-1.5 border border-[var(--line)] bg-white px-2.5 py-2 text-[0.76rem] font-black text-[var(--teal-dark)] transition duration-150 hover:-translate-y-0.5 hover:border-[rgba(15,118,110,0.42)] hover:bg-[#edf8f4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(15,118,110,0.18)]"
                      href={`${card.href}?from=concierge`}
                    >
                      Open brief <ArrowRight size={14} />
                    </Link>
                  </div>
                  <div
                    className={`grid gap-2 text-[0.82rem] font-bold leading-normal text-[#42524e] ${styles.recommendationMeta}`}
                  >
                    <ul className="m-0 grid list-none gap-1.5 p-0">
                      {card.reasons.slice(0, 2).map((reason) => (
                        <li key={reason}>+ {reason}</li>
                      ))}
                    </ul>
                    {card.tradeoffs.length ? (
                      <ul className="m-0 grid list-none gap-1.5 p-0 text-[var(--muted)]">
                        {card.tradeoffs.slice(0, 2).map((tradeoff) => (
                          <li key={tradeoff}>Check: {tradeoff}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

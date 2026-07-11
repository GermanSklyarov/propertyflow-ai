"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect } from "react";
import type { PropertySnapshot } from "@propertyflow/domain";
import { comparePropertiesMutationOptions } from "@features/property-compare/api/property-compare-mutations";
import { buildCompareInsights } from "@features/property-compare/model/compare-insights";
import { useCompareSelectionStore } from "@features/property-compare/model/compare-selection-store";
import { useHasMounted } from "@shared/lib/use-has-mounted";
import styles from "./compare-band.module.css";

export function CompareBand({
  properties,
}: {
  properties: PropertySnapshot[];
}) {
  const hasMounted = useHasMounted();
  const persistedSelectedPropertyIds = useCompareSelectionStore(
    (state) => state.selectedPropertyIds,
  );
  const clearSelection = useCompareSelectionStore(
    (state) => state.clearSelection,
  );
  const selectedPropertyIds = hasMounted ? persistedSelectedPropertyIds : [];
  const selectedProperties = selectedPropertyIds
    .map((propertyId) =>
      properties.find((property) => property.id === propertyId),
    )
    .filter((property): property is PropertySnapshot => Boolean(property));
  const selectedPropertyIdKey = selectedPropertyIds.join(":");
  const compareInsights = buildCompareInsights(selectedProperties);
  const compareMutation = useMutation(comparePropertiesMutationOptions());
  const canRunCompare = selectedPropertyIds.length >= 2;
  const comparison = compareMutation.data;

  useEffect(() => {
    compareMutation.reset();
    // Compare results are valid only for the exact selected id set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyIdKey]);

  function runCompare() {
    if (!canRunCompare) {
      return;
    }

    compareMutation.mutate({ propertyIds: selectedPropertyIds });
  }

  return (
    <section
      className={`mx-auto mb-12 grid max-w-[1320px] items-center gap-7 border-t border-[var(--line)] px-[clamp(18px,4vw,54px)] py-[54px] ${styles.root}`}
    >
      <div>
        <p className="section-kicker">AI Compare</p>
        <h2 className="mt-2 max-w-[760px] text-[clamp(1.8rem,3.2vw,3.4rem)] leading-tight">
          {comparison
            ? "Purpose-specific winners from your shortlist."
            : selectedProperties.length
              ? `Ready to compare ${selectedProperties.length} selected ${selectedProperties.length === 1 ? "listing" : "listings"}.`
            : "Wongamat for living, Terminal North for liquidity, Jomtien for family space."}
        </h2>
        {comparison ? (
          <div className="mt-4 grid max-w-[760px] gap-2 border border-[rgba(15,118,110,0.16)] bg-white/70 p-3.5">
            <p className="m-0 text-[0.78rem] font-black uppercase tracking-[0.12em] text-[var(--coral)]">
              AI verdict
            </p>
            <div className="grid gap-2">
              {comparison.winners.map((winner) => (
                <div
                  className="grid gap-2 border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2.5"
                  key={`summary-${winner.purpose}-${winner.propertyId}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[0.92rem] leading-snug text-[var(--ink)]">
                      {winner.title}
                    </strong>
                    <span className="border border-[rgba(15,118,110,0.18)] bg-[#edf8f4] px-2 py-1 text-[0.7rem] font-black uppercase text-[var(--teal-dark)]">
                      {formatPurpose(winner.purpose)}
                    </span>
                    <span className="border border-[rgba(226,91,68,0.24)] bg-[#fff2ef] px-2 py-1 text-[0.7rem] font-black uppercase text-[var(--coral)]">
                      {Math.round(winner.score)} score
                    </span>
                  </div>
                  <p className="m-0 text-[0.82rem] font-bold leading-normal text-[#52615d]">
                    {winner.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {selectedProperties.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedProperties.map((property) => (
              <span
                className="border border-[rgba(15,118,110,0.22)] bg-[#edf8f4] px-3 py-2 text-[0.82rem] font-black text-[var(--teal-dark)]"
                key={property.id}
              >
                {property.title}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className="inline-flex cursor-pointer items-center gap-2 border border-[rgba(15,118,110,0.42)] bg-[var(--teal)] px-4 py-3 text-[0.82rem] font-black text-white transition duration-150 hover:-translate-y-0.5 hover:bg-[var(--teal-dark)] hover:shadow-[0_14px_28px_rgba(37,50,46,0.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(15,118,110,0.18)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:bg-[var(--teal)] disabled:hover:shadow-none"
            disabled={!canRunCompare || compareMutation.isPending}
            onClick={runCompare}
            type="button"
          >
            {compareMutation.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            Run AI compare
          </button>
          {selectedProperties.length ? (
            <button
              className="cursor-pointer border border-[var(--line)] bg-white px-4 py-3 text-left text-[0.82rem] font-black text-[var(--teal-dark)] transition duration-150 hover:-translate-y-0.5 hover:border-[rgba(15,118,110,0.42)] hover:bg-[#edf8f4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(15,118,110,0.18)]"
              onClick={clearSelection}
              type="button"
            >
              Clear compare
            </button>
          ) : null}
        </div>
      </div>
      <div className={`grid gap-2.5 ${styles.insights}`}>
        {comparison?.winners.length
          ? comparison.winners.map((winner) => (
              <article
                className="border-l-4 border-[var(--blue)] bg-white px-4 py-3.5"
                key={`${winner.purpose}-${winner.propertyId}`}
              >
                <p className="m-0 text-[0.76rem] font-black uppercase text-[var(--muted)]">
                  {formatPurpose(winner.purpose)}
                </p>
                <h3 className="mb-1.5 mt-1 text-[1rem]">{winner.title}</h3>
                <p className="m-0 text-[0.84rem] font-bold leading-normal text-[#52615d]">
                  {winner.explanation}
                </p>
                <span className="mt-2 inline-flex border border-[rgba(15,118,110,0.16)] bg-[#edf8f4] px-2 py-1 text-[0.72rem] font-black uppercase text-[var(--teal-dark)]">
                  {Math.round(winner.score)} AI score
                </span>
              </article>
            ))
          : compareInsights.length
          ? compareInsights.map((insight) => (
              <article
                className="border-l-4 border-[var(--blue)] bg-white px-4 py-3.5"
                key={insight.label}
              >
                <p className="m-0 text-[0.76rem] font-black uppercase text-[var(--muted)]">
                  {insight.label}
                </p>
                <h3 className="mb-1.5 mt-1 text-[1rem]">
                  {insight.property.title}
                </h3>
                <p className="m-0 text-[0.84rem] font-bold leading-normal text-[#52615d]">
                  {insight.reason}
                </p>
                <div className="mt-2 grid gap-1.5 text-[0.78rem] font-bold leading-normal text-[#42524e]">
                  {insight.signals.slice(0, 2).map((signal) => (
                    <span key={signal}>+ {signal}</span>
                  ))}
                  {insight.tradeoffs.slice(0, 1).map((tradeoff) => (
                    <span className="text-[var(--muted)]" key={tradeoff}>
                      Check: {tradeoff}
                    </span>
                  ))}
                </div>
              </article>
            ))
          : ["Investment", "Winter living", "Family fit"].map((label) => (
              <span
                className="border-l-4 border-[var(--blue)] bg-white px-4 py-3.5 font-black"
                key={label}
              >
                {label}
              </span>
            ))}
        {selectedProperties.length ? (
          <p className="m-0 text-[0.8rem] font-bold leading-normal text-[var(--muted)]">
            {comparison
              ? `Compared ${comparison.comparedPropertyIds.length} listings across investment, living, family, and relocation fit.`
              : canRunCompare
                ? "Run AI compare to get purpose-specific winners from the selected listings."
                : "Select one more listing to unlock AI compare."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function formatPurpose(purpose: string) {
  return purpose.replace("-", " ");
}

"use client";

import type { PropertySnapshot } from "@propertyflow/domain";
import { useCompareSelectionStore } from "@features/property-compare/model/compare-selection-store";

export function CompareBand({ properties }: { properties: PropertySnapshot[] }) {
  const selectedPropertyIds = useCompareSelectionStore((state) => state.selectedPropertyIds);
  const clearSelection = useCompareSelectionStore((state) => state.clearSelection);
  const selectedProperties = selectedPropertyIds
    .map((propertyId) => properties.find((property) => property.id === propertyId))
    .filter((property): property is PropertySnapshot => Boolean(property));

  return (
    <section className="mx-auto mb-12 grid max-w-[1320px] grid-cols-1 items-center gap-7 border-t border-[var(--line)] px-[clamp(18px,4vw,54px)] py-[54px] min-[761px]:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <p className="section-kicker">AI Compare</p>
        <h2 className="mt-2 max-w-[760px] text-[clamp(1.8rem,3.2vw,3.4rem)] leading-tight">
          {selectedProperties.length
            ? `Ready to compare ${selectedProperties.length} selected ${selectedProperties.length === 1 ? "listing" : "listings"}.`
            : "Wongamat for living, Terminal North for liquidity, Jomtien for family space."}
        </h2>
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
      </div>
      <div className="grid min-w-[220px] gap-2.5">
        <span className="border-l-4 border-[var(--blue)] bg-white px-4 py-3.5 font-black">Investment</span>
        <span className="border-l-4 border-[var(--blue)] bg-white px-4 py-3.5 font-black">Winter living</span>
        <span className="border-l-4 border-[var(--blue)] bg-white px-4 py-3.5 font-black">Family fit</span>
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
    </section>
  );
}

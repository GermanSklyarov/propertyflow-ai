"use client";

import type { PropertySnapshot } from "@propertyflow/domain";
import { useCompareSelectionStore } from "@features/property-compare/model/compare-selection-store";

export function CompareBand({ properties }: { properties: PropertySnapshot[] }) {
  const selectedPropertyIds = useCompareSelectionStore((state) => state.selectedPropertyIds);
  const clearSelection = useCompareSelectionStore((state) => state.clearSelection);
  const selectedProperties = selectedPropertyIds
    .map((propertyId) => properties.find((property) => property.id === propertyId))
    .filter((property): property is PropertySnapshot => Boolean(property));
  const compareInsights = selectedProperties.length ? buildCompareInsights(selectedProperties) : [];

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
      <div className="grid min-w-[220px] gap-2.5 min-[761px]:min-w-[320px]">
        {compareInsights.length
          ? compareInsights.map((insight) => (
              <article className="border-l-4 border-[var(--blue)] bg-white px-4 py-3.5" key={insight.label}>
                <p className="m-0 text-[0.76rem] font-black uppercase text-[var(--muted)]">{insight.label}</p>
                <h3 className="mb-1.5 mt-1 text-[1rem]">{insight.property.title}</h3>
                <p className="m-0 text-[0.84rem] font-bold leading-normal text-[#52615d]">{insight.reason}</p>
              </article>
            ))
          : ["Investment", "Winter living", "Family fit"].map((label) => (
              <span className="border-l-4 border-[var(--blue)] bg-white px-4 py-3.5 font-black" key={label}>
                {label}
              </span>
            ))}
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

function buildCompareInsights(properties: PropertySnapshot[]) {
  return [
    {
      label: "Investment",
      property: pickBest(properties, investmentScore),
      reason: "Best gross yield signal among the selected listings."
    },
    {
      label: "Winter living",
      property: pickBest(properties, winterLivingScore),
      reason: "Strongest day-to-day fit for beach access, internet, and calmer living."
    },
    {
      label: "Family fit",
      property: pickBest(properties, familyScore),
      reason: "Most comfortable selected option for space, bedrooms, and quieter area fit."
    }
  ];
}

function pickBest(properties: PropertySnapshot[], score: (property: PropertySnapshot) => number) {
  return properties.reduce((bestProperty, property) => (score(property) > score(bestProperty) ? property : bestProperty));
}

function investmentScore(property: PropertySnapshot) {
  if (!property.monthlyRentEstimate || property.price.amount <= 0) {
    return 0;
  }

  return (property.monthlyRentEstimate.amount * 12) / property.price.amount;
}

function winterLivingScore(property: PropertySnapshot) {
  const beachScore = property.beachDistanceMeters ? Math.max(0, 1_200 - property.beachDistanceMeters) / 1_200 : 0;
  const internetScore = property.amenities.some((amenity) => amenity.includes("internet") || amenity.includes("coworking")) ? 1 : 0;
  const quietScore = property.address?.toLowerCase().includes("jomtien") || property.address?.toLowerCase().includes("wongamat") ? 1 : 0;

  return beachScore + internetScore + quietScore;
}

function familyScore(property: PropertySnapshot) {
  const quietScore = property.address?.toLowerCase().includes("jomtien") ? 1.5 : 0;
  const familyAmenityScore = property.amenities.some((amenity) => amenity.includes("family") || amenity.includes("playground"))
    ? 1
    : 0;

  return property.bedrooms * 1.4 + property.areaSqm / 60 + quietScore + familyAmenityScore;
}

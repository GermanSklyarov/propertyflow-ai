import dynamic from "next/dynamic";
import type { PropertySnapshot } from "@propertyflow/domain";
import { buildMarketSnapshot } from "@entities/property/model/market-snapshot";
import { productPositioning } from "@shared/config/product-positioning";
import { Metric } from "@shared/ui/metric";
import styles from "./home-hero.module.css";

const ConciergeConsole = dynamic(
  () =>
    import("@features/ai-concierge/ui/concierge-console").then(
      (module) => module.ConciergeConsole,
    ),
  {
    loading: () => (
      <div className="grid min-h-[520px] place-items-center border border-white/30 bg-[rgba(250,252,248,0.9)] p-[clamp(18px,2vw,26px)] text-[var(--muted)] shadow-[var(--shadow)] backdrop-blur-2xl">
        Loading AI console...
      </div>
    ),
  },
);

export function HomeHero({ properties }: { properties: PropertySnapshot[] }) {
  const marketSnapshot = buildMarketSnapshot(properties);

  return (
    <section className={`relative overflow-hidden ${styles.root}`}>
      <div
        className="absolute inset-0 scale-[1.02] bg-[linear-gradient(90deg,rgba(8,22,20,0.9),rgba(8,22,20,0.58)_48%,rgba(8,22,20,0.18)),url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2200&q=85')] bg-cover bg-center"
        aria-hidden="true"
      />
      <nav
        className={`relative z-[1] flex justify-between gap-6 text-white ${styles.nav}`}
        aria-label="Primary"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-[42px] place-items-center border border-white/40 bg-white/10 font-extrabold">
            PF
          </span>
          <strong className="text-[0.98rem]">PropertyFlow AI</strong>
        </div>
        <div
          className={`gap-[22px] text-[0.92rem] text-white/80 ${styles.navLinks}`}
        >
          <a href="#search">Search</a>
          <a href="#recommendations">Listings</a>
          <a href="#market">Market</a>
        </div>
      </nav>

      <div
        className={`relative z-[1] mx-auto grid max-w-[1320px] grid-cols-1 items-center gap-[clamp(24px,5vw,72px)] ${styles.layout}`}
      >
        <section className="text-white" id="search">
          <p className="eyebrow">Thailand property intelligence</p>
          <h1
            className={`mb-[18px] mt-3.5 max-w-[820px] leading-none ${styles.title}`}
          >
            {productPositioning.headline}
          </h1>
          <p className="m-0 max-w-[680px] text-[clamp(1.05rem,1.6vw,1.35rem)] leading-relaxed text-white/80">
            {productPositioning.promise}
          </p>
          <div
            className="mt-[34px] flex flex-wrap gap-3"
            aria-label="Market snapshot"
          >
            {marketSnapshot.heroMetrics.map((metric) => (
              <Metric
                value={metric.value}
                label={metric.label}
                key={metric.label}
              />
            ))}
          </div>
        </section>

        <ConciergeConsole />
      </div>
    </section>
  );
}

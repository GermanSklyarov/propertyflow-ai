import dynamic from "next/dynamic";
import type { PropertySnapshot } from "@propertyflow/domain";
import { productPositioning } from "../../../shared/config/product-positioning";
import { Metric } from "../../../shared/ui/metric";

const ConciergeConsole = dynamic(
  () => import("../../../features/ai-concierge/ui/concierge-console").then((module) => module.ConciergeConsole),
  {
    loading: () => <div className="concierge-panel concierge-loading">Loading AI console...</div>
  }
);

export function HomeHero({ properties }: { properties: PropertySnapshot[] }) {
  return (
    <section className="hero-section">
      <div className="hero-media" aria-hidden="true" />
      <nav className="top-nav" aria-label="Primary">
        <div className="brand-mark">
          <span>PF</span>
          <strong>PropertyFlow AI</strong>
        </div>
        <div className="nav-links">
          <a href="#search">Search</a>
          <a href="#recommendations">Listings</a>
          <a href="#market">Market</a>
        </div>
      </nav>

      <div className="hero-content">
        <section className="hero-copy" id="search">
          <p className="eyebrow">Thailand property intelligence</p>
          <h1>{productPositioning.headline}</h1>
          <p className="hero-promise">{productPositioning.promise}</p>
          <div className="hero-stats" aria-label="Market snapshot">
            <Metric value={`${properties.length}+`} label="Curated matches" />
            <Metric value="6.7%" label="Yield signal" />
            <Metric value="4.8/5" label="Walkability fit" />
          </div>
        </section>

        <ConciergeConsole />
      </div>
    </section>
  );
}

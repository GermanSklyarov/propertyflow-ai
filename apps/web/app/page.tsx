import dynamic from "next/dynamic";
import { ArrowUpRight, Bath, BedDouble, Building2, MapPin, Ruler, Waves } from "lucide-react";
import type { PropertySnapshot } from "@propertyflow/domain";
import { productPositioning } from "../src/product-positioning";
import { listFeaturedProperties } from "../src/lib/propertyflow-api";

const ConciergeConsole = dynamic(
  () => import("../src/components/concierge-console").then((module) => module.ConciergeConsole),
  {
    loading: () => <div className="concierge-panel concierge-loading">Loading AI console...</div>
  }
);

export default async function HomePage() {
  const properties = await listFeaturedProperties();
  const featured = properties[0];

  return (
    <main>
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

      <section className="market-strip" id="market">
        <div>
          <p className="section-kicker">Live decision layer</p>
          <h2>Search results shaped by lifestyle, yield, and relocation fit.</h2>
        </div>
        <div className="market-metrics">
          <Metric value="Pattaya" label="Primary market" />
          <Metric value="30s" label="Advisor refresh" />
          <Metric value="SSR" label="Initial feed" />
        </div>
      </section>

      <section className="listing-section" id="recommendations">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Recommended now</p>
            <h2>{featured ? `Start with ${featured.market}` : "Start with Pattaya"}</h2>
          </div>
          <a className="text-action" href="#search">
            Refine with AI <ArrowUpRight size={16} />
          </a>
        </div>

        <div className="property-grid">
          {properties.map((property, index) => (
            <PropertyCard key={property.id} property={property} priority={index === 0} />
          ))}
        </div>
      </section>

      <section className="compare-band">
        <div>
          <p className="section-kicker">AI Compare</p>
          <h2>Wongamat for living, Terminal North for liquidity, Jomtien for family space.</h2>
        </div>
        <div className="compare-points">
          <span>Investment</span>
          <span>Winter living</span>
          <span>Family fit</span>
        </div>
      </section>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PropertyCard({ property, priority }: { property: PropertySnapshot; priority?: boolean }) {
  const imageUrl = propertyImage(property, priority);
  const yieldEstimate =
    property.monthlyRentEstimate && property.price.amount > 0
      ? ((property.monthlyRentEstimate.amount * 12) / property.price.amount) * 100
      : undefined;

  return (
    <article className="property-card">
      <div className="property-image-wrap">
        <img src={imageUrl} alt={property.title} loading={priority ? "eager" : "lazy"} />
        <span className="market-pill">{property.market}</span>
      </div>
      <div className="property-body">
        <div className="property-title-row">
          <div>
            <h3>{property.title}</h3>
            <p>
              <MapPin size={14} />
              {property.address ?? property.market}
            </p>
          </div>
          <strong>{formatPrice(property.price.amount)}</strong>
        </div>
        <p className="property-description">{property.description}</p>
        <div className="property-facts">
          <span>
            <BedDouble size={15} />
            {property.bedrooms}
          </span>
          <span>
            <Bath size={15} />
            {property.bathrooms}
          </span>
          <span>
            <Ruler size={15} />
            {property.areaSqm} sqm
          </span>
          <span>
            <Waves size={15} />
            {property.beachDistanceMeters ? `${property.beachDistanceMeters}m` : "nearby"}
          </span>
        </div>
        <div className="signal-row">
          <span>{yieldEstimate ? `${yieldEstimate.toFixed(1)}% gross yield` : "Yield pending"}</span>
          <span>{property.amenities.slice(0, 2).join(" / ")}</span>
        </div>
      </div>
    </article>
  );
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-US", {
    compactDisplay: "short",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
    currency: "THB"
  }).format(amount);
}

function propertyImage(property: PropertySnapshot, priority?: boolean) {
  if (priority) {
    return "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=85";
  }

  if (property.bedrooms >= 2) {
    return "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85";
  }

  if (property.address?.toLowerCase().includes("terminal")) {
    return "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=85";
  }

  return "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=85";
}

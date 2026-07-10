import { Bath, BedDouble, MapPin, Ruler, Waves } from "lucide-react";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatCompactThb } from "../../../shared/lib/format-money";
import { propertyImage } from "../lib/property-image";

export function PropertyCard({ property, priority }: { property: PropertySnapshot; priority?: boolean }) {
  const imageUrl = propertyImage(property, priority);
  const yieldEstimate =
    property.monthlyRentEstimate && property.price.amount > 0
      ? ((property.monthlyRentEstimate.amount * 12) / property.price.amount) * 100
      : undefined;

  return (
    <article className="property-card">
      <div className="property-image-wrap">
        <img src={imageUrl} alt={property.title} loading={priority ? "eager" : "lazy"} />
        <span className="market-pill">{listingLabel(property.listingType)} · {property.market}</span>
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
          <strong title={primaryPrice(property)}>{primaryPrice(property)}</strong>
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

function primaryPrice(property: PropertySnapshot) {
  if (property.listingType === "rent" && property.rentalPriceMonthly) {
    return `${formatCompactThb(property.rentalPriceMonthly.amount)}/mo`;
  }

  if (property.listingType === "sale_or_rent" && property.rentalPriceMonthly) {
    return `${formatCompactThb(property.price.amount)} · ${formatCompactThb(property.rentalPriceMonthly.amount)}/mo`;
  }

  return formatCompactThb(property.price.amount);
}

function listingLabel(listingType: PropertySnapshot["listingType"]) {
  if (listingType === "sale_or_rent") {
    return "sale/rent";
  }

  return listingType;
}

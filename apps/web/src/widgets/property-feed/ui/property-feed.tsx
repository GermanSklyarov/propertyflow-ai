import { ArrowUpRight } from "lucide-react";
import type { PropertySnapshot } from "@propertyflow/domain";
import { ListingIntentFilter } from "../../../features/listing-intent-filter/ui/listing-intent-filter";

export function PropertyFeed({ properties }: { properties: PropertySnapshot[] }) {
  const featured = properties[0];

  return (
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

      <ListingIntentFilter properties={properties} />
    </section>
  );
}

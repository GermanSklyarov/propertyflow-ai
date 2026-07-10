import { ArrowUpRight } from "lucide-react";
import type { PropertySnapshot } from "@propertyflow/domain";
import { ListingIntentFilter } from "../../../features/listing-intent-filter/ui/listing-intent-filter";

export function PropertyFeed({ properties }: { properties: PropertySnapshot[] }) {
  const featured = properties[0];

  return (
    <section className="mx-auto max-w-[1320px] px-[clamp(18px,4vw,54px)] pb-[54px] pt-5" id="recommendations">
      <div className="mb-[22px] grid items-end gap-6 min-[761px]:flex min-[761px]:justify-between">
        <div>
          <p className="section-kicker">Recommended now</p>
          <h2 className="mt-2 max-w-[760px] text-[clamp(1.8rem,3.2vw,3.4rem)] leading-tight">
            {featured ? `Start with ${featured.market}` : "Start with Pattaya"}
          </h2>
        </div>
        <a
          className="inline-flex items-center gap-2 whitespace-nowrap border border-[var(--line)] bg-white/70 px-2.5 py-2 text-[0.78rem] font-extrabold text-[var(--teal-dark)]"
          href="#search"
        >
          Refine with AI <ArrowUpRight size={16} />
        </a>
      </div>

      <ListingIntentFilter properties={properties} />
    </section>
  );
}

import { Metric } from "../../../shared/ui/metric";

export function MarketStrip() {
  return (
    <section
      className="mx-auto flex max-w-[1320px] items-end justify-between gap-7 px-[clamp(18px,4vw,54px)] py-[54px] max-[760px]:grid"
      id="market"
    >
      <div>
        <p className="section-kicker">Live decision layer</p>
        <h2 className="mt-2 max-w-[760px] text-[clamp(1.8rem,3.2vw,3.4rem)] leading-tight">
          Search results shaped by lifestyle, yield, and relocation fit.
        </h2>
      </div>
      <div className="mt-[34px] flex flex-wrap gap-3">
        <Metric value="Pattaya" label="Primary market" variant="surface" />
        <Metric value="30s" label="Advisor refresh" variant="surface" />
        <Metric value="SSR" label="Initial feed" variant="surface" />
      </div>
    </section>
  );
}

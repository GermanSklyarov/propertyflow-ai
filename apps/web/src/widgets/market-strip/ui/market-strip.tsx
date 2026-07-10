import { Metric } from "../../../shared/ui/metric";

export function MarketStrip() {
  return (
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
  );
}

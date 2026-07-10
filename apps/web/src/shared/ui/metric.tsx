export function Metric({
  value,
  label,
  variant = "glass"
}: {
  value: string;
  label: string;
  variant?: "glass" | "surface";
}) {
  const classes =
    variant === "surface"
      ? "min-w-[132px] border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3.5 text-[var(--ink)]"
      : "min-w-[132px] border border-white/20 bg-white/10 px-4 py-3.5 text-white backdrop-blur-[18px]";
  const labelClass = variant === "surface" ? "mt-1 block text-[0.82rem] text-[var(--muted)]" : "mt-1 block text-[0.82rem] text-white/70";

  return (
    <div className={classes}>
      <strong className="block text-[1.35rem]">{value}</strong>
      <span className={labelClass}>{label}</span>
    </div>
  );
}

export function CompareBand() {
  return (
    <section className="mx-auto mb-12 grid max-w-[1320px] grid-cols-1 items-center gap-7 border-t border-[var(--line)] px-[clamp(18px,4vw,54px)] py-[54px] min-[761px]:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <p className="section-kicker">AI Compare</p>
        <h2 className="mt-2 max-w-[760px] text-[clamp(1.8rem,3.2vw,3.4rem)] leading-tight">
          Wongamat for living, Terminal North for liquidity, Jomtien for family space.
        </h2>
      </div>
      <div className="grid min-w-[220px] gap-2.5">
        <span className="border-l-4 border-[var(--blue)] bg-white px-4 py-3.5 font-black">Investment</span>
        <span className="border-l-4 border-[var(--blue)] bg-white px-4 py-3.5 font-black">Winter living</span>
        <span className="border-l-4 border-[var(--blue)] bg-white px-4 py-3.5 font-black">Family fit</span>
      </div>
    </section>
  );
}

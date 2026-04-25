const TAPE = [
  { sym: "NVDA", px: "142.18", chg: "+3.42%" },
  { sym: "SPX", px: "5,981.4", chg: "+0.18%" },
  { sym: "BTC", px: "94,210", chg: "−1.04%" },
  { sym: "VIX", px: "13.42", chg: "−2.18%" },
  { sym: "MSFT", px: "428.91", chg: "+0.62%" },
  { sym: "TSLA", px: "238.07", chg: "−4.91%" },
  { sym: "AAPL", px: "232.10", chg: "+0.91%" },
  { sym: "META", px: "612.40", chg: "+1.21%" },
  { sym: "AMZN", px: "208.55", chg: "+0.42%" },
  { sym: "GOOGL", px: "189.64", chg: "−0.18%" },
  { sym: "JPM", px: "248.71", chg: "+0.32%" },
  { sym: "GS", px: "601.93", chg: "+0.18%" },
  { sym: "USDJPY", px: "154.18", chg: "+0.04%" },
  { sym: "DXY", px: "108.41", chg: "+0.12%" },
  { sym: "10Y", px: "4.418%", chg: "+1.4 bps" },
];

export function MarqueeTicker() {
  return (
    <div className="no-scrollbar relative h-9 w-full overflow-hidden border-y border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="animate-ticker flex h-full w-max items-center gap-10 whitespace-nowrap pl-10 font-mono text-xs">
        {[...TAPE, ...TAPE].map((row, i) => {
          const up = row.chg.trim().startsWith("+") || row.chg.includes("bps");
          return (
            <span key={i} className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-[var(--color-fg)]">
                {row.sym}
              </span>
              <span className="tabular-nums text-[var(--color-fg-muted)]">
                {row.px}
              </span>
              <span
                className="tabular-nums"
                style={{
                  color: up ? "var(--color-up)" : "var(--color-down)",
                }}
              >
                {row.chg}
              </span>
              <span className="text-[var(--color-fg-faint)]">·</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

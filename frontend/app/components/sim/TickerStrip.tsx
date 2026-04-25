"use client";

const TICKERS = [
  { symbol: "NVDA", price: 142.18, change: 2.34 },
  { symbol: "AAPL", price: 219.4, change: -0.42 },
  { symbol: "MSFT", price: 419.1, change: 0.88 },
  { symbol: "TSLA", price: 248.66, change: -1.92 },
  { symbol: "GOOGL", price: 168.07, change: 0.31 },
  { symbol: "AMZN", price: 188.95, change: 1.04 },
  { symbol: "META", price: 522.13, change: -0.18 },
  { symbol: "AMD", price: 148.27, change: 3.12 },
  { symbol: "AVGO", price: 1612.88, change: 0.74 },
  { symbol: "BTC", price: 67340.0, change: -2.18 },
  { symbol: "ETH", price: 2837.57, change: -1.04 },
  { symbol: "SPX", price: 5743.21, change: 0.16 },
  { symbol: "VIX", price: 15.47, change: -3.4 },
  { symbol: "DXY", price: 104.62, change: 0.12 },
  { symbol: "US10Y", price: 4.218, change: 0.04 },
];

export function TickerStrip() {
  const items = [...TICKERS, ...TICKERS];
  return (
    <div className="overflow-hidden border-y border-[var(--color-line)] bg-[var(--color-surface)] py-2">
      <div className="flex w-max animate-ticker gap-8 whitespace-nowrap px-6">
        {items.map((t, i) => {
          const tone =
            t.change > 0
              ? "var(--color-up)"
              : t.change < 0
                ? "var(--color-down)"
                : "var(--color-fg-muted)";
          return (
            <span
              key={`${t.symbol}-${i}`}
              className="flex items-center gap-2 font-mono text-[11px] tabular-nums"
            >
              <span className="text-[var(--color-fg-muted)]">{t.symbol}</span>
              <span className="text-[var(--color-fg)]">
                {t.price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span style={{ color: tone }}>
                {t.change > 0 ? "+" : ""}
                {t.change.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

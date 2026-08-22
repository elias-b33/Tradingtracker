import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getDeskNews } from "@/lib/market/news";
import { formatPct, formatPrice, formatRelativeTime } from "@/lib/market/format";
import { assetName, baseAsset } from "@/lib/market/symbols";
import { holdingPnl, upcomingEvents, watchlistMovers } from "@/lib/briefing";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/lib/store";
import { CoinIcon } from "./coin-icon";

export function BriefingSheet() {
  const open = useTerminalStore((s) => s.briefingOpen);
  const setBriefingOpen = useTerminalStore((s) => s.setBriefingOpen);
  const lastSeenAt = useTerminalStore((s) => s.lastSeenAt);
  const lastQuotes = useTerminalStore((s) => s.lastQuotes);
  const quotes = useTerminalStore((s) => s.quotes);
  const watchlist = useTerminalStore((s) => s.watchlist);
  const holdings = useTerminalStore((s) => s.holdings);
  const events = useTerminalStore((s) => s.events);
  const alertLog = useTerminalStore((s) => s.alertLog);
  const setSymbol = useTerminalStore((s) => s.setSymbol);

  const movers = watchlistMovers(watchlist, lastQuotes, quotes);
  const notable = movers.filter((row) => Math.abs(row.sincePct) >= 0.4);
  const coming = upcomingEvents(events, 7);
  const missed = lastSeenAt
    ? alertLog.filter((entry) => entry.at >= lastSeenAt - 60_000)
    : [];
  const bag = holdings
    .map((h) => ({ holding: h, ...holdingPnl(h, quotes[h.symbol]?.lastPrice) }))
    .filter((row) => row.holding.qty > 0);

  const news = useQuery({
    queryKey: ["desk-news", watchlist.join(",")],
    queryFn: () => getDeskNews({ data: { symbols: watchlist } }),
    staleTime: 90_000,
    enabled: open,
  });
  const headlines = news.data?.ok ? news.data.items : [];
  const movedNames = new Set(notable.map((m) => m.symbol));
  const newsForMovers = headlines.filter((item) => item.symbol && movedNames.has(item.symbol));
  const newsRows = (newsForMovers.length ? newsForMovers : headlines).slice(0, 6);

  const ago = lastSeenAt ? formatRelativeTime(lastSeenAt) : null;

  return (
    <Dialog open={open} onOpenChange={setBriefingOpen}>
      <DialogContent className="z-[60] flex max-h-[84dvh] w-[min(100%-1.25rem,28rem)] flex-col overflow-hidden p-0">
        <div className="shrink-0 border-b border-border px-4 py-3 pr-10">
          <DialogTitle>Since you left</DialogTitle>
          <DialogDescription>
            {ago ? `Last look ${ago}` : "Your coins, not the whole tape."}
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-5">
            {bag.length > 0 && (
              <section>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Bag</p>
                <ul className="mt-1.5 space-y-1">
                  {bag.map(({ holding, value, pnl, pnlPct }) => {
                    const up = pnl >= 0;
                    return (
                      <li key={holding.symbol}>
                        <button
                          type="button"
                          onClick={() => {
                            setSymbol(holding.symbol);
                            setBriefingOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left hover:bg-elevated"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <CoinIcon symbol={holding.symbol} size={20} />
                            <span>
                              <span className="text-sm font-medium">{baseAsset(holding.symbol)}</span>
                              <span className="ml-2 font-mono text-xs text-muted">
                                {holding.qty} · {formatPrice(value)}
                              </span>
                            </span>
                          </span>
                          <span className={cn("font-mono text-xs", up ? "text-up" : "text-down")}>
                            {formatPct(pnlPct)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section>
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Since last look</p>
              {notable.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Quiet. No coin moved enough to wake you.</p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {notable.slice(0, 8).map((row) => {
                    const up = row.sincePct >= 0;
                    return (
                      <li key={row.symbol}>
                        <button
                          type="button"
                          onClick={() => {
                            setSymbol(row.symbol);
                            setBriefingOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left hover:bg-elevated"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <CoinIcon symbol={row.symbol} size={20} />
                            <span>
                              <span className="text-sm font-medium">{baseAsset(row.symbol)}</span>
                              <span className="ml-2 text-xs text-muted">{assetName(row.symbol)}</span>
                            </span>
                          </span>
                          <span className="text-right">
                            <span className={cn("block font-mono text-sm", up ? "text-up" : "text-down")}>
                              {formatPct(row.sincePct)}
                            </span>
                            <span className="block font-mono text-xs text-subtle">
                              day {formatPct(row.dayPct)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {missed.length > 0 && (
              <section>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Alerts</p>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {missed.slice(0, 6).map((entry) => (
                    <li key={entry.id} className="text-fg">
                      {entry.text}
                      <span className="ml-2 text-xs text-muted">{formatRelativeTime(entry.at)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {coming.length > 0 && (
              <section>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Coming up</p>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {coming.map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSymbol(event.symbol);
                          setBriefingOpen(false);
                        }}
                        className="text-left hover:text-accent"
                      >
                        <span className="font-medium">{baseAsset(event.symbol)}</span>
                        <span className="text-muted"> · {event.date} · {event.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Why it moved</p>
              {news.isLoading && <p className="mt-2 text-sm text-muted">Fetching headlines…</p>}
              {news.data && !news.data.ok && (
                <p className="mt-2 text-sm text-muted">{news.data.error}</p>
              )}
              <ul className="mt-1.5 divide-y divide-border">
                {newsRows.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block py-2 hover:text-accent"
                    >
                      <p className="text-sm leading-snug">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {item.symbol ? `${baseAsset(item.symbol)} · ` : ""}
                        {item.source} · {formatRelativeTime(item.publishedAt)}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CatchUpButton({ className }: { className?: string }) {
  const lastSeenAt = useTerminalStore((s) => s.lastSeenAt);
  const lastQuotes = useTerminalStore((s) => s.lastQuotes);
  const quotes = useTerminalStore((s) => s.quotes);
  const watchlist = useTerminalStore((s) => s.watchlist);
  const setBriefingOpen = useTerminalStore((s) => s.setBriefingOpen);
  const top = watchlistMovers(watchlist, lastQuotes, quotes)[0];
  if (!lastSeenAt) return null;

  return (
    <button
      type="button"
      onClick={() => setBriefingOpen(true)}
      className={cn("text-left text-xs text-muted hover:text-fg", className)}
    >
      {top && Math.abs(top.sincePct) >= 0.4 ? (
        <>
          <span className={top.sincePct >= 0 ? "text-up" : "text-down"}>
            {baseAsset(top.symbol)} {formatPct(top.sincePct)}
          </span>
          <span> since last look · Catch up</span>
        </>
      ) : (
        <>Catch up · last look {formatRelativeTime(lastSeenAt)}</>
      )}
    </button>
  );
}

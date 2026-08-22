import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Newspaper } from "lucide-react";
import { getDeskNews, getNews } from "@/lib/market/news";
import { formatPct, formatRelativeTime } from "@/lib/market/format";
import { assetName, baseAsset } from "@/lib/market/symbols";
import { cn } from "@/lib/utils";
import { useQuote, useTerminalStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CatchUpButton } from "./briefing-sheet";

export function NewsPanel({ scope = "symbol" }: { scope?: "symbol" | "desk" }) {
  const symbol = useTerminalStore((s) => s.symbol);
  const watchlist = useTerminalStore((s) => s.watchlist);
  const quote = useQuote(symbol);
  const name = assetName(symbol);
  const base = baseAsset(symbol);
  const desk = scope === "desk";
  const news = useQuery({
    queryKey: desk ? ["desk-news", watchlist.join(",")] : ["news", symbol],
    queryFn: () =>
      desk
        ? getDeskNews({ data: { symbols: watchlist } })
        : getNews({ data: { symbol } }),
    staleTime: 60_000,
    refetchInterval: 3 * 60_000,
  });

  const up = (quote?.priceChangePercent ?? 0) >= 0;
  const items = news.data?.ok ? news.data.items : [];

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="border-b border-border px-3 py-2.5">
        {desk && <CatchUpButton className="mb-2 block" />}
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          {desk ? "Market news" : `News · ${base}`}
        </p>
        {desk ? (
          <p className="mt-1 text-sm text-muted">Headlines across your watchlist.</p>
        ) : quote ? (
          <p className="mt-1 text-sm leading-snug">
            <span className={cn("font-mono font-medium", up ? "text-up" : "text-down")}>
              {formatPct(quote.priceChangePercent)}
            </span>
            <span className="text-muted"> today · {name}</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Loading {name}…</p>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {news.isLoading && (
          <div className="space-y-3 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {news.data && !news.data.ok && (
          <p className="px-3 py-8 text-center text-sm text-muted">{news.data.error}</p>
        )}

        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block border-b border-border px-3 py-3 hover:bg-elevated"
              >
                <p className="text-[15px] leading-snug text-fg">{item.title}</p>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                  <Newspaper className="size-3 shrink-0" />
                  <span className="truncate font-medium">
                    {item.symbol ? `${baseAsset(item.symbol)} · ` : ""}
                    {item.source}
                  </span>
                  <span className="text-subtle">·</span>
                  <span className="shrink-0">{formatRelativeTime(item.publishedAt)}</span>
                  <ExternalLink className="ml-auto size-3 shrink-0 opacity-0 group-hover:opacity-100" />
                </p>
              </a>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}

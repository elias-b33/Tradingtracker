import { useQuery } from "@tanstack/react-query";
import { getDeskSpanReturns, getSpanReturns, type SpanMove } from "@/lib/market/binance";
import { getStockDeskSpanReturns, getStockSpanReturns } from "@/lib/market/stocks";
import type { SpanId } from "@/lib/market/types";
import { useQuote, useTerminalStore } from "@/lib/store";

export function useSpanReturns(symbol: string) {
  const quote = useQuote(symbol);
  const venue = useTerminalStore((s) => s.venue);
  const query = useQuery({
    queryKey: ["span-returns", venue, symbol],
    queryFn: () =>
      venue === "stocks"
        ? getStockSpanReturns({ data: { symbol } })
        : getSpanReturns({ data: { symbol } }),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const returns: Partial<Record<SpanId, SpanMove | null>> = {
    ...(query.data?.ok ? query.data.returns : {}),
  };
  if (quote) {
    returns["1D"] = { pct: quote.priceChangePercent, delta: quote.priceChange };
  }

  return { returns, isLoading: query.isLoading };
}

export function useDeskSpanMoves(symbols: string[]) {
  const span = useTerminalStore((s) => s.span) ?? "1D";
  const venue = useTerminalStore((s) => s.venue);
  const quotes = useTerminalStore((s) => s.quotes);
  const query = useQuery({
    queryKey: ["desk-span-returns", venue, span, symbols.join(",")],
    queryFn: () =>
      venue === "stocks"
        ? getStockDeskSpanReturns({ data: { symbols, span } })
        : getDeskSpanReturns({ data: { symbols, span } }),
    enabled: span !== "1D" && symbols.length > 0,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const moves: Record<string, SpanMove | null> = {};
  for (const symbol of symbols) {
    if (span === "1D") {
      const q = quotes[symbol];
      moves[symbol] = q ? { pct: q.priceChangePercent, delta: q.priceChange } : null;
    } else {
      moves[symbol] = query.data?.ok ? (query.data.returns[symbol] ?? null) : null;
    }
  }

  return { moves, span, isLoading: span !== "1D" && query.isLoading };
}

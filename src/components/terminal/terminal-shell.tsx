import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Group, Panel, Separator } from "react-resizable-panels";
import { toast } from "sonner";
import { getTickers } from "@/lib/market/binance";
import { getStockTickers } from "@/lib/market/stocks";
import { INTERVALS } from "@/lib/market/types";
import { LIQUID_UNIVERSE } from "@/lib/market/symbols";
import { formatPct, formatPrice } from "@/lib/market/format";
import { pairLabel } from "@/lib/market/symbols";
import { connectTickerStream } from "@/lib/market/ws";
import { deskNotify } from "@/lib/notify";
import { useLayoutMode } from "@/hooks/use-is-desktop";
import { useTerminalStore } from "@/lib/store";
import { ChartView } from "./chart-view";
import { Watchlist } from "./watchlist";
import { MobileNav } from "./mobile-nav";
import { DeskSync } from "./desk-sync";
import { SymbolSearch } from "./symbol-search";
import { BriefingSheet } from "./briefing-sheet";
import { ChartToolbar } from "./chart-toolbar";
import { FloatingDrawToolbar, PhoneChartToolbar } from "./phone-chart-toolbar";
import { ExploreScreen, MenuScreen } from "./phone-screens";
import { SymbolOverview } from "./symbol-overview";
import { ChartBottomBar } from "./chart-bottom-bar";
import { DrawingToolbar } from "./drawing-toolbar";
import { RightPanelContent, RightRail } from "./right-panel";

export function TerminalShell() {
  useEffect(() => {
    void Promise.resolve(useTerminalStore.persist.rehydrate());
  }, []);

  const layout = useLayoutMode();
  const venue = useTerminalStore((s) => s.venue);
  const watchlist = useTerminalStore((s) => s.watchlist);
  const mobileTab = useTerminalStore((s) => s.mobileTab);
  const hydrateQuotes = useTerminalStore((s) => s.hydrateQuotes);
  const patchQuote = useTerminalStore((s) => s.patchQuote);

  const tickerSymbols = useMemo(() => {
    if (venue === "stocks") return [...new Set(watchlist)];
    const set = new Set<string>([...watchlist, ...LIQUID_UNIVERSE]);
    return [...set];
  }, [watchlist, venue]);

  const tickers = useQuery({
    queryKey: ["tickers", venue, tickerSymbols.join(",")],
    queryFn: () =>
      venue === "stocks"
        ? getStockTickers({ data: { symbols: tickerSymbols } })
        : getTickers({ data: { symbols: tickerSymbols } }),
    refetchInterval: venue === "stocks" ? 5_000 : 20_000,
  });

  useEffect(() => {
    if (tickers.data?.ok) {
      hydrateQuotes(tickers.data.quotes);
      useTerminalStore.getState().setFeedDegraded(false);
      try {
        sessionStorage.setItem(
          "aether-last-quotes",
          JSON.stringify(tickers.data.quotes),
        );
      } catch {
        /* ignore quota */
      }
    } else if (tickers.data && !tickers.data.ok) {
      useTerminalStore.getState().setFeedDegraded(true);
      try {
        const raw = sessionStorage.getItem("aether-last-quotes");
        if (raw && !Object.keys(useTerminalStore.getState().quotes).length) {
          hydrateQuotes(JSON.parse(raw));
        }
      } catch {
        /* ignore */
      }
    }
  }, [tickers.data, hydrateQuotes]);

  useEffect(() => {
    if (venue === "stocks") return;
    return connectTickerStream(tickerSymbols, patchQuote);
  }, [tickerSymbols, patchQuote, venue]);

  useAlertWatcher();
  useLastSeen();
  useKeyboard();

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-bg text-fg">
      <DeskSync />
      <BriefingSheet />
      {layout === "phone" ? (
        <PhoneDesk tab={mobileTab} />
      ) : layout ? (
        <WideDesk tablet={layout === "tablet"} />
      ) : (
        <div className="min-h-0 flex-1 bg-bg" />
      )}
      {layout === "phone" && <MobileNav />}
      <SymbolSearch />
    </div>
  );
}

function WideDesk({ tablet }: { tablet: boolean }) {
  const rightPanel = useTerminalStore((s) => s.rightPanel);
  const drawingRail = useTerminalStore((s) => s.drawingRail);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 bg-gap">
      <ChartToolbar />
      <div className="flex min-h-0 flex-1 gap-1">
        {drawingRail && <DrawingToolbar />}
        <Group
          key={rightPanel ? "with-panel" : "chart-only"}
          orientation="horizontal"
          className="h-full min-w-0 flex-1"
          id="desk-v2"
        >
          <Panel id="chart" minSize="45%" className="min-w-0">
            <div className="flex h-full min-h-0 flex-col bg-bg">
              <ChartView />
              <ChartBottomBar />
            </div>
          </Panel>
          {rightPanel && (
            <>
              <Separator className="w-1 bg-gap hover:bg-accent/40" />
              <Panel
                id="side"
                defaultSize={tablet ? "38%" : "24%"}
                minSize={tablet ? "28%" : "16%"}
                maxSize="45%"
                className="min-w-0"
              >
                <RightPanelContent />
              </Panel>
            </>
          )}
        </Group>
        <RightRail />
      </div>
    </div>
  );
}

function PhoneDesk({ tab }: { tab: string }) {
  const overviewOpen = useTerminalStore((s) => s.overviewOpen);
  const [drawing, setDrawing] = useState(false);
  if (tab === "watch") {
    return (
      <div className="desk-header flex min-h-0 flex-1 flex-col">
        {overviewOpen ? <SymbolOverview /> : <Watchlist />}
      </div>
    );
  }
  if (tab === "explore") {
    return (
      <div className="desk-header flex min-h-0 flex-1 flex-col">
        <ExploreScreen />
      </div>
    );
  }
  if (tab === "menu") {
    return (
      <div className="desk-header flex min-h-0 flex-1 flex-col">
        <MenuScreen />
      </div>
    );
  }
  return (
    <div className="desk-header flex min-h-0 flex-1 flex-col bg-bg">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ChartView />
        {drawing && <FloatingDrawToolbar onClose={() => setDrawing(false)} />}
      </div>
      <PhoneChartToolbar drawing={drawing} onToggleDrawing={() => setDrawing((v) => !v)} />
    </div>
  );
}

function useKeyboard() {
  const setSearchOpen = useTerminalStore((s) => s.setSearchOpen);
  const setInterval = useTerminalStore((s) => s.setInterval);
  const setDrawingTool = useTerminalStore((s) => s.setDrawingTool);
  const undoDrawing = useTerminalStore((s) => s.undoDrawing);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (typing) return;
      if (event.key === "z" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        undoDrawing();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
      }
      const tf = INTERVALS.find((item) => item.key === event.key);
      if (tf) setInterval(tf.id);
      if (event.key === "Escape") {
        setDrawingTool("cursor");
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSearchOpen, setInterval, setDrawingTool, undoDrawing]);
}

function useAlertWatcher() {
  const quotes = useTerminalStore((s) => s.quotes);
  const prev = useRef<Record<string, number>>({});

  useEffect(() => {
    const { alerts, markAlertFired, lastQuotes } = useTerminalStore.getState();
    for (const alert of alerts) {
      if (alert.triggeredAt) continue;
      const last = prev.current[alert.symbol] ?? lastQuotes[alert.symbol];
      const next = quotes[alert.symbol]?.lastPrice;
      if (last === undefined || next === undefined) continue;
      let hit = false;
      let text = "";
      if (alert.kind === "pct" && alert.percent && alert.price) {
        const prevMove = ((last - alert.price) / alert.price) * 100;
        const move = ((next - alert.price) / alert.price) * 100;
        hit =
          alert.direction === "above"
            ? prevMove < alert.percent && move >= alert.percent
            : prevMove > -alert.percent && move <= -alert.percent;
        text = `${pairLabel(alert.symbol)} ${formatPct(move)} from mark ${formatPrice(alert.price)}`;
      } else if (alert.price) {
        hit =
          alert.direction === "above"
            ? last < alert.price && next >= alert.price
            : last > alert.price && next <= alert.price;
        text = `${pairLabel(alert.symbol)} crossed ${formatPrice(alert.price)}`;
      }
      if (hit) {
        markAlertFired(alert.id, next, `${text} · now ${formatPrice(next)}`);
        toast.success(text, { description: `Now ${formatPrice(next)}` });
        deskNotify(text, `Now ${formatPrice(next)}`);
      }
    }
    for (const [symbol, quote] of Object.entries(quotes)) {
      prev.current[symbol] = quote.lastPrice;
    }
  }, [quotes]);
}

function useLastSeen() {
  const shown = useRef(false);
  const canStamp = useRef(false);

  useEffect(() => {
    const maybeOpen = () => {
      if (shown.current) return;
      if (!useTerminalStore.persist.hasHydrated()) return;
      const { lastSeenAt, setBriefingOpen, lastQuotes, quotes } = useTerminalStore.getState();
      if (!lastSeenAt || Date.now() - lastSeenAt < 10 * 60_000) return;
      if (!Object.keys(lastQuotes).length && !Object.keys(quotes).length) return;
      shown.current = true;
      setBriefingOpen(true);
    };
    const hide = () => {
      if (!canStamp.current && !shown.current) return;
      if (!useTerminalStore.persist.hasHydrated()) return;
      useTerminalStore.getState().stampLastSeen();
    };
    const vis = () => {
      if (document.visibilityState === "hidden") hide();
      else maybeOpen();
    };
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", vis);
    const unsub = useTerminalStore.persist.onFinishHydration(() => {
      window.setTimeout(maybeOpen, 800);
    });
    if (useTerminalStore.persist.hasHydrated()) {
      window.setTimeout(maybeOpen, 800);
    }
    const openTimer = window.setTimeout(maybeOpen, 2800);
    const armTimer = window.setTimeout(() => {
      canStamp.current = true;
    }, 6000);
    return () => {
      unsub();
      window.clearTimeout(openTimer);
      window.clearTimeout(armTimer);
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
}

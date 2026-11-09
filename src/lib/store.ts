import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_INDICATORS,
  type AlertLogEntry,
  type ChartType,
  type CoinEvent,
  type DrawingTool,
  type Holding,
  type IndicatorsState,
  type IntervalId,
  type MobileTab,
  type PriceScaleMode,
  type PriceAlert,
  type Quote,
  type SpanId,
  type StoredDrawing,
  type VenueId,
} from "@/lib/market/types";
import { DEFAULT_WATCHLIST } from "@/lib/market/symbols";
import { recommendedInterval } from "@/lib/market/spans";
import {
  DEFAULT_CRYPTO_SLICE,
  DEFAULT_STOCKS_SLICE,
  type VenueSlice,
} from "@/lib/market/venue";

export type RightPanel = "watchlist" | "alerts" | "news" | "book" | "tape" | "desk";

export type CloudStatus = "guest" | "loading" | "synced" | "saving" | "error";

export interface DeskPayload {
  venue: VenueId;
  desks: { crypto: VenueSlice; stocks: VenueSlice };
  symbol: string;
  interval: IntervalId;
  span: SpanId | null;
  chartType: ChartType;
  indicators: IndicatorsState;
  drawings: Record<string, StoredDrawing[]>;
  watchlist: string[];
  alerts: PriceAlert[];
  notes: Record<string, string>;
  events: CoinEvent[];
  lastSeenAt: number | null;
  lastQuotes: Record<string, number>;
  syncHoldings: boolean;
  holdings?: Holding[];
}

interface TerminalState extends DeskPayload {
  quotes: Record<string, Quote>;
  holdings: Holding[];
  alertLog: AlertLogEntry[];
  drawingTool: DrawingTool;
  searchOpen: boolean;
  briefingOpen: boolean;
  feedDegraded: boolean;
  phonePane: "plot" | "news";
  mobileTab: MobileTab;
  sideTab: "news" | "book" | "tape" | "desk";
  cloudStatus: CloudStatus;
  /** Chart preferences kept on this device only. */
  extendedHours: boolean;
  priceScaleMode: PriceScaleMode;
  autoScale: boolean;
  showCountdown: boolean;
  showGrid: boolean;
  drawingRail: boolean;
  setShowCountdown: (on: boolean) => void;
  setShowGrid: (on: boolean) => void;
  setDrawingRail: (on: boolean) => void;
  /** One-shot request for the chart to jump to a date (unix seconds). */
  goToTime: { at: number; nonce: number } | null;
  setGoToTime: (at: number) => void;
  rightPanel: RightPanel | null;
  setRightPanel: (panel: RightPanel | null) => void;
  setExtendedHours: (on: boolean) => void;
  setPriceScaleMode: (mode: PriceScaleMode) => void;
  setAutoScale: (on: boolean) => void;
  setSymbol: (symbol: string) => void;
  setInterval: (interval: IntervalId) => void;
  setSpan: (span: SpanId) => void;
  setChartType: (chartType: ChartType) => void;
  toggleIndicator: (key: keyof IndicatorsState) => void;
  setDrawingTool: (drawingTool: DrawingTool) => void;
  addDrawing: (drawing: StoredDrawing) => void;
  clearDrawings: () => void;
  undoDrawing: () => void;
  redoDrawing: () => void;
  redoStack: Record<string, StoredDrawing[]>;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  patchQuote: (quote: Quote) => void;
  hydrateQuotes: (quotes: Quote[]) => void;
  addAlert: (alert: Omit<PriceAlert, "id" | "createdAt">) => void;
  removeAlert: (id: string) => void;
  markAlertFired: (id: string, price?: number, text?: string) => void;
  rearmAlert: (id: string, markPrice?: number) => void;
  setNote: (symbol: string, note: string) => void;
  setHolding: (holding: Holding) => void;
  removeHolding: (symbol: string) => void;
  setSyncHoldings: (syncHoldings: boolean) => void;
  addEvent: (event: Omit<CoinEvent, "id">) => void;
  removeEvent: (id: string) => void;
  stampLastSeen: () => void;
  setBriefingOpen: (briefingOpen: boolean) => void;
  setFeedDegraded: (feedDegraded: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setPhonePane: (pane: "plot" | "news") => void;
  setMobileTab: (tab: MobileTab) => void;
  /** Phone: the symbol overview screen (TradingView app's details page). */
  overviewOpen: boolean;
  openOverview: (symbol: string) => void;
  closeOverview: () => void;
  setSideTab: (tab: "news" | "book" | "tape" | "desk") => void;
  hydrateDesk: (desk: DeskPayload) => void;
  setCloudStatus: (cloudStatus: CloudStatus) => void;
  setVenue: (venue: VenueId) => void;
}

let persistReady = false;

export function snapshotDesk(state: DeskPayload = useTerminalStore.getState()): DeskPayload {
  const slice: VenueSlice = {
    symbol: state.symbol,
    watchlist: state.watchlist,
    span: state.span,
    interval: state.interval,
  };
  return {
    venue: state.venue ?? "crypto",
    desks: {
      crypto: state.venue === "crypto" ? slice : (state.desks?.crypto ?? DEFAULT_CRYPTO_SLICE),
      stocks: state.venue === "stocks" ? slice : (state.desks?.stocks ?? DEFAULT_STOCKS_SLICE),
    },
    symbol: state.symbol,
    interval: state.interval,
    span: state.span,
    chartType: state.chartType,
    indicators: state.indicators,
    drawings: state.drawings,
    watchlist: state.watchlist,
    alerts: state.alerts,
    notes: state.notes,
    events: state.events,
    lastSeenAt: state.lastSeenAt,
    lastQuotes: state.lastQuotes,
    syncHoldings: state.syncHoldings,
    holdings: state.syncHoldings ? state.holdings : undefined,
  };
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      symbol: "BTCUSDT",
      interval: "1h",
      span: null,
      venue: "crypto",
      desks: { crypto: DEFAULT_CRYPTO_SLICE, stocks: DEFAULT_STOCKS_SLICE },
      chartType: "candles",
      indicators: DEFAULT_INDICATORS,
      drawingTool: "cursor",
      drawings: {},
      watchlist: [...DEFAULT_WATCHLIST],
      quotes: {},
      alerts: [],
      alertLog: [],
      notes: {},
      events: [],
      holdings: [],
      lastSeenAt: null,
      lastQuotes: {},
      syncHoldings: false,
      searchOpen: false,
      briefingOpen: false,
      feedDegraded: false,
      phonePane: "plot",
      mobileTab: "chart",
      sideTab: "news",
      cloudStatus: "guest",
      extendedHours: true,
      priceScaleMode: "normal",
      autoScale: true,
      showCountdown: true,
      showGrid: true,
      drawingRail: true,
      setShowCountdown: (showCountdown) => set({ showCountdown }),
      setShowGrid: (showGrid) => set({ showGrid }),
      setDrawingRail: (drawingRail) => set({ drawingRail }),
      rightPanel: "watchlist",
      goToTime: null,
      setGoToTime: (at) => set({ goToTime: { at, nonce: Date.now() } }),
      setRightPanel: (rightPanel) => set({ rightPanel }),
      setExtendedHours: (extendedHours) => set({ extendedHours }),
      setPriceScaleMode: (priceScaleMode) => set({ priceScaleMode }),
      setAutoScale: (autoScale) => set({ autoScale }),
      setSymbol: (symbol) =>
        set((s) => {
          const watchlist = s.watchlist.includes(symbol)
            ? s.watchlist
            : [symbol, ...s.watchlist].slice(0, 80);
          return {
            symbol,
            mobileTab: "chart",
            overviewOpen: false,
            sideTab: "news",
            watchlist,
            desks: { ...s.desks, [s.venue]: { ...s.desks[s.venue], symbol, watchlist } },
          };
        }),
      setVenue: (venue) =>
        set((s) => {
          if (s.venue === venue) return s;
          const current: VenueSlice = {
            symbol: s.symbol,
            watchlist: s.watchlist,
            span: s.span,
            interval: s.interval,
          };
          const desks = { ...s.desks, [s.venue]: current };
          const next = desks[venue] ?? (venue === "stocks" ? DEFAULT_STOCKS_SLICE : DEFAULT_CRYPTO_SLICE);
          return {
            venue,
            desks,
            symbol: next.symbol,
            watchlist: next.watchlist.length ? next.watchlist : [...next.watchlist],
            span: next.span,
            interval: next.interval,
            overviewOpen: false,
            sideTab: venue === "stocks" && s.sideTab === "tape" ? "news" : s.sideTab,
            rightPanel: venue === "stocks" && s.rightPanel === "tape" ? "watchlist" : s.rightPanel,
          };
        }),
      setInterval: (interval) =>
        set((s) => ({
          interval,
          span: null,
          desks: { ...s.desks, [s.venue]: { ...s.desks[s.venue], interval, span: null } },
        })),
      setSpan: (span) =>
        set((s) => {
          const interval = recommendedInterval(span);
          return {
            span,
            interval,
            desks: { ...s.desks, [s.venue]: { ...s.desks[s.venue], span, interval } },
          };
        }),
      setChartType: (chartType) => set({ chartType }),
      toggleIndicator: (key) =>
        set((s) => ({ indicators: { ...s.indicators, [key]: !s.indicators[key] } })),
      setDrawingTool: (drawingTool) => set({ drawingTool }),
      addDrawing: (drawing) =>
        set((s) => {
          const current = s.drawings[s.symbol] ?? [];
          return {
            drawings: { ...s.drawings, [s.symbol]: [...current, drawing] },
            redoStack: { ...s.redoStack, [s.symbol]: [] },
          };
        }),
      clearDrawings: () =>
        set((s) => ({ drawings: { ...s.drawings, [s.symbol]: [] } })),
      redoStack: {},
      undoDrawing: () =>
        set((s) => {
          const list = s.drawings[s.symbol] ?? [];
          const last = list[list.length - 1];
          if (!last) return s;
          return {
            drawings: { ...s.drawings, [s.symbol]: list.slice(0, -1) },
            redoStack: { ...s.redoStack, [s.symbol]: [...(s.redoStack[s.symbol] ?? []), last] },
          };
        }),
      redoDrawing: () =>
        set((s) => {
          const stack = s.redoStack[s.symbol] ?? [];
          const next = stack[stack.length - 1];
          if (!next) return s;
          return {
            drawings: { ...s.drawings, [s.symbol]: [...(s.drawings[s.symbol] ?? []), next] },
            redoStack: { ...s.redoStack, [s.symbol]: stack.slice(0, -1) },
          };
        }),
      addToWatchlist: (symbol) =>
        set((s) => {
          if (s.watchlist.includes(symbol) || s.watchlist.length >= 80) return s;
          const watchlist = [...s.watchlist, symbol];
          return { watchlist, desks: { ...s.desks, [s.venue]: { ...s.desks[s.venue], watchlist } } };
        }),
      removeFromWatchlist: (symbol) =>
        set((s) => {
          const watchlist = s.watchlist.filter((item) => item !== symbol);
          const fallback =
            s.symbol === symbol
              ? (watchlist[0] ?? (s.venue === "stocks" ? "AAPL" : "BTCUSDT"))
              : s.symbol;
          return {
            watchlist,
            symbol: fallback,
            desks: { ...s.desks, [s.venue]: { ...s.desks[s.venue], watchlist, symbol: fallback } },
          };
        }),
      patchQuote: (quote) =>
        set((s) => {
          const prev = s.quotes[quote.symbol];
          const last = quote.lastPrice;
          const session = quote.openPrice > 0;
          const open = session ? quote.openPrice : prev?.openPrice || 0;
          if (!open) {
            return {
              quotes: {
                ...s.quotes,
                [quote.symbol]: {
                  symbol: quote.symbol,
                  lastPrice: last,
                  openPrice: 0,
                  priceChange: 0,
                  priceChangePercent: 0,
                  highPrice: last,
                  lowPrice: last,
                  volume: prev?.volume ?? 0,
                  quoteVolume: prev?.quoteVolume ?? 0,
                },
              },
            };
          }
          return {
            quotes: {
              ...s.quotes,
              [quote.symbol]: {
                symbol: quote.symbol,
                lastPrice: last,
                openPrice: open,
                priceChange: last - open,
                priceChangePercent: ((last - open) / open) * 100,
                highPrice: session ? quote.highPrice : Math.max(prev?.highPrice ?? last, last),
                lowPrice: session ? quote.lowPrice : Math.min(prev?.lowPrice ?? last, last),
                volume: session ? quote.volume : prev?.volume ?? 0,
                quoteVolume: session ? quote.quoteVolume : prev?.quoteVolume ?? 0,
              },
            },
          };
        }),
      hydrateQuotes: (quotes) =>
        set((s) => {
          const next = { ...s.quotes };
          for (const q of quotes) next[q.symbol] = q;
          return { quotes: next };
        }),
      addAlert: (alert) =>
        set((s) => ({
          alerts: [
            ...s.alerts,
            {
              ...alert,
              kind: alert.kind ?? "level",
              id: crypto.randomUUID(),
              createdAt: Date.now(),
            },
          ],
        })),
      removeAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
      markAlertFired: (id, price, text) =>
        set((s) => {
          const alert = s.alerts.find((a) => a.id === id);
          if (!alert) return s;
          const at = Date.now();
          const entry: AlertLogEntry = {
            id: crypto.randomUUID(),
            alertId: id,
            symbol: alert.symbol,
            text: text ?? `${alert.symbol} ${alert.direction} ${alert.price}`,
            price: price ?? alert.price,
            at,
          };
          return {
            alerts: s.alerts.map((a) =>
              a.id === id ? { ...a, triggeredAt: at, firedPrice: entry.price } : a,
            ),
            alertLog: [entry, ...s.alertLog].slice(0, 40),
          };
        }),
      rearmAlert: (id, markPrice) =>
        set((s) => ({
          alerts: s.alerts.map((a) =>
            a.id === id
              ? {
                  ...a,
                  triggeredAt: undefined,
                  firedPrice: undefined,
                  price: a.kind === "pct" ? (markPrice ?? a.price) : a.price,
                  createdAt: Date.now(),
                }
              : a,
          ),
        })),
      setNote: (symbol, note) => set((s) => ({ notes: { ...s.notes, [symbol]: note } })),
      setHolding: (holding) =>
        set((s) => {
          const rest = s.holdings.filter((h) => h.symbol !== holding.symbol);
          const next = holding.qty > 0 ? [...rest, holding] : rest;
          return {
            holdings: next,
            watchlist: s.watchlist.includes(holding.symbol)
              ? s.watchlist
              : [holding.symbol, ...s.watchlist],
          };
        }),
      removeHolding: (symbol) =>
        set((s) => ({ holdings: s.holdings.filter((h) => h.symbol !== symbol) })),
      setSyncHoldings: (syncHoldings) => set({ syncHoldings }),
      addEvent: (event) =>
        set((s) => ({
          events: [...s.events, { ...event, id: crypto.randomUUID() }].slice(-80),
        })),
      removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      stampLastSeen: () =>
        set((s) => {
          const lastQuotes: Record<string, number> = { ...s.lastQuotes };
          for (const [symbol, quote] of Object.entries(s.quotes)) {
            if (Number.isFinite(quote.lastPrice) && quote.lastPrice > 0) {
              lastQuotes[symbol] = quote.lastPrice;
            }
          }
          return { lastSeenAt: Date.now(), lastQuotes };
        }),
      setBriefingOpen: (briefingOpen) =>
        set((s) => {
          if (!briefingOpen && s.briefingOpen) {
            const lastQuotes: Record<string, number> = { ...s.lastQuotes };
            for (const [symbol, quote] of Object.entries(s.quotes)) {
              if (Number.isFinite(quote.lastPrice) && quote.lastPrice > 0) {
                lastQuotes[symbol] = quote.lastPrice;
              }
            }
            return { briefingOpen: false, lastSeenAt: Date.now(), lastQuotes };
          }
          return { briefingOpen };
        }),
      setFeedDegraded: (feedDegraded) => set({ feedDegraded }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      setPhonePane: (phonePane) => set({ phonePane }),
      setMobileTab: (mobileTab) => set({ mobileTab, overviewOpen: false }),
      overviewOpen: false,
      openOverview: (symbol) =>
        set((s) => ({
          symbol,
          overviewOpen: true,
          desks: { ...s.desks, [s.venue]: { ...s.desks[s.venue], symbol } },
        })),
      closeOverview: () => set({ overviewOpen: false }),
      setSideTab: (sideTab) => set({ sideTab }),
      hydrateDesk: (desk) =>
        set((s) => {
          const venue = desk.venue === "stocks" ? "stocks" : "crypto";
          const desks = {
            crypto: desk.desks?.crypto ?? (venue === "crypto" ? {
              symbol: desk.symbol,
              watchlist: desk.watchlist.length ? desk.watchlist : [...DEFAULT_WATCHLIST],
              span: desk.span ?? null,
              interval: desk.interval,
            } : DEFAULT_CRYPTO_SLICE),
            stocks: desk.desks?.stocks ?? DEFAULT_STOCKS_SLICE,
          };
          const slice = desks[venue];
          return {
            venue,
            desks,
            symbol: slice.symbol,
            interval: slice.interval,
            span: slice.span,
            chartType: desk.chartType,
            indicators: { ...DEFAULT_INDICATORS, ...desk.indicators },
            drawings: desk.drawings,
            watchlist: slice.watchlist.length ? slice.watchlist : desks[venue].watchlist,
            alerts: (desk.alerts ?? []).map(normalizeAlert),
            notes: desk.notes,
            lastSeenAt:
              desk.lastSeenAt && s.lastSeenAt
                ? Math.max(desk.lastSeenAt, s.lastSeenAt)
                : (desk.lastSeenAt ?? s.lastSeenAt),
            lastQuotes:
              desk.lastQuotes && Object.keys(desk.lastQuotes).length
                ? desk.lastQuotes
                : s.lastQuotes,
            syncHoldings: desk.syncHoldings ?? s.syncHoldings,
            holdings:
              desk.syncHoldings && Array.isArray(desk.holdings)
                ? desk.holdings
                : s.holdings,
            events: desk.events && desk.events.length ? desk.events : s.events,
          };
        }),
      setCloudStatus: (cloudStatus) => set({ cloudStatus }),
    }),
    {
      name: "aether-terminal",
      skipHydration: true,
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => {
          if (!persistReady) return;
          localStorage.setItem(name, value);
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      onRehydrateStorage: () => () => {
        persistReady = true;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TerminalState>;
        return {
          ...current,
          ...p,
          alerts: (p.alerts ?? current.alerts).map(normalizeAlert),
          indicators: { ...DEFAULT_INDICATORS, ...p.indicators },
          events: p.events ?? [],
          holdings: p.holdings ?? [],
          alertLog: p.alertLog ?? [],
          lastQuotes: p.lastQuotes ?? {},
          lastSeenAt: p.lastSeenAt ?? null,
          syncHoldings: p.syncHoldings ?? false,
          venue: p.venue === "stocks" ? "stocks" : "crypto",
          desks: {
            crypto:
              p.desks?.crypto ??
              (p.venue === "stocks"
                ? DEFAULT_CRYPTO_SLICE
                : {
                    symbol: p.symbol ?? current.symbol,
                    watchlist: p.watchlist ?? current.watchlist,
                    span: p.span ?? null,
                    interval: p.interval ?? current.interval,
                  }),
            stocks: p.desks?.stocks ?? DEFAULT_STOCKS_SLICE,
          },
        };
      },
      partialize: (s) => ({
        ...snapshotDesk(s),
        holdings: s.holdings,
        alertLog: s.alertLog,
        sideTab: s.sideTab,
        extendedHours: s.extendedHours,
        priceScaleMode: s.priceScaleMode,
        rightPanel: s.rightPanel,
        showCountdown: s.showCountdown,
        showGrid: s.showGrid,
        drawingRail: s.drawingRail,
      }),
    },
  ),
);

function normalizeAlert(alert: PriceAlert): PriceAlert {
  return {
    ...alert,
    kind: alert.kind ?? (alert.percent ? "pct" : "level"),
    price: Number.isFinite(alert.price) ? alert.price : 0,
    direction: alert.direction === "below" ? "below" : "above",
  };
}

export function useQuote(symbol?: string): Quote | undefined {
  const active = useTerminalStore((s) => symbol ?? s.symbol);
  return useTerminalStore((s) => s.quotes[active]);
}

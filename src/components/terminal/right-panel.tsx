import { Activity, Bell, BookOpen, List, Newspaper, NotebookPen } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { useTerminalStore, type RightPanel as PanelId } from "@/lib/store";
import { AlertsPanel } from "./alerts-panel";
import { EventsPanel } from "./events-panel";
import { HoldingsPanel } from "./holdings-panel";
import { OrderBook, TradesTape } from "./market-side";
import { NewsPanel } from "./news-panel";
import { NotesPanel } from "./notes-panel";
import { SymbolDetails } from "./symbol-details";
import { Watchlist } from "./watchlist";

const ITEMS: Array<{ id: PanelId; label: string; icon: typeof List; crypto?: boolean }> = [
  { id: "watchlist", label: "Watchlist, details and news", icon: List },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "news", label: "News", icon: Newspaper },
  { id: "book", label: "Order book", icon: BookOpen },
  { id: "tape", label: "Trades", icon: Activity, crypto: true },
  { id: "desk", label: "Portfolio, events and notes", icon: NotebookPen },
];

/** Far-right icon rail that opens and closes the side widget, like TradingView. */
export function RightRail() {
  const panel = useTerminalStore((s) => s.rightPanel);
  const setPanel = useTerminalStore((s) => s.setRightPanel);
  const venue = useTerminalStore((s) => s.venue);
  const alertCount = useTerminalStore((s) => s.alerts.filter((a) => !a.triggeredAt).length);
  return (
    <nav
      aria-label="Side panels"
      className="flex w-[44px] shrink-0 flex-col items-center gap-1 bg-bg py-1.5"
    >
      {ITEMS.filter((item) => !item.crypto || venue === "crypto").map((item) => {
        const active = panel === item.id;
        const label = item.id === "book" && venue === "stocks" ? "Session" : item.label;
        return (
          <button
            key={item.id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => setPanel(active ? null : item.id)}
            className={cn(
              "relative flex size-9 items-center justify-center rounded-[4px] text-fg hover:bg-hover",
              active && "bg-hover text-accent",
            )}
          >
            <item.icon className="size-5" strokeWidth={1.5} />
            {item.id === "alerts" && alertCount > 0 && (
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-accent" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function RightPanelContent() {
  const panel = useTerminalStore((s) => s.rightPanel);
  const venue = useTerminalStore((s) => s.venue);

  if (panel === "watchlist") {
    return (
      <Group orientation="vertical" id="watch-details" className="h-full">
        <Panel id="watch-list" defaultSize="55%" minSize="20%">
          <Watchlist />
        </Panel>
        <Separator className="h-1 bg-gap hover:bg-accent/40" />
        <Panel id="watch-details-pane" defaultSize="45%" minSize="15%">
          <div className="h-full overflow-y-auto bg-bg">
            <SymbolDetails />
            <div className="border-t border-border">
              <NewsPanel />
            </div>
          </div>
        </Panel>
      </Group>
    );
  }

  const title =
    panel === "alerts"
      ? "Alerts"
      : panel === "news"
        ? "News"
        : panel === "book"
          ? venue === "stocks"
            ? "Session"
            : "Order book"
          : panel === "tape"
            ? "Trades"
            : "Portfolio & notes";

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex h-[46px] shrink-0 items-center px-3">
        <h2 className="text-[15px] font-semibold text-strong">{title}</h2>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {panel === "alerts" && (
          <div className="overflow-y-auto p-3">
            <AlertsPanel />
          </div>
        )}
        {panel === "news" && <NewsPanel scope="desk" />}
        {panel === "book" && <OrderBook />}
        {panel === "tape" && <TradesTape />}
        {panel === "desk" && (
          <div className="space-y-6 overflow-y-auto p-3">
            <HoldingsPanel />
            <EventsPanel />
            <NotesPanel />
          </div>
        )}
      </div>
    </div>
  );
}

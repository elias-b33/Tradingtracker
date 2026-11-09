import { useState } from "react";
import { Bell, BookOpen, ChevronRight, NotebookPen, Settings } from "lucide-react";
import { BottomSheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/lib/store";
import { AccountCard } from "./account-slot";
import { AlertsPanel } from "./alerts-panel";
import { CatchUpButton } from "./briefing-sheet";
import { ChartSettingsDialog } from "./chart-settings";
import { EventsPanel } from "./events-panel";
import { HoldingsPanel } from "./holdings-panel";
import { OrderBook, TradesTape } from "./market-side";
import { NewsPanel } from "./news-panel";
import { NotesPanel } from "./notes-panel";

function ScreenTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-12 shrink-0 items-center px-4">
      <h1 className="text-[22px] font-bold text-strong">{children}</h1>
    </div>
  );
}

/** Explore tab: news and market depth, switched with TradingView-style chips. */
export function ExploreScreen() {
  const venue = useTerminalStore((s) => s.venue);
  const [chip, setChip] = useState<"news" | "book" | "tape">("news");
  const chips = [
    { id: "news" as const, label: "News" },
    { id: "book" as const, label: venue === "stocks" ? "Session" : "Order book" },
    ...(venue === "crypto" ? [{ id: "tape" as const, label: "Trades" }] : []),
  ];
  const active = chips.some((c) => c.id === chip) ? chip : "news";
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <ScreenTitle>Explore</ScreenTitle>
      <div className="flex shrink-0 gap-1 px-3 pb-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setChip(c.id)}
            className={cn(
              "h-9 rounded-[10px] px-4 text-[16px]",
              active === c.id ? "bg-[#2a2a2a] font-semibold text-strong" : "text-[#8c8c8c]",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {active === "news" && <NewsPanel scope="desk" />}
        {active === "book" && <OrderBook />}
        {active === "tape" && <TradesTape />}
      </div>
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  detail,
  onClick,
}: {
  icon: typeof Bell;
  label: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-4 px-4 text-left active:bg-[#141414]"
    >
      <Icon className="size-6 shrink-0 text-fg" strokeWidth={1.5} />
      <span className="flex min-h-14 flex-1 items-center justify-between border-b border-[#202020] pr-1">
        <span className="text-[17px] text-fg">{label}</span>
        <span className="flex items-center gap-1 text-[15px] text-[#8c8c8c]">
          {detail}
          <ChevronRight className="size-5" strokeWidth={1.5} />
        </span>
      </span>
    </button>
  );
}

/** Menu tab: account and desk tools, as a grouped list. */
export function MenuScreen() {
  const alertCount = useTerminalStore((s) => s.alerts.filter((a) => !a.triggeredAt).length);
  const holdingCount = useTerminalStore((s) => s.holdings.length);
  const lastSeenAt = useTerminalStore((s) => s.lastSeenAt);
  const [sheet, setSheet] = useState<"alerts" | "portfolio" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg">
      <ScreenTitle>Menu</ScreenTitle>
      <div className="px-4 pb-4">
        <AccountCard />
      </div>
      {lastSeenAt ? (
        <div className="px-4 pb-3">
          <CatchUpButton />
        </div>
      ) : null}
      <div className="border-t border-[#202020]">
        <MenuRow
          icon={Bell}
          label="Alerts"
          detail={alertCount ? String(alertCount) : undefined}
          onClick={() => setSheet("alerts")}
        />
        <MenuRow
          icon={BookOpen}
          label="Portfolio, events & notes"
          detail={holdingCount ? String(holdingCount) : undefined}
          onClick={() => setSheet("portfolio")}
        />
        <MenuRow icon={Settings} label="Chart settings" onClick={() => setSettingsOpen(true)} />
      </div>
      <BottomSheet open={sheet === "alerts"} onOpenChange={(o) => setSheet(o ? "alerts" : null)} title="Alerts">
        <div className="px-4 pb-4">
          <AlertsPanel />
        </div>
      </BottomSheet>
      <BottomSheet
        open={sheet === "portfolio"}
        onOpenChange={(o) => setSheet(o ? "portfolio" : null)}
        title="Portfolio"
      >
        <div className="space-y-6 px-4 pb-6">
          <HoldingsPanel />
          <EventsPanel />
          <div className="flex items-center gap-2 text-[13px] text-[#8c8c8c]">
            <NotebookPen className="size-4" /> Notes for the current symbol
          </div>
          <NotesPanel />
        </div>
      </BottomSheet>
      <ChartSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

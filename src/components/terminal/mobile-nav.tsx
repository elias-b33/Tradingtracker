import { Compass, Menu } from "lucide-react";
import type { SVGProps } from "react";
import { cn } from "@/lib/utils";
import type { MobileTab } from "@/lib/market/types";
import { useTerminalStore } from "@/lib/store";

function WatchlistIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden {...props}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
      <path d="M8 8.5h8M8 12h8M8 15.5h5" />
    </svg>
  );
}

function ChartTabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden {...props}>
      <path d="M9 5v3M9 16v3M15 4v4M15 15v4" />
      <rect x="7" y="8" width="4" height="8" rx=".5" fill="currentColor" />
      <rect x="13" y="8" width="4" height="7" rx=".5" />
    </svg>
  );
}

const TABS: Array<{ id: MobileTab; label: string; icon: (p: SVGProps<SVGSVGElement>) => React.ReactElement }> = [
  { id: "watch", label: "Watchlist", icon: WatchlistIcon },
  { id: "chart", label: "Chart", icon: ChartTabIcon },
  { id: "explore", label: "Explore", icon: (p) => <Compass strokeWidth={1.5} {...p} /> },
  { id: "menu", label: "Menu", icon: (p) => <Menu strokeWidth={1.5} {...p} /> },
];

/** TradingView app bottom tab bar: icon on a pill when active, label below. */
export function MobileNav() {
  const tab = useTerminalStore((s) => s.mobileTab);
  const setTab = useTerminalStore((s) => s.setMobileTab);

  return (
    <nav
      aria-label="Main"
      className="desk-nav grid shrink-0 grid-cols-4 border-t border-[#1f1f1f] bg-bg md:hidden"
    >
      {TABS.map((item) => {
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex h-[58px] flex-col items-center justify-center gap-0.5 text-[11px]",
              active ? "text-strong" : "text-[#8c8c8c]",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-14 items-center justify-center rounded-[10px]",
                active && "bg-[#2a2a2a]",
              )}
            >
              <item.icon className="size-6" />
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

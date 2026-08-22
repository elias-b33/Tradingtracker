import { BookOpen, ChartCandlestick, List, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MobileTab } from "@/lib/market/types";
import { useTerminalStore } from "@/lib/store";

const TABS: Array<{ id: MobileTab; label: string; icon: typeof List }> = [
  { id: "watch", label: "Markets", icon: List },
  { id: "chart", label: "Chart", icon: ChartCandlestick },
  { id: "book", label: "Book", icon: BookOpen },
  { id: "more", label: "News", icon: Newspaper },
];

export function MobileNav() {
  const tab = useTerminalStore((s) => s.mobileTab);
  const setTab = useTerminalStore((s) => s.setMobileTab);
  const setPhonePane = useTerminalStore((s) => s.setPhonePane);
  const venue = useTerminalStore((s) => s.venue);

  return (
    <nav className="desk-nav grid grid-cols-4 border-t border-border bg-bg md:hidden">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            if (item.id === "chart") setPhonePane("plot");
            setTab(item.id);
          }}
          className={cn(
            "flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs",
            tab === item.id ? "text-accent" : "text-muted",
          )}
        >
          <item.icon className="size-4" />
          {item.id === "book" && venue === "stocks" ? "Session" : item.label}
        </button>
      ))}
    </nav>
  );
}

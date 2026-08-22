import { cn } from "@/lib/utils";
import type { VenueId } from "@/lib/market/types";
import { useTerminalStore } from "@/lib/store";

export function VenueSwitch({ className }: { className?: string }) {
  const venue = useTerminalStore((s) => s.venue);
  const setVenue = useTerminalStore((s) => s.setVenue);

  return (
    <div className={cn("flex shrink-0 rounded-md bg-elevated p-0.5", className)}>
      {(["crypto", "stocks"] as VenueId[]).map((id) => {
        const on = venue === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setVenue(id)}
            className={cn(
              "min-h-8 rounded px-2.5 text-xs font-medium",
              on ? "bg-surface text-fg" : "text-muted",
            )}
          >
            {id === "crypto" ? "Crypto" : "Stocks"}
          </button>
        );
      })}
    </div>
  );
}

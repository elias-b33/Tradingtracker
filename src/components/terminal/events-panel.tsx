import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pairLabel } from "@/lib/market/symbols";
import { upcomingEvents } from "@/lib/briefing";
import { useTerminalStore } from "@/lib/store";

export function EventsPanel() {
  const symbol = useTerminalStore((s) => s.symbol);
  const events = useTerminalStore((s) => s.events);
  const addEvent = useTerminalStore((s) => s.addEvent);
  const removeEvent = useTerminalStore((s) => s.removeEvent);
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const mine = events.filter((e) => e.symbol === symbol);
  const soon = upcomingEvents(events, 14);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !label.trim()) return;
    addEvent({ symbol, date, label: label.trim() });
    setLabel("");
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Dates</h2>
        <p className="text-xs text-muted">
          Unlocks, court, ETF — for {pairLabel(symbol)}. Surfaces in Catch up if within a week.
        </p>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 w-36"
        />
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Unlock"
          className="h-8"
          maxLength={120}
        />
        <Button type="submit" size="xs">
          Add
        </Button>
      </form>
      <ul className="space-y-1">
        {mine.length === 0 && soon.length === 0 && (
          <li className="py-2 text-center text-xs text-muted">No dates on this coin.</li>
        )}
        {mine.map((event) => (
          <li
            key={event.id}
            className="flex items-center justify-between rounded-md bg-bg px-2 py-1.5 text-xs"
          >
            <span>
              <span className="font-mono text-muted">{event.date}</span>
              <span className="ml-2">{event.label}</span>
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Remove date"
              onClick={() => removeEvent(event.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

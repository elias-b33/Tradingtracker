import { pairLabel } from "@/lib/market/symbols";
import { useTerminalStore } from "@/lib/store";

export function NotesPanel() {
  const symbol = useTerminalStore((s) => s.symbol);
  const note = useTerminalStore((s) => s.notes[s.symbol] ?? "");
  const setNote = useTerminalStore((s) => s.setNote);

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-sm font-medium">Notes</h2>
        <p className="text-xs text-muted">Private scratch pad for {pairLabel(symbol)}.</p>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(symbol, e.target.value)}
        maxLength={8000}
        placeholder="Levels, thesis, invalidation…"
        className="min-h-36 w-full resize-none rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring/40"
      />
    </div>
  );
}

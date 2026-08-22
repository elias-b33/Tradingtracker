import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPct, formatPrice } from "@/lib/market/format";
import { pairLabel } from "@/lib/market/symbols";
import { holdingPnl } from "@/lib/briefing";
import { cn } from "@/lib/utils";
import { useQuote, useTerminalStore } from "@/lib/store";

export function HoldingsPanel() {
  const symbol = useTerminalStore((s) => s.symbol);
  const quote = useQuote(symbol);
  const holdings = useTerminalStore((s) => s.holdings);
  const quotes = useTerminalStore((s) => s.quotes);
  const setHolding = useTerminalStore((s) => s.setHolding);
  const removeHolding = useTerminalStore((s) => s.removeHolding);
  const syncHoldings = useTerminalStore((s) => s.syncHoldings);
  const setSyncHoldings = useTerminalStore((s) => s.setSyncHoldings);
  const current = holdings.find((h) => h.symbol === symbol);
  const [qty, setQty] = useState(current ? String(current.qty) : "");
  const [cost, setCost] = useState(current ? String(current.cost) : "");

  useEffect(() => {
    const row = holdings.find((h) => h.symbol === symbol);
    setQty(row ? String(row.qty) : "");
    setCost(row ? String(row.cost) : "");
  }, [symbol, holdings]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(qty);
    const c = Number(cost);
    if (!Number.isFinite(q) || q < 0) return;
    if (!Number.isFinite(c) || c < 0) return;
    setHolding({ symbol, qty: q, cost: c });
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Position</h2>
        <p className="text-xs text-muted">
          Qty and avg cost for {pairLabel(symbol)}. Stays on this device unless you sync it.
        </p>
      </div>
      <form onSubmit={submit} className="grid grid-cols-2 gap-2">
        <Input
          inputMode="decimal"
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-8 font-mono"
        />
        <Input
          inputMode="decimal"
          placeholder={quote ? `Cost ${formatPrice(quote.lastPrice)}` : "Avg cost"}
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="h-8 font-mono"
        />
        <Button type="submit" size="xs" className="col-span-2">
          Save locally
        </Button>
      </form>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={syncHoldings}
          onChange={(e) => setSyncHoldings(e.target.checked)}
          className="size-3.5 accent-accent"
        />
        Also sync amounts with this account
      </label>
      <ul className="space-y-1">
        {holdings.length === 0 && (
          <li className="py-2 text-center text-xs text-muted">No positions yet.</li>
        )}
        {holdings.map((h) => {
          const { value, pnlPct } = holdingPnl(h, quotes[h.symbol]?.lastPrice);
          const up = pnlPct >= 0;
          return (
            <li
              key={h.symbol}
              className="flex items-center justify-between rounded-md bg-bg px-2 py-1.5 text-xs"
            >
              <span>
                <span className="font-medium">{pairLabel(h.symbol)}</span>
                <span className="ml-2 font-mono text-muted">
                  {h.qty} @ {formatPrice(h.cost)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className={cn("font-mono", up ? "text-up" : "text-down")}>
                  {formatPrice(value)} {formatPct(pnlPct)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${h.symbol} position`}
                  onClick={() => removeHolding(h.symbol)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

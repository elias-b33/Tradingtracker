import { useState } from "react";
import { Bell, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, formatRelativeTime } from "@/lib/market/format";
import { pairLabel } from "@/lib/market/symbols";
import { deskNotify, requestDeskNotifications } from "@/lib/notify";
import { useQuote, useTerminalStore } from "@/lib/store";

export function AlertsPanel() {
  const symbol = useTerminalStore((s) => s.symbol);
  const quote = useQuote(symbol);
  const quotes = useTerminalStore((s) => s.quotes);
  const alerts = useTerminalStore((s) => s.alerts);
  const alertLog = useTerminalStore((s) => s.alertLog);
  const addAlert = useTerminalStore((s) => s.addAlert);
  const removeAlert = useTerminalStore((s) => s.removeAlert);
  const rearmAlert = useTerminalStore((s) => s.rearmAlert);
  const [mode, setMode] = useState<"level" | "pct">("level");
  const [price, setPrice] = useState("");
  const [percent, setPercent] = useState("5");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [notifyState, setNotifyState] = useState<"idle" | "granted" | "denied" | "unsupported">(
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission === "granted"
        ? "granted"
        : "idle",
  );

  const parsedPrice = Number(price.replace(/,/g, ""));
  const parsedPct = Number(percent.replace(/,/g, ""));
  const priceOk = Number.isFinite(parsedPrice) && parsedPrice > 0;
  const pctOk = Number.isFinite(parsedPct) && parsedPct > 0;
  const preview =
    mode === "level"
      ? priceOk
        ? `${pairLabel(symbol)} ${direction} ${formatPrice(parsedPrice)}`
        : null
      : pctOk && quote
        ? `${pairLabel(symbol)} ${direction === "above" ? "+" : "−"}${parsedPct}% from ${formatPrice(quote.lastPrice)}`
        : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "level") {
      if (!priceOk) return;
      addAlert({ symbol, kind: "level", price: parsedPrice, direction });
      setPrice("");
      return;
    }
    const mark = quote?.lastPrice;
    if (!pctOk || !mark) return;
    addAlert({ symbol, kind: "pct", price: mark, percent: parsedPct, direction });
    deskNotify(
      "Alert armed",
      `${pairLabel(symbol)} ${direction === "above" ? "+" : "−"}${parsedPct}% from ${formatPrice(mark)}`,
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Alerts</h2>
        <p className="text-xs text-muted">
          Level or a % move from the mark. Fires once. Survives closing the tab if the next open still crossed it.
        </p>
      </div>
      <div className="flex gap-1">
        <Button type="button" size="xs" variant={mode === "level" ? "secondary" : "ghost"} onClick={() => setMode("level")}>
          Level
        </Button>
        <Button type="button" size="xs" variant={mode === "pct" ? "secondary" : "ghost"} onClick={() => setMode("pct")}>
          % from mark
        </Button>
      </div>
      <form onSubmit={submit} className="space-y-2">
        <label className="block text-xs font-medium tracking-wide text-muted uppercase">
          {mode === "level" ? "Price" : "Percent"}
        </label>
        <div className="flex flex-wrap items-stretch gap-2">
          {mode === "level" ? (
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder={quote ? formatPrice(quote.lastPrice) : "0.00"}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-label="Alert price"
              className="h-12 min-w-0 flex-1 rounded-md border border-border-strong bg-bg px-3 font-mono text-xl tabular-nums tracking-wide text-fg caret-accent outline-none placeholder:text-subtle/70 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          ) : (
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder="5"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              aria-label="Alert percent"
              className="h-12 w-28 rounded-md border border-border-strong bg-bg px-3 font-mono text-xl tabular-nums tracking-wide text-fg caret-accent outline-none placeholder:text-subtle/70 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          )}
          <Button
            type="button"
            size="sm"
            variant={direction === "above" ? "secondary" : "ghost"}
            onClick={() => setDirection("above")}
            className="h-12 px-3"
          >
            {mode === "pct" ? "Up" : "Above"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={direction === "below" ? "secondary" : "ghost"}
            onClick={() => setDirection("below")}
            className="h-12 px-3"
          >
            {mode === "pct" ? "Down" : "Below"}
          </Button>
          <Button type="submit" size="sm" className="h-12 px-4">
            Add
          </Button>
        </div>
        <p className="font-mono text-sm tabular-nums text-fg">
          {preview ?? <span className="text-muted">Type a number — it shows here as you go.</span>}
        </p>
      </form>
      {notifyState !== "unsupported" && notifyState !== "granted" && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => {
            void requestDeskNotifications().then(setNotifyState);
          }}
        >
          <Bell className="size-3.5" />
          Browser pings while this desk is open
        </Button>
      )}
      {notifyState === "granted" && (
        <p className="text-xs text-accent">Browser pings on. iPhone still needs the tab awake.</p>
      )}
      <ul className="max-h-40 space-y-1 overflow-auto">
        {alerts.length === 0 && <li className="py-3 text-center text-xs text-muted">No alerts yet.</li>}
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className="flex items-center justify-between rounded-md bg-bg px-3 py-2"
          >
            <span>
              <span className="block font-mono text-base tabular-nums tracking-wide text-fg">
                {alert.kind === "pct"
                  ? `${alert.direction === "above" ? "+" : "−"}${alert.percent ?? 0}%`
                  : formatPrice(alert.price)}
              </span>
              <span className="text-xs text-muted">
                {pairLabel(alert.symbol)}{" "}
                {alert.kind === "pct"
                  ? `from ${formatPrice(alert.price)}`
                  : alert.direction}
                {alert.triggeredAt ? (
                  <span className="ml-2 text-accent">
                    Fired {alert.firedPrice ? formatPrice(alert.firedPrice) : ""} ·{" "}
                    {formatRelativeTime(alert.triggeredAt)}
                  </span>
                ) : null}
              </span>
            </span>
            <span className="flex items-center">
              {alert.triggeredAt && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Re-arm"
                  onClick={() => rearmAlert(alert.id, quotes[alert.symbol]?.lastPrice)}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon-xs" aria-label="Remove alert" onClick={() => removeAlert(alert.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {alertLog.length > 0 && (
        <div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Log</p>
          <ul className="mt-1 max-h-28 space-y-0.5 overflow-auto text-xs text-muted">
            {alertLog.slice(0, 8).map((entry) => (
              <li key={entry.id}>
                {entry.text} · {formatRelativeTime(entry.at)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

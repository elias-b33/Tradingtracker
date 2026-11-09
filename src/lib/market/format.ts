export function formatPrice(price: number, opts?: { currency?: string; hint?: number }): string {
  if (!Number.isFinite(price)) return "—";
  const abs = Math.abs(price);
  const hint = opts?.hint;
  let min = 2;
  let max = 2;
  if (hint === 0) {
    min = 0;
    max = 0;
  } else if (hint === 1) {
    min = 1;
    max = 1;
  } else if (hint === 2) {
    min = 2;
    max = 2;
  } else if (hint && hint >= 3) {
    min = 2;
    max = hint;
  } else if (abs >= 1000) {
    min = 2;
    max = 2;
  } else if (abs >= 1) {
    min = 2;
    max = opts?.currency && opts.currency !== "USD" ? 3 : 2;
  } else if (abs >= 0.01) {
    min = 4;
    max = 6;
  } else {
    min = 6;
    max = 8;
  }
  const core = price.toLocaleString("en-US", {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
  if (opts?.currency && opts.currency !== "USD") return `${core} ${opts.currency}`;
  return core;
}

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(2)}K`;
  if (abs >= 1) return `${sign}${abs.toFixed(2)}`;
  return `${sign}${abs.toFixed(4)}`;
}

export function formatPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  if (Math.abs(n) >= 10_000) return `${sign}${(n / 100).toFixed(0)}×`;
  if (Math.abs(n) >= 1_000) return `${sign}${n.toFixed(0)}%`;
  return `${sign}${n.toFixed(2)}%`;
}

export function formatDelta(n: number, opts?: { currency?: string; hint?: number }): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatPrice(Math.abs(n), opts)}`;
}

/** Signed price change trimmed like TradingView: "+1.80", "+0.0045", "−0.000970". */
export function formatChange(n: number, hint?: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "−";
  if (hint !== undefined && hint >= 0 && hint <= 2) return `${sign}${formatPrice(abs, { hint })}`;
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : abs >= 0.0001 ? 6 : 8;
  return `${sign}${abs.toLocaleString("en-US", { minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits })}`;
}

export function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return formatCompact(n);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(5);
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatCandleTime(seconds: number, interval: string, timeZone?: string): string {
  const date = new Date(seconds * 1000);
  const tz = timeZone ? { timeZone } : {};
  if (interval === "1d" || interval === "1w") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      ...tz,
    });
  }
  if (interval === "4h" || interval === "1h") {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...tz,
    });
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...tz,
  });
}

const crosshairFormatters = new Map<string, Intl.DateTimeFormat>();

/** TradingView crosshair date, e.g. "Sun 08 Nov '26 14:45" (time omitted for D/W bars). */
export function formatCrosshairTime(seconds: number, interval: string, timeZone = "UTC"): string {
  let fmt = crosshairFormatters.get(timeZone);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
    }
    crosshairFormatters.set(timeZone, fmt);
  }
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(seconds * 1000)).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const date = `${parts.weekday} ${parts.day} ${parts.month} '${parts.year}`;
  if (interval === "1d" || interval === "1w") return date;
  return `${date} ${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
}

export function formatRelativeTime(ms: number): string {
  const delta = Math.max(0, Date.now() - ms);
  const sec = Math.round(delta / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

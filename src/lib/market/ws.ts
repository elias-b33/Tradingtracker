import type { Candle, Quote } from "./types";

const STREAM_BASES = [
  "wss://data-stream.binance.vision",
  "wss://stream.binance.com:9443",
  "wss://stream.binance.com:443",
];

export type StreamConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

function sessionFromKline(k: {
  s: string;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
  q: string;
}): Quote {
  const open = Number(k.o);
  const last = Number(k.c);
  return {
    symbol: k.s,
    lastPrice: last,
    openPrice: open,
    highPrice: Number(k.h),
    lowPrice: Number(k.l),
    volume: Number(k.v),
    quoteVolume: Number(k.q),
    priceChange: last - open,
    priceChangePercent: open ? ((last - open) / open) * 100 : 0,
  };
}

function lastOnly(raw: Record<string, string>): Quote {
  const last = Number(raw.c);
  return {
    symbol: raw.s,
    lastPrice: last,
    priceChange: 0,
    priceChangePercent: 0,
    highPrice: last,
    lowPrice: last,
    volume: 0,
    quoteVolume: 0,
    openPrice: 0,
  };
}

export function connectTickerStream(
  symbols: string[],
  onQuote: (quote: Quote) => void,
): () => void {
  if (typeof window === "undefined" || symbols.length === 0) return () => {};
  let closed = false;
  let socket: WebSocket | null = null;
  let attempt = 0;
  let timer: number | null = null;

  const streams = [
    ...symbols.map((s) => `${s.toLowerCase()}@miniTicker`),
    ...symbols.map((s) => `${s.toLowerCase()}@kline_1d`),
  ].join("/");

  const connect = (baseIndex: number) => {
    if (closed) return;
    const base = STREAM_BASES[baseIndex % STREAM_BASES.length];
    const url = `${base}/stream?streams=${streams}`;
    try {
      socket = new WebSocket(url);
    } catch {
      schedule(baseIndex + 1);
      return;
    }
    socket.onopen = () => {
      attempt = 0;
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as {
          data?: Record<string, unknown> & {
            s?: string;
            c?: string;
            k?: {
              s: string;
              o: string;
              h: string;
              l: string;
              c: string;
              v: string;
              q: string;
            };
          };
        };
        const data = payload.data;
        if (!data) return;
        if (data.k?.s) onQuote(sessionFromKline(data.k));
        else if (data.s && data.c) onQuote(lastOnly(data as Record<string, string>));
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onerror = () => {
      socket?.close();
    };
    socket.onclose = () => {
      if (!closed) schedule(baseIndex + 1);
    };
  };

  const schedule = (baseIndex: number) => {
    if (closed) return;
    const delay = Math.min(1000 * 2 ** Math.min(attempt, 4), 12_000);
    attempt += 1;
    timer = window.setTimeout(() => connect(baseIndex), delay);
  };

  connect(0);

  return () => {
    closed = true;
    if (timer) window.clearTimeout(timer);
    socket?.close();
  };
}

export function connectKlineStream(
  symbol: string,
  interval: string,
  onCandle: (candle: Candle, closed: boolean) => void,
  onStatus?: (status: StreamConnectionStatus) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  let disposed = false;
  let socket: WebSocket | null = null;
  let attempt = 0;
  let timer: number | null = null;
  let heartbeatTimer: number | null = null;
  let lastMessageAt = 0;
  let status: StreamConnectionStatus | null = null;
  const stream = `${symbol.toLowerCase()}@kline_${interval}`;

  const emitStatus = (next: StreamConnectionStatus) => {
    if (status === next) return;
    status = next;
    onStatus?.(next);
  };

  const stopHeartbeat = () => {
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    lastMessageAt = Date.now();
    heartbeatTimer = window.setInterval(() => {
      if (disposed || !socket || socket.readyState !== WebSocket.OPEN) return;
      // Binance kline streams normally emit every 1–2 seconds. A silent open
      // socket is not live; force failover rather than leaving stale UI behind.
      if (Date.now() - lastMessageAt > 20_000) {
        emitStatus("reconnecting");
        socket.close();
      }
    }, 5000);
  };

  const connect = (baseIndex: number) => {
    if (disposed) return;
    const base = STREAM_BASES[baseIndex % STREAM_BASES.length];
    try {
      socket = new WebSocket(`${base}/ws/${stream}`);
    } catch {
      emitStatus("reconnecting");
      schedule(baseIndex + 1);
      return;
    }
    socket.onopen = () => {
      attempt = 0;
      emitStatus("open");
      startHeartbeat();
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as {
          k?: {
            t: number;
            o: string;
            h: string;
            l: string;
            c: string;
            v: string;
            x: boolean;
          };
        };
        const k = payload.k;
        if (!k) return;
        lastMessageAt = Date.now();
        emitStatus("open");
        onCandle(
          {
            time: Math.floor(k.t / 1000),
            open: Number(k.o),
            high: Number(k.h),
            low: Number(k.l),
            close: Number(k.c),
            volume: Number(k.v),
          },
          k.x,
        );
      } catch {
        /* ignore */
      }
    };
    socket.onerror = () => {
      emitStatus("reconnecting");
      socket?.close();
    };
    socket.onclose = () => {
      stopHeartbeat();
      socket = null;
      if (!disposed) {
        emitStatus("reconnecting");
        schedule(baseIndex + 1);
      }
    };
  };

  const schedule = (baseIndex: number) => {
    if (disposed) return;
    const delay = Math.min(1000 * 2 ** Math.min(attempt, 4), 12_000);
    attempt += 1;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => connect(baseIndex), delay);
  };

  emitStatus("connecting");
  connect(0);

  return () => {
    disposed = true;
    if (timer !== null) window.clearTimeout(timer);
    stopHeartbeat();
    emitStatus("closed");
    socket?.close();
    socket = null;
  };
}

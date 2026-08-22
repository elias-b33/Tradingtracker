import { createServerFn } from "@tanstack/react-start";
import { assetName, baseAsset } from "./symbols";
import { isCryptoSymbol } from "./venue";
import { TtlLruCache } from "./runtime-guards";

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  excerpt: string;
  symbol?: string;
}

const cache = new TtlLruCache<NewsItem[]>({ maxEntries: 96 });
const AMP = String.fromCharCode(38);

async function guardPublicRequest(scope: string, limit: number): Promise<void> {
  const { enforcePublicRateLimit } = await import("../server/public-rate-limit.server");
  enforcePublicRateLimit(`news:${scope}`, limit);
}

function decodeHtml(value: string): string {
  const amp = `${AMP}amp;`;
  const lt = `${AMP}lt;`;
  const gt = `${AMP}gt;`;
  const quot = `${AMP}quot;`;
  let once = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  once = once
    .replace(new RegExp(lt, "g"), "<")
    .replace(new RegExp(gt, "g"), ">")
    .replace(new RegExp(quot, "g"), '"')
    .replace(/&#39;/g, "'")
    .replace(new RegExp(`${AMP}nbsp;`, "g"), " ");
  once = once.replace(/<[^>]+>/g, " ");
  once = once.replace(new RegExp(amp, "g"), AMP);
  return once.replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function attr(block: string, name: string, attrName: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*${attrName}="([^"]+)"`, "i"));
  return match?.[1] ?? "";
}

function parseRss(xml: string, fallbackSource: string): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? [];
  for (const block of blocks) {
    const title = tag(block, "title");
    const url = tag(block, "link") || attr(block, "link", "href");
    if (!title || !/^https?:\/\//i.test(url)) continue;
    const source = tag(block, "source") || fallbackSource;
    const publishedAt = Date.parse(tag(block, "pubDate")) || Date.now();
    let headline = title;
    const suffix = ` - ${source}`;
    if (headline.endsWith(suffix)) headline = headline.slice(0, -suffix.length).trim();
    items.push({
      id: url,
      title: headline,
      url,
      source,
      publishedAt,
      excerpt: "",
    });
  }
  return items;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "User-Agent": "AetherTerminal/1.0",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`News feed ${res.status}`);
  return res.text();
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleHits(title: string, symbols: string[]): string | null {
  const hay = title;
  for (const symbol of symbols) {
    const base = baseAsset(symbol);
    const name = assetName(symbol);
    const pattern = new RegExp(
      `\\b${escapeRe(name)}\\b|\\b${escapeRe(base)}\\b|\\$${escapeRe(base)}\\b`,
      "i",
    );
    if (pattern.test(hay)) return symbol;
  }
  return null;
}

function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const getNews = createServerFn({ method: "GET" })
  .validator((input: { symbol: string }) => ({
    symbol: input.symbol.replace(/[^A-Za-z0-9.^-]/g, "").toUpperCase().slice(0, 24),
  }))
  .handler(async ({ data }): Promise<{ ok: true; items: NewsItem[] } | { ok: false; error: string }> => {
    try {
      await guardPublicRequest("symbol", 60);
      const base = baseAsset(data.symbol);
      const name = assetName(data.symbol);
      const hit = cache.get(data.symbol);
      if (hit) return { ok: true, items: hit };

      const crypto = isCryptoSymbol(data.symbol);
      const query = encodeURIComponent(
        crypto ? `"${name}" OR ${base} crypto` : `"${name}" OR ${base} stock`,
      );
      const google = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
      const telegraph = "https://cointelegraph.com/rss";

      const settled = await Promise.allSettled(
        crypto ? [fetchText(google), fetchText(telegraph)] : [fetchText(google)],
      );
      const googleXml = settled[0].status === "fulfilled" ? settled[0].value : "";
      const ctXml = settled[1]?.status === "fulfilled" ? settled[1].value : "";

      const merged = [
        ...parseRss(googleXml, "Google News"),
        ...(crypto ? parseRss(ctXml, "Cointelegraph") : []),
      ]
        .map((item) => ({ ...item, symbol: titleHits(item.title, [data.symbol]) ?? data.symbol }));

      const items = dedupe(merged)
        .sort((a, b) => b.publishedAt - a.publishedAt)
        .slice(0, 24);

      if (!items.length) {
        return { ok: false, error: "No recent coverage for this market." };
      }
      cache.set(data.symbol, items, 90_000);
      return { ok: true, items };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to load news",
      };
    }
  });

export const getDeskNews = createServerFn({ method: "GET" })
  .validator((input: { symbols: string[] }) => ({
    symbols: [...new Set(input.symbols.map((s) => s.replace(/[^A-Za-z0-9.^-]/g, "").toUpperCase()).filter(Boolean))].slice(
      0,
      8,
    ),
  }))
  .handler(async ({ data }): Promise<{ ok: true; items: NewsItem[] } | { ok: false; error: string }> => {
    try {
      await guardPublicRequest("desk", 45);
      if (!data.symbols.length) return { ok: false, error: "No markets on this desk." };
      const key = `desk:${data.symbols.join(",")}`;
      const hit = cache.get(key);
      if (hit) return { ok: true, items: hit };

      const parts = data.symbols.flatMap((symbol) => {
        const base = baseAsset(symbol);
        const name = assetName(symbol);
        return name === base ? [base] : [`"${name}"`, base];
      });
      const crypto = data.symbols.some((s) => isCryptoSymbol(s));
      const query = encodeURIComponent(`${parts.join(" OR ")}${crypto ? " crypto" : " stock OR shares"}`);
      const google = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
      const telegraph = "https://cointelegraph.com/rss";

      const settled = await Promise.allSettled(
        crypto ? [fetchText(google), fetchText(telegraph)] : [fetchText(google)],
      );
      const googleXml = settled[0].status === "fulfilled" ? settled[0].value : "";
      const ctXml = settled[1]?.status === "fulfilled" ? settled[1].value : "";

      const tagged: NewsItem[] = [];
      for (const item of [
        ...parseRss(googleXml, "Google News"),
        ...(crypto ? parseRss(ctXml, "Cointelegraph") : []),
      ]) {
        const symbol = titleHits(item.title, data.symbols);
        if (symbol) tagged.push({ ...item, symbol });
      }

      const items = dedupe(tagged)
        .sort((a, b) => b.publishedAt - a.publishedAt)
        .slice(0, 24);

      if (!items.length) return { ok: false, error: "No recent coverage for your list." };
      cache.set(key, items, 90_000);
      return { ok: true, items };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to load news",
      };
    }
  });

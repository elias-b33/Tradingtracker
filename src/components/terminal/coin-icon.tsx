import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { baseAsset } from "@/lib/market/symbols";
import { isCryptoSymbol } from "@/lib/market/venue";

const SLUG: Record<string, string> = {
  RENDER: "render",
  RNDR: "render",
  POL: "pol",
  MATIC: "matic",
  RUN: "rune",
  RUNE: "rune",
};

function pack(glob: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(glob)) {
    const name = path.split("/").pop()?.replace(/\.(png|svg)$/, "");
    if (name) out[name] = url;
  }
  return out;
}

const SVG = pack(
  import.meta.glob("../../assets/coins/*.svg", { eager: true, query: "?url", import: "default" }) as Record<
    string,
    string
  >,
);
const PNG = pack(
  import.meta.glob("../../assets/coins/*.png", { eager: true, query: "?url", import: "default" }) as Record<
    string,
    string
  >,
);

function slugFor(symbol: string): string {
  const base = baseAsset(symbol).replace(/^1000/, "");
  return (SLUG[base] ?? base).toLowerCase();
}

function avatarHue(symbol: string): number {
  let h = 0;
  for (const ch of symbol) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

export function CoinIcon({
  symbol,
  name,
  logoUrl,
  size = 32,
  className,
}: {
  symbol: string;
  name?: string;
  logoUrl?: string;
  size?: number;
  className?: string;
}) {
  const slug = slugFor(symbol);
  const initials = baseAsset(symbol).replace(/^1000|[^a-z0-9]/gi, "").slice(0, 2);
  const letter = initials.charAt(0);
  const [step, setStep] = useState(0);
  const stock = !isCryptoSymbol(symbol);
  const hue = avatarHue(symbol);
  const stockLogoUrl = safeStockLogoUrl(logoUrl);

  useEffect(() => {
    setStep(0);
  }, [logoUrl, name, slug, symbol]);

  if (stock) {
    return (
      <span
        aria-hidden
        className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", className)}
        style={{
          width: size,
          height: size,
          background: `hsl(${hue} 28% 18%)`,
          color: `hsl(${hue} 55% 72%)`,
        }}
      >
        {!stockLogoUrl || step > 0 ? (
          <span className="text-[10px] font-semibold">{initials || letter}</span>
        ) : (
          <img
            src={stockLogoUrl}
            alt=""
            width={size}
            height={size}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-full bg-white object-contain"
            onError={() => setStep((n) => n + 1)}
          />
        )}
      </span>
    );
  }

  const list = [SVG[slug], PNG[slug]].filter(Boolean) as string[];

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1a1e21]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {step >= list.length ? (
        <span className="text-[11px] font-medium text-fg">{letter}</span>
      ) : (
        <img
          src={list[step]}
          alt=""
          width={size}
          height={size}
          className="size-full object-contain"
          onError={() => setStep((n) => n + 1)}
        />
      )}
    </span>
  );
}

/** Stock logos are opt-in provider data; never derive or scrape a vendor URL from a ticker. */
function safeStockLogoUrl(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    const allowedHosts = new Set([
      "static.finnhub.io",
      "static2.finnhub.io",
      "api.twelvedata.com",
      "logo.twelvedata.com",
    ]);
    return url.protocol === "https:" && allowedHosts.has(url.hostname) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

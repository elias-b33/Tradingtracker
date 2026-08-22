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

const TV_CODE: Record<string, string> = {
  RENDER: "RNDR",
  RNDR: "RNDR",
  RUN: "RUNE",
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

function tvCode(symbol: string): string {
  const base = baseAsset(symbol).replace(/^1000/, "");
  return TV_CODE[base] ?? base;
}

function avatarHue(symbol: string): number {
  let h = 0;
  for (const ch of symbol) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

export function CoinIcon({
  symbol,
  size = 32,
  className,
}: {
  symbol: string;
  size?: number;
  className?: string;
}) {
  const slug = slugFor(symbol);
  const letter = baseAsset(symbol).replace(/^1000/, "").charAt(0);
  const [step, setStep] = useState(0);
  const stock = !isCryptoSymbol(symbol);
  const hue = avatarHue(symbol);

  useEffect(() => {
    setStep(0);
  }, [slug, symbol]);

  if (stock) {
    return (
      <span
        aria-hidden
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full", className)}
        style={{
          width: size,
          height: size,
          background: `hsl(${hue} 28% 18%)`,
          color: `hsl(${hue} 55% 72%)`,
        }}
      >
        <span className="text-[11px] font-semibold">{letter}</span>
      </span>
    );
  }

  const list = [
    SVG[slug],
    PNG[slug],
    `https://s3-symbol-logo.tradingview.com/crypto/XTVC${tvCode(symbol)}--big.svg`,
  ].filter(Boolean) as string[];

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

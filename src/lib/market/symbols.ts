import { STOCK_META } from "./venue";

export interface AssetMeta {
  name: string;
  category: "Layer 1" | "Layer 2" | "DeFi" | "Meme" | "Infra" | "Major";
}

export const ASSET_META: Record<string, AssetMeta> = {
  BTC: { name: "Bitcoin", category: "Major" },
  ETH: { name: "Ethereum", category: "Major" },
  SOL: { name: "Solana", category: "Layer 1" },
  BNB: { name: "BNB", category: "Major" },
  XRP: { name: "XRP", category: "Major" },
  DOGE: { name: "Dogecoin", category: "Meme" },
  ADA: { name: "Cardano", category: "Layer 1" },
  AVAX: { name: "Avalanche", category: "Layer 1" },
  LINK: { name: "Chainlink", category: "Infra" },
  DOT: { name: "Polkadot", category: "Layer 1" },
  SUI: { name: "Sui", category: "Layer 1" },
  TON: { name: "Toncoin", category: "Layer 1" },
  NEAR: { name: "NEAR", category: "Layer 1" },
  APT: { name: "Aptos", category: "Layer 1" },
  LTC: { name: "Litecoin", category: "Major" },
  ATOM: { name: "Cosmos", category: "Layer 1" },
  UNI: { name: "Uniswap", category: "DeFi" },
  AAVE: { name: "Aave", category: "DeFi" },
  PEPE: { name: "Pepe", category: "Meme" },
  SHIB: { name: "Shiba Inu", category: "Meme" },
  WIF: { name: "dogwifhat", category: "Meme" },
  BONK: { name: "Bonk", category: "Meme" },
  RENDER: { name: "Render", category: "Infra" },
  FET: { name: "Fetch.ai", category: "Infra" },
  INJ: { name: "Injective", category: "DeFi" },
  ARB: { name: "Arbitrum", category: "Layer 2" },
  OP: { name: "Optimism", category: "Layer 2" },
  MATIC: { name: "Polygon", category: "Layer 2" },
  POL: { name: "Polygon", category: "Layer 2" },
  TIA: { name: "Celestia", category: "Infra" },
  SEI: { name: "Sei", category: "Layer 1" },
  FIL: { name: "Filecoin", category: "Infra" },
  HBAR: { name: "Hedera", category: "Layer 1" },
  TRX: { name: "TRON", category: "Layer 1" },
  BCH: { name: "Bitcoin Cash", category: "Major" },
  ETC: { name: "Ethereum Classic", category: "Layer 1" },
  MKR: { name: "Maker", category: "DeFi" },
  LDO: { name: "Lido", category: "DeFi" },
  CRV: { name: "Curve", category: "DeFi" },
  ONDO: { name: "Ondo", category: "DeFi" },
  JUP: { name: "Jupiter", category: "DeFi" },
  PENDLE: { name: "Pendle", category: "DeFi" },
  TAO: { name: "Bittensor", category: "Infra" },
  WLD: { name: "Worldcoin", category: "Infra" },
  STX: { name: "Stacks", category: "Layer 2" },
  IMX: { name: "Immutable", category: "Layer 2" },
  RUN: { name: "THORChain", category: "DeFi" },
};

export const DEFAULT_WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "LINKUSDT",
] as const;

export const LIQUID_UNIVERSE = [
  ...DEFAULT_WATCHLIST,
  "AVAXUSDT",
  "SUIUSDT",
  "TONUSDT",
  "NEARUSDT",
  "DOTUSDT",
  "LTCUSDT",
  "ATOMUSDT",
  "UNIUSDT",
  "AAVEUSDT",
  "PEPEUSDT",
  "SHIBUSDT",
  "WIFUSDT",
  "BONKUSDT",
  "RENDERUSDT",
  "FETUSDT",
  "INJUSDT",
  "ARBUSDT",
  "OPUSDT",
  "POLUSDT",
  "TIAUSDT",
  "SEIUSDT",
  "FILUSDT",
  "HBARUSDT",
  "TRXUSDT",
  "BCHUSDT",
  "TAOUSDT",
  "WLDUSDT",
  "ONDOUSDT",
  "JUPUSDT",
  "PENDLEUSDT",
  "STXUSDT",
] as const;

export function baseAsset(symbol: string): string {
  if (/USDT$|USDC$|FDUSD$|BUSD$/.test(symbol) && symbol.length > 5) {
    return symbol.replace(/USDT$|USDC$|FDUSD$|BUSD$/, "");
  }
  return symbol.replace(/\.[A-Z]{1,4}$/, "");
}

export function quoteAsset(symbol: string): string {
  const match = symbol.match(/(USDT|USDC|FDUSD|BUSD)$/);
  return match?.[1] ?? "";
}

export function assetName(symbol: string): string {
  const base = baseAsset(symbol);
  return ASSET_META[base]?.name ?? STOCK_META[symbol]?.name ?? STOCK_META[base]?.name ?? base;
}

export function pairLabel(symbol: string): string {
  const quote = quoteAsset(symbol);
  return quote ? `${baseAsset(symbol)}/${quote}` : symbol;
}

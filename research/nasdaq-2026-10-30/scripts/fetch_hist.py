"""Fetch 2y daily OHLCV from Yahoo's public chart endpoint for the Nasdaq universe."""
import json, os, re, sys, time, random, threading
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

S = sys.argv[1]
MIN_CAP = float(sys.argv[2]) if len(sys.argv) > 2 else 1e8
OUT = os.path.join(S, "data", "hist")
os.makedirs(OUT, exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

rows = json.load(open(os.path.join(S, "data", "nasdaq_screener.json")))["data"]["rows"]
ndx = [r["symbol"] for r in json.load(open(os.path.join(S, "data", "ndx.json")))["data"]["data"]["rows"]]
bad = re.compile(r"\b(Warrant|Warrants|Unit|Units|Right|Rights|Preferred|Depositary Shares Each Representing|Notes due|Subordinated)\b", re.I)

def cap(r):
    try:
        return float(r["marketCap"] or 0)
    except ValueError:
        return 0.0

universe = [r["symbol"] for r in rows if not bad.search(r["name"]) and "^" not in r["symbol"] and "/" not in r["symbol"] and cap(r) >= MIN_CAP]
bench = ["QQQ", "SPY", "IWM", "DIA", "^IXIC", "^NDX", "^GSPC", "^VIX", "^TNX", "DX-Y.NYB", "GLD", "TLT", "BTC-USD", "CL=F",
         "XLK", "XLY", "XLC", "XLF", "XLV", "XLI", "XLE", "XLB", "XLRE", "XLU", "XLP", "SMH", "IGV", "XBI", "RSP", "QQQE", "RDDT"]
symbols = list(dict.fromkeys(bench + ndx + universe))
print("symbols to fetch:", len(symbols), flush=True)

lock = threading.Lock()
stats = {"ok": 0, "fail": 0, "skip": 0}

def fetch(sym):
    path = os.path.join(OUT, sym.replace("^", "_").replace("/", "_") + ".json")
    if os.path.exists(path) and os.path.getsize(path) > 200:
        with lock: stats["skip"] += 1
        return sym, "skip"
    ysym = sym.replace(".", "-") if re.fullmatch(r"[A-Z]+\.[A-Z]", sym) else sym
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(ysym)}?range=2y&interval=1d&includePrePost=false&events=div%2Csplit"
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.load(resp)
            res = data["chart"]["result"][0]
            q = res["indicators"]["quote"][0]
            adj = (res["indicators"].get("adjclose") or [{}])[0].get("adjclose")
            out = {"meta": {k: res["meta"].get(k) for k in ("symbol", "currency", "exchangeName", "regularMarketPrice", "regularMarketTime", "fiftyTwoWeekHigh", "fiftyTwoWeekLow", "longName", "shortName", "instrumentType")},
                   "t": res.get("timestamp", []), "o": q.get("open"), "h": q.get("high"), "l": q.get("low"), "c": q.get("close"), "v": q.get("volume"), "a": adj}
            with open(path, "w") as f:
                json.dump(out, f, separators=(",", ":"))
            with lock: stats["ok"] += 1
            return sym, "ok"
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                time.sleep(2 ** attempt + random.random())
                continue
            with lock: stats["fail"] += 1
            return sym, f"http {e.code}"
        except Exception as e:  # network hiccup or empty result
            time.sleep(1 + attempt)
            last = repr(e)[:80]
    with lock: stats["fail"] += 1
    return sym, "fail"

fails = []
with ThreadPoolExecutor(max_workers=6) as ex:
    futs = [ex.submit(fetch, s) for s in symbols]
    for i, fu in enumerate(as_completed(futs), 1):
        sym, st = fu.result()
        if st not in ("ok", "skip"):
            fails.append((sym, st))
        if i % 200 == 0:
            print(i, stats, flush=True)
print("done", stats, flush=True)
json.dump(fails, open(os.path.join(S, "data", "fetch_failures.json"), "w"))
print("failures:", fails[:40])

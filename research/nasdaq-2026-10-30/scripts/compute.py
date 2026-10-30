"""Compute technical metrics, setups, buy zones and scores for every Nasdaq stock."""
import json, os, re, sys, math, time
from datetime import datetime, timezone
import numpy as np

S = sys.argv[1]
H = os.path.join(S, "data", "hist")
rows = json.load(open(os.path.join(S, "data", "nasdaq_screener.json")))["data"]["rows"]
ndx = {r["symbol"] for r in json.load(open(os.path.join(S, "data", "ndx.json")))["data"]["data"]["rows"]}
bad = re.compile(r"\b(Warrant|Warrants|Unit|Units|Right|Rights|Preferred|Depositary Shares Each Representing|Notes due|Subordinated)\b", re.I)

now = datetime.now(timezone.utc)
open_utc = now.replace(hour=13, minute=30, second=0, microsecond=0)
session_frac = min(max((now - open_utc).total_seconds() / (6.5 * 3600), 0.15), 1.0)


def load(sym):
    p = os.path.join(H, sym.replace("^", "_").replace("/", "_") + ".json")
    if not os.path.exists(p):
        return None
    d = json.load(open(p))
    t = d.get("t") or []
    if len(t) < 30:
        return None
    arr = {}
    for k in ("o", "h", "l", "c", "v"):
        x = d.get(k) or []
        arr[k] = np.array([np.nan if v is None else float(v) for v in x], dtype=float)
    keep = ~np.isnan(arr["c"])
    for k in arr:
        arr[k] = arr[k][keep]
    arr["t"] = np.array(t)[keep]
    for k in ("o", "h", "l"):
        m = np.isnan(arr[k])
        arr[k][m] = arr["c"][m]
    arr["v"] = np.nan_to_num(arr["v"])
    arr["meta"] = d.get("meta", {})
    return arr


def sma(x, n):
    return float(np.mean(x[-n:])) if len(x) >= n else None


def rsi(c, n=14):
    if len(c) < n + 2:
        return None
    d = np.diff(c)
    up = np.clip(d, 0, None)
    dn = np.clip(-d, 0, None)
    au = up[:n].mean()
    ad = dn[:n].mean()
    for i in range(n, len(d)):
        au = (au * (n - 1) + up[i]) / n
        ad = (ad * (n - 1) + dn[i]) / n
    if ad == 0:
        return 100.0
    return float(100 - 100 / (1 + au / ad))


def atr(h, l, c, n=14):
    if len(c) < n + 2:
        return None
    pc = c[:-1]
    tr = np.maximum(h[1:] - l[1:], np.maximum(abs(h[1:] - pc), abs(l[1:] - pc)))
    a = tr[:n].mean()
    for i in range(n, len(tr)):
        a = (a * (n - 1) + tr[i]) / n
    return float(a)


def ret(c, n):
    return float(c[-1] / c[-1 - n] - 1) if len(c) > n and c[-1 - n] > 0 else None


def pivots(h, l, lookback=180, w=5):
    n = len(h)
    start = max(w, n - lookback)
    lows, highs = [], []
    for i in range(start, n - w):
        if l[i] == l[i - w:i + w + 1].min():
            lows.append(float(l[i]))
        if h[i] == h[i - w:i + w + 1].max():
            highs.append(float(h[i]))
    return lows, highs


def ytd_ref(t, c):
    cutoff = datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp()
    idx = np.where(t < cutoff)[0]
    return float(c[idx[-1]]) if len(idx) else None


def cap(r):
    try:
        return float(r["marketCap"] or 0)
    except ValueError:
        return 0.0


def fnum(x, nd=2):
    return None if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))) else round(float(x), nd)


def metrics(sym, a):
    c, h, l, v, t = a["c"], a["h"], a["l"], a["v"], a["t"]
    n = len(c)
    p = float(c[-1])
    m = {"price": p, "bars": n}
    m["chg1d"] = ret(c, 1)
    for k, nn in (("r5", 5), ("r21", 21), ("r63", 63), ("r126", 126), ("r189", 189), ("r252", 252)):
        m[k] = ret(c, nn)
    yr = ytd_ref(t, c)
    m["ytd"] = p / yr - 1 if yr else None
    for nn in (10, 20, 50, 150, 200):
        m[f"sma{nn}"] = sma(c, nn)
    m["sma200_prev"] = float(np.mean(c[-221:-21])) if n >= 221 else None
    m["sma50_prev"] = float(np.mean(c[-60:-10])) if n >= 60 else None
    w = min(n, 252)
    m["hi52"] = float(h[-w:].max())
    m["lo52"] = float(l[-w:].min())
    m["hi52_prior"] = float(h[-w:-3].max()) if n > 10 else m["hi52"]
    m["days_since_hi"] = int(w - 1 - int(np.argmax(h[-w:])))
    m["from_hi"] = p / m["hi52"] - 1
    m["from_lo"] = p / m["lo52"] - 1 if m["lo52"] > 0 else None
    m["rsi"] = rsi(c)
    m["atr"] = atr(h, l, c)
    m["atr10"] = atr(h[-60:], l[-60:], c[-60:], 10) if n >= 60 else None
    m["atrp"] = m["atr"] / p if m["atr"] else None
    lr = np.diff(np.log(c[-64:])) if n >= 64 else None
    m["vol63"] = float(np.std(lr) * math.sqrt(252)) if lr is not None else None
    full = v[:-1]
    m["vol50"] = float(full[-50:].mean()) if len(full) >= 20 else None
    m["dvol50"] = m["vol50"] * p if m["vol50"] else None
    vr = []
    if m["vol50"]:
        vr.append(v[-1] / (m["vol50"] * session_frac))
        if n >= 3:
            vr.extend([v[-2] / m["vol50"], v[-3] / m["vol50"]])
    m["vol_ratio_recent"] = max(vr) if vr else None
    m["vol_ratio_y"] = (v[-2] / m["vol50"]) if m["vol50"] and n >= 2 else None
    rng20 = (h[-20:].max() - l[-20:].min()) / p if n >= 20 else None
    m["range20"] = rng20
    lows, highs = pivots(h, l)
    sup = sorted([x for x in lows if x < p * 0.995], reverse=True)
    res = sorted([x for x in highs if x > p * 1.005])
    m["support"] = sup[0] if sup else None
    m["support2"] = sup[1] if len(sup) > 1 else None
    m["resistance"] = res[0] if res else None
    m["swing_low10"] = float(l[-10:].min())
    m["swing_low20"] = float(l[-20:].min())
    return m


universe = []
for r in rows:
    if bad.search(r["name"]) or "^" in r["symbol"] or "/" in r["symbol"]:
        continue
    universe.append(r)

data = {}
for r in universe:
    a = load(r["symbol"])
    if a is None:
        continue
    data[r["symbol"]] = (r, a, metrics(r["symbol"], a))

# IBD-style relative strength percentile across all stocks with enough history
raw = {}
for s, (_, a, m) in data.items():
    if m["bars"] >= 130:
        r3, r6 = m["r63"] or 0, m["r126"] or 0
        r9 = m["r189"] if m["r189"] is not None else r6
        r12 = m["r252"] if m["r252"] is not None else r9
        raw[s] = 0.4 * r3 + 0.2 * r6 + 0.2 * r9 + 0.2 * r12
vals = np.array(sorted(raw.values()))
for s, x in raw.items():
    data[s][2]["rs"] = int(max(1, min(99, round(np.searchsorted(vals, x, side="right") / len(vals) * 99))))


m1vals = np.array(sorted(m["r21"] for _, _, m in data.values() if m["r21"] is not None and m["bars"] >= 60))
for s, (_, a, m) in data.items():
    if m["r21"] is not None and m["bars"] >= 60:
        m["rs1m"] = int(max(1, min(99, round(np.searchsorted(m1vals, m["r21"], side="right") / len(m1vals) * 99))))


def trend_template(m):
    p = m["price"]
    if None in (m["sma50"], m["sma150"], m["sma200"], m["sma200_prev"]):
        return None
    crit = [
        p > m["sma150"] and p > m["sma200"],
        m["sma150"] > m["sma200"],
        m["sma200"] > m["sma200_prev"],
        m["sma50"] > m["sma150"] and m["sma50"] > m["sma200"],
        p > m["sma50"],
        m["lo52"] > 0 and p >= 1.30 * m["lo52"],
        p >= 0.75 * m["hi52"],
        (m.get("rs") or 0) >= 70,
    ]
    return int(sum(crit))


LABELS = {
    "BREAKOUT": "Utbrott till ny topp",
    "NEAR_PIVOT": "Nära utbrott (tight bas)",
    "PULLBACK": "Rekyl i upptrend – köpläge",
    "OVERSOLD_UP": "Översåld i långsiktig upptrend",
    "RECOVERY": "Trendvändning (tidigt steg 2)",
    "STRONG": "Stark trend – vänta på rekyl",
    "EXTENDED": "Sträckt – jaga inte",
    "DOWNTREND": "Nedtrend – undvik",
    "NEUTRAL": "Sidledes / neutral",
    "NEW": "Ny notering – kort historik",
    "SHOCK": "Kursras – vänta på stabilisering",
    "LOCKED": "Låst kurs – troligen uppköpsbud",
}


def classify(m):
    p, a = m["price"], m["atr"] or 0
    tt = m.get("tt")
    s20, s50, s200 = m["sma20"], m["sma50"], m["sma200"]
    rsi_ = m["rsi"] or 50
    if (m["atrp"] or 1) < 0.006 and abs(m["r21"] or 1) < 0.03 and (m["range20"] or 1) < 0.04:
        return "LOCKED"
    if (m["chg1d"] or 0) <= -0.08 or (m["r5"] or 0) <= -0.15:
        return "SHOCK"
    if tt is None:
        return "NEW"
    rising200 = m["sma200"] > m["sma200_prev"]
    hip = m["hi52_prior"]
    # breakout: fresh 52w high in last 3 bars on volume, not yet extended
    if tt >= 6 and m["days_since_hi"] <= 2 and p >= hip * 0.995 and p <= hip * 1.06 and rsi_ <= 80 and (m["vol_ratio_recent"] or 0) >= 1.4:
        return "BREAKOUT"
    if tt >= 5 and (p > s50 * 1.22 or rsi_ >= 76 or (a and p > s20 + 3 * a)):
        return "EXTENDED"
    contraction = (m["atr10"] and m["atr"] and m["atr10"] < 0.9 * m["atr"]) or (m["range20"] is not None and m["range20"] < 0.12)
    if tt >= 7 and -0.08 <= m["from_hi"] <= -0.005 and contraction and 45 <= rsi_ <= 68:
        return "NEAR_PIVOT"
    if tt >= 5 and s50 > s200 and rising200 and a and (s50 - 1.0 * a) <= p <= max(s20, s50 + 1.0 * a) * 1.01 and 33 <= rsi_ <= 56 and -0.32 <= m["from_hi"] <= -0.03:
        return "PULLBACK"
    if p > s200 * 0.97 and rising200 and rsi_ <= 32:
        return "OVERSOLD_UP"
    if tt >= 7:
        return "STRONG"
    crossed = m["bars"] >= 220 and p > s200 and (m["r63"] or 0) > 0.12 and p > s50 and (m["sma50_prev"] is not None and s50 > m["sma50_prev"]) and not rising200
    if crossed:
        return "RECOVERY"
    if p < s200 and not rising200 and s50 < s200:
        return "DOWNTREND"
    return "NEUTRAL"


def plan(m, setup):
    """Return buy zone, stop, targets for the setup (None where no actionable plan)."""
    p, a = m["price"], m["atr"] or m["price"] * 0.03
    s20, s50, s200 = m["sma20"], m["sma50"], m["sma200"]
    hi = m["hi52"]
    zl = zh = stop = t1 = t2 = trig = None
    if setup == "BREAKOUT":
        piv = m["hi52_prior"]
        zl, zh = piv, piv * 1.03
        stop = max(piv - 1.5 * a, piv * 0.92)
        t1, t2 = piv * 1.2, piv * 1.35
    elif setup == "NEAR_PIVOT":
        trig = hi * 1.005
        zl, zh = trig, trig * 1.03
        stop = max(m["swing_low10"] - 0.25 * a, trig - 2.5 * a, trig * 0.9)
        t1, t2 = trig * 1.2, trig * 1.35
    elif setup == "PULLBACK":
        if s20 > s50 + 1.0 * a and p >= s20 - 0.75 * a:
            zl, zh = s20 - 0.6 * a, s20 + 0.3 * a
            stop = min(s50 - 0.25 * a, m["swing_low10"] - 0.25 * a)
        else:
            zl, zh = s50 - 0.6 * a, s50 + 0.5 * a
            stop = min(s50 - 1.75 * a, m["swing_low20"] - 0.25 * a)
        t1, t2 = hi, hi + 0.5 * (hi - stop)
    elif setup == "OVERSOLD_UP":
        zl, zh = p - 0.75 * a, p + 0.25 * a
        stop = min(p - 2.5 * a, s200 - 1.0 * a)
        t1, t2 = s20, s50
    elif setup in ("STRONG", "EXTENDED"):
        zl, zh = s50, max(s20, s50 + a)
        if setup == "EXTENDED":
            zl, zh = max(s20 - 0.5 * a, s50), s20 + 0.5 * a
        stop = min(s50, zl) - 1.5 * a
        t1, t2 = hi * 1.1, hi * 1.25
    elif setup == "RECOVERY":
        zl, zh = max(s200, s50 - 0.5 * a), s50 + 0.5 * a
        stop = min(s200, s50) - 1.5 * a
        t1, t2 = m["resistance"] or hi, hi
    elif setup in ("DOWNTREND", "NEUTRAL"):
        trig = s50 if setup == "DOWNTREND" else (m["resistance"] or hi)
    if zl is not None and zh is not None and zl > zh:
        zl, zh = zh, zl
    entry = None
    if zl is not None:
        entry = p if zl <= p <= zh else (zl + zh) / 2
        if setup in ("NEAR_PIVOT",):
            entry = zl
    rr = None
    if entry and stop and t1 and entry > stop:
        rr = (t1 - entry) / (entry - stop)
    return dict(zone_lo=zl, zone_hi=zh, trigger=trig, stop=stop, t1=t1, t2=t2, entry=entry, rr=rr)


def money(x):
    if x is None:
        return "–"
    return f"{x:,.2f} $".replace(",", " ").replace(".", ",") if x < 1000 else f"{x:,.0f} $".replace(",", " ")


def pct(x, sign=True):
    if x is None:
        return "–"
    s = f"{x*100:+.0f} %" if sign else f"{x*100:.0f} %"
    return s.replace("-", "−")


def describe(m, setup, pl):
    tt, rs = m.get("tt"), m.get("rs")
    head = f"Trendmall {tt}/8, RS {rs}" if tt is not None else f"{m['bars']} handelsdagar historik"
    loc = f"{pct(m['from_hi'])} från 52v-högsta, RSI {m['rsi']:.0f}" if m["rsi"] is not None else ""
    if setup == "BREAKOUT":
        act = f"Bröt nyss över {money(m['hi52_prior'])} på hög volym. Köp nära utbrottsnivån {money(pl['zone_lo'])}–{money(pl['zone_hi'])}, stop {money(pl['stop'])}, mål {money(pl['t1'])}."
    elif setup == "NEAR_PIVOT":
        act = f"Tight konsolidering under toppen. Köp vid utbrott över {money(pl['trigger'])} med volym, stop {money(pl['stop'])}, mål {money(pl['t1'])}."
    elif setup == "PULLBACK":
        act = f"Rekyl mot stigande 20/50-dagars. Köpzon {money(pl['zone_lo'])}–{money(pl['zone_hi'])}, stop {money(pl['stop'])}, mål {money(pl['t1'])}" + (f" ({pl['rr']:.1f}R)." if pl["rr"] else ".")
    elif setup == "OVERSOLD_UP":
        act = f"Kraftigt översåld men långsiktig trend intakt. Studs-köp {money(pl['zone_lo'])}–{money(pl['zone_hi'])}, stop {money(pl['stop'])}, mål 20-dagars {money(pl['t1'])}."
    elif setup == "STRONG":
        act = f"Stark trend men inget lågrisk-läge just nu. Köp vid rekyl till {money(pl['zone_lo'])}–{money(pl['zone_hi'])} (50/20-dagars)."
    elif setup == "EXTENDED":
        act = f"Långt över medelvärdena – hög risk att köpa här. Vänta på rekyl mot {money(pl['zone_lo'])}–{money(pl['zone_hi'])}."
    elif setup == "RECOVERY":
        act = f"Har återtagit 200-dagars efter nedtrend. Köp vid test av {money(pl['zone_lo'])}–{money(pl['zone_hi'])}, stop {money(pl['stop'])}."
    elif setup == "DOWNTREND":
        act = f"Under fallande 200-dagars ({money(m['sma200'])}). Inget köpläge – vänta tills kursen återtar 50-dagars {money(m['sma50'])} och bildar botten."
    elif setup == "NEW":
        act = "För kort historik för full trendanalys – bedöm på fundamenta och första bas."
    elif setup == "SHOCK":
        act = f"Föll {pct(m['chg1d'])} idag / {pct(m['r5'])} på en vecka. Köp inte in i raset – vänta på att en botten bildas (minst 1–3 veckor) och på återtag av 20-dagars {money(m['sma20'])}."
    elif setup == "LOCKED":
        act = "Kursen rör sig knappt – typiskt för ett accepterat uppköpsbud. Ingen swing-potential."
    else:
        act = f"Ingen tydlig trend. Bevaka utbrott över {money(pl['trigger'])} eller tydligt stöd vid {money(m['support'])}."
    return f"{head}. {loc}. {act}".replace(". .", ".").strip()


def setup_score(m, setup, pl):
    if setup in ("NEW", "LOCKED"):
        return 0
    tt, rs = m.get("tt") or 0, m.get("rs") or 0
    base = tt / 8 * 25 + rs / 99 * 20 + (m.get("rs1m") or 50) / 99 * 10
    bonus = {"PULLBACK": 20, "NEAR_PIVOT": 18, "BREAKOUT": 18, "OVERSOLD_UP": 10, "RECOVERY": 10, "STRONG": 6, "EXTENDED": 0, "NEUTRAL": 0, "DOWNTREND": -10, "SHOCK": -10}[setup]
    prox = 0
    if pl["zone_lo"] is not None and m["atr"]:
        p = m["price"]
        if pl["zone_lo"] <= p <= pl["zone_hi"]:
            prox = 12
        else:
            dist = min(abs(p - pl["zone_lo"]), abs(p - pl["zone_hi"])) / m["atr"]
            prox = max(0, 12 - 4 * dist)
    rrs = min(max((pl["rr"] or 0) - 0.5, 0), 3) / 3 * 15
    pen = 0
    if (m["atrp"] or 0) > 0.07:
        pen += 5
    if (m["dvol50"] or 0) < 2e7:
        pen += 4
    return round(max(0, min(100, base + bonus + prox + rrs - pen)))


out = []
for s, (r, a, m) in data.items():
    m["tt"] = trend_template(m)
    setup = classify(m)
    pl = plan(m, setup)
    if m["sma200"] is not None and m["sma200_prev"] is not None:
        stage = 2 if (m["price"] > m["sma150"] and m["sma150"] >= m["sma200"] and m["sma200"] > m["sma200_prev"]) else 4 if (m["price"] < m["sma150"] and m["sma200"] < m["sma200_prev"]) else 3 if m["sma200"] > m["sma200_prev"] else 1
    else:
        stage = None
    rec = {
        "s": s, "n": re.sub(r"\s+(Common Stock|Class A Common Stock|Class A Ordinary Shares|Ordinary Shares|American Depositary Shares|Common Shares|Class A|Inc\.)$", "", r["name"]).strip()[:60],
        "sec": r["sector"] or "–", "ind": r["industry"] or "–", "cty": r["country"] or "–", "ipo": r["ipoyear"] or "",
        "mc": cap(r), "ndx": s in ndx,
        "p": fnum(m["price"], 3), "d1": fnum(m["chg1d"], 4), "w1": fnum(m["r5"], 4), "m1": fnum(m["r21"], 4), "m3": fnum(m["r63"], 4), "m6": fnum(m["r126"], 4), "y1": fnum(m["r252"], 4), "ytd": fnum(m["ytd"], 4),
        "s20": fnum(m["sma20"]), "s50": fnum(m["sma50"]), "s200": fnum(m["sma200"]),
        "hi": fnum(m["hi52"]), "lo": fnum(m["lo52"]), "fh": fnum(m["from_hi"], 4), "rsi": fnum(m["rsi"], 1), "atrp": fnum(m["atrp"], 4),
        "dv": fnum(m["dvol50"], 0), "rs": m.get("rs"), "rs1m": m.get("rs1m"), "tt": m["tt"], "stg": stage,
        "set": setup, "sl": LABELS[setup], "sc": setup_score(m, setup, pl),
        "zl": fnum(pl["zone_lo"]), "zh": fnum(pl["zone_hi"]), "trg": fnum(pl["trigger"]), "st": fnum(pl["stop"]), "t1": fnum(pl["t1"]), "t2": fnum(pl["t2"]), "rr": fnum(pl["rr"], 2),
        "sup": fnum(m["support"]), "res": fnum(m["resistance"]), "vr": fnum(m["vol_ratio_y"], 2),
        "desc": describe(m, setup, pl),
    }
    out.append(rec)

out.sort(key=lambda x: -x["mc"])
json.dump(out, open(os.path.join(S, "data", "screen.json"), "w"), separators=(",", ":"))

# benchmarks / regime
bench = {}
for b in ["QQQ", "SPY", "IWM", "DIA", "^IXIC", "^NDX", "^GSPC", "^VIX", "^TNX", "DX-Y.NYB", "GLD", "TLT", "BTC-USD", "CL=F", "XLK", "XLY", "XLC", "XLF", "XLV", "XLI", "XLE", "XLB", "XLRE", "XLU", "XLP", "SMH", "IGV", "XBI", "RSP", "QQQE", "RDDT"]:
    a = load(b)
    if a is None:
        continue
    m = metrics(b, a)
    bench[b] = {k: fnum(m[k], 4) for k in ("price", "chg1d", "r5", "r21", "r63", "r126", "r252", "ytd", "sma20", "sma50", "sma200", "hi52", "lo52", "from_hi", "rsi", "atrp")}
json.dump(bench, open(os.path.join(S, "data", "bench.json"), "w"), indent=1)

# breadth
liq = [x for x in out if x["mc"] >= 3e8 and x["s200"]]
def frac(f):
    return round(sum(1 for x in liq if f(x)) / len(liq), 4)
breadth = {
    "n": len(liq),
    "above50": frac(lambda x: x["p"] > x["s50"]),
    "above200": frac(lambda x: x["p"] > x["s200"]),
    "near_high": frac(lambda x: x["fh"] is not None and x["fh"] >= -0.02),
    "new_high_cnt": sum(1 for x in liq if x["fh"] is not None and x["fh"] >= -0.001),
    "new_low_cnt": sum(1 for x in liq if x["lo"] and x["p"] <= x["lo"] * 1.001),
    "setups": {k: sum(1 for x in out if x["set"] == k) for k in LABELS},
    "session_frac": round(session_frac, 2),
    "asof": now.isoformat(),
}
sectors = {}
for x in liq:
    sectors.setdefault(x["sec"], []).append(x)
breadth["sectors"] = {
    k: {"n": len(v), "above200": round(sum(1 for x in v if x["p"] > x["s200"]) / len(v), 3),
        "med_m1": round(float(np.median([x["m1"] for x in v if x["m1"] is not None])), 4),
        "med_m3": round(float(np.median([x["m3"] for x in v if x["m3"] is not None])), 4),
        "med_rs": round(float(np.median([x["rs"] for x in v if x["rs"] is not None])), 1)}
    for k, v in sectors.items() if len(v) >= 10
}
inds = {}
for x in liq:
    inds.setdefault(x["ind"], []).append(x)
breadth["industries"] = sorted([
    {"ind": k, "n": len(v), "med_rs": float(np.median([x["rs"] for x in v if x["rs"] is not None] or [0])),
     "med_m3": float(np.median([x["m3"] for x in v if x["m3"] is not None] or [0])),
     "above200": round(sum(1 for x in v if x["p"] > x["s200"]) / len(v), 3)}
    for k, v in inds.items() if len(v) >= 6], key=lambda z: -z["med_rs"])
json.dump(breadth, open(os.path.join(S, "data", "breadth.json"), "w"), indent=1)
print("stocks:", len(out), "session_frac", round(session_frac, 2))
print(json.dumps({k: breadth[k] for k in ("n", "above50", "above200", "near_high", "new_high_cnt", "new_low_cnt", "setups")}, indent=1))

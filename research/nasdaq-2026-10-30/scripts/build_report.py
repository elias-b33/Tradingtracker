"""Assemble the Swedish Nasdaq report (single HTML file with embedded data)."""
import json, os, sys, math
import markdown

S = sys.argv[1]
sys.path.insert(0, os.path.join(S, "report"))
import content as C  # noqa: E402

D = os.path.join(S, "data")
screen = json.load(open(os.path.join(D, "screen.json")))
bench = json.load(open(os.path.join(D, "bench.json")))
breadth = json.load(open(os.path.join(D, "breadth.json")))
fund = json.load(open(os.path.join(D, "fund_parsed.json")))
by = {x["s"]: x for x in screen}


def load_hist(sym):
    p = os.path.join(D, "hist", sym.replace("^", "_") + ".json")
    if not os.path.exists(p):
        return None
    h = json.load(open(p))
    c = [x for x in (h.get("c") or []) if x is not None]
    return c


def r4(x):
    if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return None
    return float(f"{x:.4g}")


# ---------- compact rows ----------
COLS = ["s", "n", "sec", "ind", "mc", "p", "d1", "w1", "m1", "m3", "ytd", "y1", "fh", "rsi", "rs", "rs1m", "tt", "set", "sc",
        "zl", "zh", "trg", "st", "t1", "rr", "ndx", "desc", "s50", "s200", "hi", "lo", "dv", "atrp", "stg"]
rows = [[x.get(k) for k in COLS] for x in screen]

# ---------- sparklines (weekly closes, 1y) for liquid names ----------
spark = {}
for x in screen:
    if x["mc"] >= 3e8 or x["ndx"]:
        c = load_hist(x["s"])
        if c and len(c) >= 30:
            w = c[-252:][::5]
            if w[-1] != c[-1]:
                w.append(c[-1])
            spark[x["s"]] = [r4(v) for v in w]

# ---------- detailed charts ----------
CH = ["AMZN", "INTC", "RDDT", "GOOGL", "META", "NVDA", "MSFT", "AVGO", "ASML", "VRTX", "KDP", "BIIB", "NDAQ", "MANH", "ROST", "ZM", "TEAM",
      "AAPL", "LIN", "TXN", "ADI", "SPCX", "MU", "APP", "NFLX", "INTU", "CRWV", "QQQ", "SPY", "SMH"]
charts = {}
for s in CH:
    c = load_hist(s)
    if c:
        charts[s] = [r4(v) for v in c[-460:]]

LEVELS = {
    "AMZN": {"zones": [[225, 240, "Kärnköp"], [200, 215, "Öka"]], "stops": [[220, "Swing-stop"], [195, "Tesen bryts"]], "targets": [255, 287, 330]},
    "INTC": {"zones": [[58, 63, "Köp 1"], [48, 53, "Köp 2"]], "stops": [[44, "Tesen bryts"]], "targets": [80, 90]},
    "RDDT": {"zones": [[85, 95, "Köp 1"], [75, 85, "Köp 2"]], "stops": [[75, "Tesen bryts"]], "targets": [120, 135]},
    "GOOGL": {"zones": [[270, 285, "Köp 1"], [240, 250, "Köp 2"]], "stops": [[225, "Tesen bryts"]], "targets": [340, 408]},
    "META": {"zones": [[595, 625, "Köp 1"], [520, 560, "Köp 2"]], "stops": [[500, "Tesen bryts"]], "targets": [690, 780]},
    "NVDA": {"zones": [[195, 206, "Köp 1"], [170, 180, "Köp 2"]], "stops": [[160, "Tesen bryts"]], "targets": [221, 243]},
    "MSFT": {"zones": [[505, 525, "Köp"], [554, 570, "Utbrott"]], "stops": [[440, "Tesen bryts"]], "targets": [634, 665]},
    "AVGO": {"zones": [[310, 325, "Köp 1"], [285, 295, "Köp 2"]], "stops": [[275, "Tesen bryts"]], "targets": [368, 420]},
    "ASML": {"zones": [[1500, 1580, "Köp 1"], [1350, 1400, "Köp 2"]], "stops": [[1300, "Tesen bryts"]], "targets": [1800, 2000]},
}

# ---------- Nasdaq-100 verdicts ----------
BUYSET = {"PULLBACK", "BREAKOUT", "OVERSOLD_UP"}


def money(v):
    if v is None:
        return "–"
    s = f"{v:,.2f}" if v < 1000 else f"{v:,.0f}"
    return s.replace(",", " ").replace(".", ",") + " $"


def in_zone(x):
    if x["zl"] is None:
        return False
    a = (x["atrp"] or 0.03) * x["p"]
    return x["zl"] - 0.25 * a <= x["p"] <= x["zh"] + 0.25 * a


def ndx_verdict(x):
    s = x["s"]
    if s in C.NDX_OVERRIDE:
        return list(C.NDX_OVERRIDE[s])
    st = x["set"]
    if st in BUYSET and in_zone(x) and (x["rr"] or 0) >= 1.5:
        return ["Köp", "good", f"Köpzon {money(x['zl'])}–{money(x['zh'])}, stop {money(x['st'])}, mål {money(x['t1'])} ({(x['rr'] or 0):.1f}R)."]
    if st == "NEAR_PIVOT":
        return ["Köp vid utbrott", "info", f"Köp över {money(x['trg'])} med volym, stop {money(x['st'])}."]
    if st in ("STRONG", "EXTENDED", "RECOVERY", "PULLBACK", "BREAKOUT", "OVERSOLD_UP"):
        return ["Bevaka", "info", f"Köp vid rekyl till {money(x['zl'])}–{money(x['zh'])}." if x["zl"] else "Vänta på köpläge."]
    if st == "SHOCK":
        return ["Avvakta – kursras", "warn", "Kraftigt fall senaste dagarna. Vänta på stabilisering och en bas."]
    if st == "DOWNTREND":
        return ["Undvik", "bad", f"Nedtrend under fallande 200-dagars ({money(x['s200'])})."]
    if st == "NEW":
        return ["Bevaka", "info", "Kort historik."]
    return ["Avvakta", "neutral", "Ingen tydlig trend eller tydligt köpläge."]


ndx = {}
for x in screen:
    if x["ndx"]:
        v = ndx_verdict(x)
        ndx[x["s"]] = {"desc": C.NDX_DESC.get(x["s"], ""), "v": v}

# ---------- fundamentals subset ----------
FK = ["fpe1", "fpe2", "fpe_labels", "peg", "tgt", "tgt_up", "tgt_lo", "tgt_hi", "buy", "hold", "sell", "last_date", "last_surp", "fcf_ttm",
      "fcf_yield", "fcf_margin", "op_margin", "net_cash", "rev_growth_fy", "ocf_ttm", "capex_ttm", "rev_ttm", "q_ends"]
fsub = {}
for s, r in fund.items():
    fsub[s] = {k: (r4(r[k]) if isinstance(r.get(k), float) else r.get(k)) for k in FK if r.get(k) is not None}
if "RDDT" in fsub and bench.get("RDDT"):
    p = bench["RDDT"]["price"]
    if fsub["RDDT"].get("tgt"):
        fsub["RDDT"]["tgt_up"] = r4(fsub["RDDT"]["tgt"] / p - 1)

CF = ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "AVGO", "TSLA", "INTC", "RDDT"]
cash_table = []
for s in CF:
    r = fund.get(s, {})
    cash_table.append({"s": s, "ocf": r.get("ocf_ttm"), "capex": r.get("capex_ttm"), "fcf": r.get("fcf_ttm"), "fy": r.get("fcf_yield"),
                       "fm": r.get("fcf_margin"), "per": (r.get("q_ends") or [None])[0]})

# ---------- course ----------
md = open(os.path.join(S, "report", "course1.md")).read() + "\n\n" + open(os.path.join(S, "report", "course2.md")).read()
mdc = markdown.Markdown(extensions=["tables", "toc"], extension_configs={"toc": {"toc_depth": "1-2", "slugify": lambda v, sep: "k-" + "".join(ch if ch.isalnum() else "-" for ch in v.lower()).strip("-")}})
course_html = mdc.convert(md)
course_toc = mdc.toc_tokens

payload = {
    "asof": C.ASOF, "cols": COLS, "rows": rows, "spark": spark, "charts": charts, "levels": LEVELS, "bench": bench,
    "breadth": {k: breadth[k] for k in ("n", "above50", "above200", "near_high", "new_high_cnt", "new_low_cnt", "setups", "sectors")},
    "industries": breadth["industries"][:12] + breadth["industries"][-8:],
    "fund": fsub, "ndx": ndx, "cash": cash_table,
    "summary": C.SUMMARY, "macro": C.MACRO, "calendar": C.CALENDAR, "deep": C.DEEP, "picks": C.PICKS, "method": C.METHOD,
    "course": course_html, "toc": [{"id": t["id"], "name": t["name"], "children": [{"id": c["id"], "name": c["name"]} for c in t["children"]]} for t in course_toc],
}
data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
tpl = open(os.path.join(S, "report", "template.html")).read()
html = tpl.replace("/*__DATA__*/null", data)
out = os.path.join(S, "report", "nasdaq-lage.html")
open(out, "w").write(html)
print("wrote", out, round(len(html) / 1e6, 2), "MB", "rows", len(rows), "spark", len(spark), "charts", len(charts))

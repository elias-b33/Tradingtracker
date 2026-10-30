"""Parse Nasdaq API fundamentals into compact per-symbol valuation/cash-flow metrics."""
import json, os, re, sys, glob

S = sys.argv[1]
screen = {x["s"]: x for x in json.load(open(os.path.join(S, "data", "screen.json")))}


def num(v):
    if v in (None, "", "--", "N/A"):
        return None
    s = str(v).replace("$", "").replace(",", "").replace("%", "").strip()
    neg = s.startswith("(") or s.startswith("-")
    s = s.strip("()-")
    try:
        x = float(s)
    except ValueError:
        return None
    return -x if neg else x


def table(fin, name):
    t = (fin or {}).get(name) or {}
    hdr = t.get("headers") or {}
    rows = {}
    for r in t.get("rows") or []:
        rows[r.get("value1")] = [num(r.get(f"value{i}")) for i in range(2, 6)]
    return hdr, rows


out = {}
for p in glob.glob(os.path.join(S, "data", "fund", "*.json")):
    s = os.path.basename(p)[:-5]
    d = json.load(open(p))
    price = screen.get(s, {}).get("p")
    mc = screen.get(s, {}).get("mc")
    r = {}
    peg = d.get("peg") or {}
    try:
        r["peg"] = (peg.get("pegr") or {}).get("pegValue")
        pe = {x["x"]: x["y"] for x in (peg.get("per") or {}).get("peRatioChart") or []}
        r["pe_hist"] = pe
        est = sorted([k for k in pe if "Estimate" in k])
        r["fpe1"] = pe.get(est[0]) if est else None
        r["fpe2"] = pe.get(est[1]) if len(est) > 1 else None
        r["fpe_labels"] = est[:2]
        gr = {x["x"]: x["y"] for x in (peg.get("gr") or {}).get("peGrowthChart") or [] if x.get("z") == "Growth"}
        r["eps_growth"] = gr
    except Exception:
        pass
    fc = d.get("fcst") or {}
    try:
        yr = (fc.get("yearlyForecast") or {}).get("rows") or []
        r["eps_fy"] = [(x["fiscalEnd"], x["consensusEPSForecast"], x.get("up"), x.get("down")) for x in yr[:3]]
    except Exception:
        pass
    tg = (d.get("tgt") or {}).get("consensusOverview") or {}
    if tg:
        r["tgt"] = tg.get("priceTarget")
        r["tgt_lo"], r["tgt_hi"] = tg.get("lowPriceTarget"), tg.get("highPriceTarget")
        r["buy"], r["hold"], r["sell"] = tg.get("buy"), tg.get("hold"), tg.get("sell")
        if price and r["tgt"]:
            r["tgt_up"] = r["tgt"] / price - 1
    su = ((d.get("surp") or {}).get("earningsSurpriseTable") or {}).get("rows") or []
    if su:
        r["last_q"] = su[0].get("fiscalQtrEnd")
        r["last_date"] = su[0].get("dateReported")
        r["last_eps"] = su[0].get("eps")
        r["last_cons"] = num(su[0].get("consensusForecast"))
        r["last_surp"] = num(su[0].get("percentageSurprise"))
        r["surp_hist"] = [num(x.get("percentageSurprise")) for x in su[:4]]
    sm = ((d.get("sum") or {}).get("summaryData")) or {}
    if sm:
        r["div_yield"] = (sm.get("Yield") or {}).get("value")
        r["exch"] = (sm.get("Exchange") or {}).get("value")
    fq = d.get("fin_q")
    if fq:
        hdr, inc = table(fq, "incomeStatementTable")
        _, bal = table(fq, "balanceSheetTable")
        _, cf = table(fq, "cashFlowTable")
        r["q_ends"] = [hdr.get(f"value{i}") for i in range(2, 6)]
        rev = inc.get("Total Revenue")
        oi = inc.get("Operating Income")
        ni = inc.get("Net Income")
        ocf = cf.get("Net Cash Flow-Operating")
        capex = cf.get("Capital Expenditures")
        def ttm(x):
            return sum(v for v in x if v is not None) * 1000 if x and all(v is not None for v in x) else None
        r["rev_q"] = [v * 1000 if v is not None else None for v in rev] if rev else None
        r["rev_ttm"], r["oi_ttm"], r["ni_ttm"] = ttm(rev), ttm(oi), ttm(ni)
        r["ocf_ttm"], r["capex_ttm"] = ttm(ocf), ttm(capex)
        if r["ocf_ttm"] is not None:
            r["fcf_ttm"] = r["ocf_ttm"] + (r["capex_ttm"] or 0)
            if mc:
                r["fcf_yield"] = r["fcf_ttm"] / mc
            if r["rev_ttm"]:
                r["fcf_margin"] = r["fcf_ttm"] / r["rev_ttm"]
        if r.get("rev_ttm") and r.get("oi_ttm") is not None:
            r["op_margin"] = r["oi_ttm"] / r["rev_ttm"]
        cash = (bal.get("Cash and Cash Equivalents") or [None])[0]
        sti = (bal.get("Short-Term Investments") or [None])[0]
        ltd = (bal.get("Long-Term Debt") or [None])[0]
        std = (bal.get("Short-Term Debt / Current Portion of Long-Term Debt") or [None])[0]
        if cash is not None:
            r["net_cash"] = ((cash or 0) + (sti or 0) - (ltd or 0) - (std or 0)) * 1000
        r["capex_q"] = [v * 1000 if v is not None else None for v in capex] if capex else None
        r["ocf_q"] = [v * 1000 if v is not None else None for v in ocf] if ocf else None
    fa = d.get("fin_a")
    if fa:
        hdr, inc = table(fa, "incomeStatementTable")
        rev = inc.get("Total Revenue")
        r["fy_ends"] = [hdr.get(f"value{i}") for i in range(2, 6)]
        r["rev_fy"] = [v * 1000 if v is not None else None for v in rev] if rev else None
        if rev and rev[0] and rev[1]:
            r["rev_growth_fy"] = rev[0] / rev[1] - 1
        if r.get("rev_q") and r.get("rev_fy") and r["rev_q"][0]:
            pass
    out[s] = r
json.dump(out, open(os.path.join(S, "data", "fund_parsed.json"), "w"), indent=0)
print("parsed", len(out))
for s in ["AMZN", "INTC", "RDDT", "NVDA", "GOOGL", "MSFT", "AAPL", "META"]:
    if s in out:
        r = out[s]
        print(s, {k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items() if k in ("fpe1", "fpe2", "fpe_labels", "peg", "tgt", "tgt_up", "buy", "hold", "sell", "last_date", "last_surp", "fcf_ttm", "fcf_yield", "fcf_margin", "op_margin", "net_cash", "rev_growth_fy", "q_ends")})

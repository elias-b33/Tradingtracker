"""Fetch analyst/valuation/financial data from Nasdaq's public API for Nasdaq-100 + candidates."""
import json, os, sys, time, random, threading
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

S = sys.argv[1]
OUT = os.path.join(S, "data", "fund")
os.makedirs(OUT, exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
screen = json.load(open(os.path.join(S, "data", "screen.json")))
good = {"PULLBACK", "NEAR_PIVOT", "BREAKOUT", "OVERSOLD_UP", "RECOVERY", "STRONG"}
ndx = [x["s"] for x in screen if x["ndx"]]
cands = [x["s"] for x in screen if not x["ndx"] and x["set"] in good and x["mc"] >= 5e9 and (x["dv"] or 0) >= 2e7]
full = set(ndx) | {"RDDT"}
syms = list(dict.fromkeys(ndx + ["RDDT"] + cands))
print("symbols:", len(syms), "ndx:", len(ndx), "cands:", len(cands), flush=True)

EP = {
    "peg": "https://api.nasdaq.com/api/analyst/{s}/peg-ratio",
    "tgt": "https://api.nasdaq.com/api/analyst/{s}/targetprice",
    "surp": "https://api.nasdaq.com/api/company/{s}/earnings-surprise",
    "fcst": "https://api.nasdaq.com/api/analyst/{s}/earnings-forecast",
    "fin_q": "https://api.nasdaq.com/api/company/{s}/financials?frequency=2",
    "fin_a": "https://api.nasdaq.com/api/company/{s}/financials?frequency=1",
    "sum": "https://api.nasdaq.com/api/quote/{s}/summary?assetclass=stocks",
}


def get(url):
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, text/plain, */*"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r).get("data")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 ** attempt + random.random())
                continue
            return None
        except Exception:
            time.sleep(1 + attempt)
    return None


def work(s):
    path = os.path.join(OUT, s + ".json")
    if os.path.exists(path):
        return s, "skip"
    keys = list(EP) if s in full else ["peg", "tgt", "surp", "fcst", "sum"]
    res = {}
    for k in keys:
        res[k] = get(EP[k].format(s=s))
        time.sleep(0.15)
    json.dump(res, open(path, "w"))
    return s, "ok"


done = 0
with ThreadPoolExecutor(max_workers=5) as ex:
    for fu in as_completed([ex.submit(work, s) for s in syms]):
        done += 1
        if done % 50 == 0:
            print(done, flush=True)
print("done", done)

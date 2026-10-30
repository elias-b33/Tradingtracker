# Nasdaq-läget 30 oktober 2026

Analys av hela Nasdaq (3 405 aktier), Nasdaq-100, djupdykningar i Amazon, Intel och Reddit,
köplägen med nivåer samt en komplett aktiekurs på svenska.

- `rapport.html` – den färdiga interaktiva rapporten (öppna i webbläsaren). Publicerad som Claude-artifact:
  https://claude.ai/artifact/LAR3xKxA1MHCqP6D5bQYXs
- `research-notes.md` – fundamenta- och nyhetsresearch med källhänvisningar (Fable-agent, MAX).
- `report/course1.md`, `report/course2.md` – kursen (del 1–4).
- `scripts/` – datainsamling, beräkningar och bygget av rapporten.

## Köra om analysen

Kör från den här mappen (kräver Python 3 med `numpy` och `markdown`):

```bash
python3 scripts/fetch_hist.py . 0
python3 scripts/compute.py .
python3 scripts/fetch_fund.py .
python3 scripts/parse_fund.py .
python3 scripts/build_report.py .
```

`fetch_hist.py` förväntar sig `data/nasdaq_screener.json` och `data/ndx.json` från Nasdaqs öppna API
(`/api/screener/stocks?download=true` och `/api/quote/list-type/nasdaq100`). Rådata (cirka 100 MB)
checkas inte in. Texterna i `report/content.py` är skrivna för läget den 30 oktober 2026 och behöver
uppdateras vid en ny körning.

Analys och utbildning – inte personlig finansiell rådgivning.

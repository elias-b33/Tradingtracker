# Del 1 · Grunderna

## 1.1 Kassaflöde: företagets riktiga pengar

**Vinst** är en bokföringssiffra. **Kassaflöde** är pengar som faktiskt kommer in på eller går ut från bankkontot, och de två kan skilja sig mycket.

Påhittat exempel: Kafé AB, år 1.

| Resultaträkning | kr |
|---|---|
| Försäljning | 1 000 000 |
| Kostnader (råvaror, löner, hyra) | −740 000 |
| Avskrivning espressomaskin (300 000 kr delat på 5 år) | −60 000 |
| **Rörelseresultat** | **200 000** |
| Skatt 20,6 % | −41 200 |
| **Nettovinst** | **158 800** |

| Kassaflödesanalys | kr |
|---|---|
| Nettovinst | 158 800 |
| + Avskrivning (inga pengar lämnar kontot) | +60 000 |
| − Ökade kundfordringar | −50 000 |
| **= Operativt kassaflöde** | **168 800** |
| − Investeringar (capex): maskinen betalas nu | −300 000 |
| **= Fritt kassaflöde (FCF)** | **−131 200** |

Kaféet går med vinst men har mindre pengar på kontot efter året. Därför måste man titta på både vinst och kassaflöde.

**Kassaflödesanalysens tre delar**
1. **Löpande verksamhet (operativt kassaflöde):** vinsten justerad för poster som inte är kontanter (avskrivningar, aktieersättningar) och för förändringar i rörelsekapital (lager, kundfordringar, leverantörsskulder).
2. **Investeringsverksamhet:** capex (fabriker, datacenter, maskiner) och förvärv.
3. **Finansieringsverksamhet:** lån in eller ut, nyemissioner, återköp och utdelningar.

**Fritt kassaflöde = operativt kassaflöde − capex.** Det är pengarna som blir över till ägarna. Ett bolags teoretiska värde är summan av alla framtida fria kassaflöden, omräknade till dagens värde (en DCF-värdering).

**Fallgropar**
- **Aktieersättningar (SBC)** läggs tillbaka i kassaflödet men späder ut dig som ägare. Kolla om antalet aktier ökar över tid.
- **Capex för underhåll och för tillväxt:** Amazon har ett enormt operativt kassaflöde, men AI-investeringarna gör det fria kassaflödet negativt. Intel har under flera år investerat mer i fabriker än verksamheten genererat. Reddit är kapitallätt.
- **Rörelsekapital:** Amazon får historiskt betalt av kunderna innan bolaget betalar leverantörerna. Om lager och kundfordringar växer snabbare än försäljningen är det en varningssignal.

**Nyckeltal:** FCF-marginal = FCF / omsättning · FCF-yield = FCF / börsvärde (jämför med 10-årsräntan) · FCF-konvertering = FCF / nettovinst (varaktigt under cirka 80 % bör undersökas).

## 1.2 De tre finansiella rapporterna

**Resultaträkningen** visar lönsamheten under perioden. **Balansräkningen** visar vad bolaget äger och är skyldigt vid en viss tidpunkt. **Kassaflödesanalysen** visar vart pengarna tog vägen.

**Exempel AB** (miljoner kronor, Mkr):

| Rad | Mkr | Betyder |
|---|---|---|
| Nettoomsättning | 1 000 | Allt kunderna betalat |
| Kostnad sålda varor | −400 | Direkta kostnader |
| **Bruttoresultat** | **600** | Bruttomarginal 60 %, ett mått på prissättningsmakt |
| Försäljning och administration | −250 | |
| Forskning och utveckling | −150 | |
| **Rörelseresultat (EBIT)** | **200** | Rörelsemarginal 20 % |
| Räntor netto | −20 | |
| Resultat före skatt | 180 | |
| Skatt 20,6 % | −37 | |
| **Nettoresultat** | **143** | Nettomarginal 14,3 % |
| Antal aktier | 100 miljoner | |
| **Vinst per aktie (EPS)** | **1,43 kr** | |

Avskrivningarna är 50 Mkr, så **EBITDA** = 250 Mkr. EBITDA är bra för jämförelser men är inte pengar i fickan, eftersom maskinerna måste ersättas.

- **Trenden är viktigare än nivån.** Stigande marginaler när försäljningen växer kallas *operating leverage*, och det är ofta då aktier rusar.
- **Bruttomarginalen avslöjar affärsmodellen:** mjukvara 75–90 %, chip 40–75 %, detaljhandel 20–45 %.
- **GAAP och justerat:** återkommande "engångsposter" är inga engångsposter.

**Balansräkningen** (Tillgångar = Skulder + Eget kapital):

| Tillgångar | Mkr | Skulder och eget kapital | Mkr |
|---|---|---|---|
| Kassa | 150 | Leverantörsskulder | 100 |
| Kundfordringar | 120 | Räntebärande lån | 400 |
| Lager | 80 | **Eget kapital** | **500** |
| Maskiner och byggnader | 500 | | |
| Goodwill | 150 | | |
| **Summa** | **1 000** | **Summa** | **1 000** |

- **Nettoskuld** = lån − kassa = 250 Mkr. **Nettoskuld / EBITDA** = 1,0 gång (under cirka 2 är normalt, över 3–4 är riskabelt).
- **Goodwill** = överpris vid förvärv, vilket ger risk för nedskrivningar.
- **Lager och kundfordringar** ska växa ungefär i takt med försäljningen.

**Kassaflödet:** nettoresultat 143 + avskrivningar 50 + aktieersättningar 10 − ökat rörelsekapital 15 = **operativt kassaflöde 188** − capex 60 = **FCF 128 Mkr**. FCF-konverteringen är 90 % (bra). FCF minus aktieersättningar är 118 Mkr, det ärligaste måttet.

## 1.3 Värdering

Aktiekurs 30 kr:

| Nyckeltal | Uträkning | Resultat |
|---|---|---|
| Börsvärde | 30 × 100 miljoner aktier | 3 000 Mkr |
| EV | 3 000 + 400 − 150 | 3 250 Mkr |
| P/E | 30 / 1,43 | 21 |
| Forward P/E | 30 / väntad EPS 1,64 | 18,3 |
| PEG | 21 / 15 % tillväxt | 1,4 (under 1 billigt, 1–2 rimligt för kvalitet) |
| EV/EBITDA | 3 250 / 250 | 13 |
| EV/Sales | 3 250 / 1 000 | 3,25 |
| FCF-yield | 128 / 3 000 | 4,3 % |

**P/E betyder inget utan tillväxt.** P/E 15 med noll tillväxt kan vara dyrare än P/E 35 med 30 % tillväxt. Mycket låga P/E-tal är ofta *värdefällor*.

**Avkastning ≈ vinsttillväxt + förändring i multipel + utdelningar och återköp.** Med 15 % årlig vinsttillväxt i 5 år (EPS 1,43 → 2,88 kr):

| P/E om 5 år | Kurs | Totalt | Per år |
|---|---|---|---|
| 15 | 43 kr | +44 % | ~7,5 % |
| 21 | 60 kr | +101 % | ~15 % |
| 25 | 72 kr | +140 % | ~19 % |

Köpläget spelar alltså roll även för den långsiktige.

## 1.4 Kvalitet och vallgravar

**ROIC** = rörelseresultat efter skatt / (eget kapital + nettoskuld) = 159 / 750 = **21 %**. Om ROIC är högre än kapitalkostnaden (8–10 %) skapar tillväxt värde. Är den lägre förstör tillväxten värde.

| Vallgrav | Hur | Exempel |
|---|---|---|
| Nätverkseffekter | Bättre ju fler som använder tjänsten | Meta, Visa, Reddit |
| Byteskostnader | Dyrt eller jobbigt att byta | Microsoft, ASML |
| Skalfördelar | Störst blir billigast | Amazon, Costco, TSMC |
| Immateriella tillgångar | Varumärken, patent | Apple, läkemedel |
| Effektiv skala | Plats för bara en eller två aktörer | Börser, infrastruktur |

Fler kvalitetssignaler: stabila marginaler genom en hel cykel, nettokassa, minskande antal aktier, ledningen äger aktier och kapitalet allokeras klokt.

## 1.5 Vad driver aktiekursen?

**Lång sikt:** vinsttillväxt × förändring i multipel. *"På kort sikt är marknaden en röstningsmaskin, på lång sikt en vågmaskin"* (Graham).

**Kort sikt:**
1. **Utfall mot förväntningar.** Vinsten 1,10 mot väntade 1,00 kr, men guide 1,05 mot väntade 1,20, så aktien faller. Guidance betyder mer än kvartalet som varit.
2. **Räntor.** 100 kr om 10 år är värda 68 kr idag vid 4 % ränta men bara 56 kr vid 6 % (−17 %). Tillväxtaktier är mest räntekänsliga.
3. **Sentiment och flöden** (fondflöden, indexinkluderingar, sektorrotation, blankare som tvingas köpa).
4. **Makro.**

**Läs en kvartalsrapport på 10 minuter:** omsättningstillväxt (accelererar den?), marginaler, EPS mot konsensus, guidance mot konsensus, kassaflöde och capex, bolagets egna nyckeltal, antal aktier, och om aktien håller rapportgapet. *Implied move* från optionsmarknaden visar vad som var väntat.

## 1.6 Teknisk analys för swingtrading

**Trend:** upptrend = högre toppar och bottnar. Kurs över ett *stigande* 200-dagars betyder att stora investerare är köpare. 50-dagars är stöd i starka trender, och 20-dagars stöd för de allra starkaste. Golden cross och death cross är långsamma trendfilter. **Köp aldrig en fallande kniv** under ett fallande 200-dagars.

**Stöd och motstånd:** de som köpte vid 100 kr och såg kursen falla vill sälja vid 100, som blir motstånd. Efter ett utbrott blir 100 stöd (*rollbyte*). Rapportgap fungerar som nivåer som marknaden minns.

**Volym:** utbrott på 1,5–2 gånger normal volym tyder på att institutioner köper. Rekyler på låg volym är friska. Ras på hög volym är en varning.

**RSI:** 100 − 100 / (1 + snittuppgång / snittnedgång). Exempel: snittuppgång 2 och snittnedgång 1 ger RSI 67. Över 70 är överköpt, under 30 översålt. **I en upptrend är RSI 40–50 ett klassiskt köpläge.**

**ATR:** genomsnittlig daglig rörelse. En stop närmare än cirka 1,5–2 ATR blir ofta utlöst av brus. Volatila aktier kräver större avstånd och därmed mindre position.

**Relativ styrka:** ledarna stiger mer än index och faller mindre.

**De tre bästa uppläggen:** (1) rekyl till stigande 20- eller 50-dagars på låg volym och RSI 40–50, (2) utbrott ur en tight bas på hög volym, (3) översåld aktie (RSI under 30) i en långsiktig upptrend. Använd veckografen för trenden och dagsgrafen för köpläget.

## 1.7 Riskhantering

| Förlust | Uppgång som krävs |
|---|---|
| −10 % | +11 % |
| −25 % | +33 % |
| −50 % | +100 % |

**Antal aktier = (Portfölj × risk %) / (Köp − Stop).** Exempel: portfölj 200 000 kr, 1 % risk = 2 000 kr. Köp 96 kr, stop 89 kr ger 7 kr risk per aktie, alltså **285 aktier** (cirka 27 400 kr). **Avståndet till stopen bestämmer positionsstorleken.**

**R och förväntat värde:** mål 115 kr ger (115 − 96) / 7 = 2,7R. Med 40 % träffsäkerhet: vinster på 3R ger +0,6R per affär, 2R ger +0,2R, och 1R ger −0,2R. Tio förluster i rad med 1 % risk ger cirka −10 %, med 5 % risk cirka −40 %.

**Långsiktigt:** högst cirka 5–10 % per aktie, köp i omgångar och sälj när *tesen* bryts. Stop-loss skyddar inte mot gap på rapporter. Kontanter är också en position. **Låt aldrig en swingaffär som gått fel bli "långsiktig".**

## 1.8 Amerikanska aktier från Sverige

- **ISK:** ingen skatt på vinster. I stället årlig schablonskatt, de senaste åren omkring 0,9–1,1 % av kapitalet. Sedan 2025 finns ett skattefritt grundbelopp (150 000 kr 2025, enligt beslut 300 000 kr 2026 – dubbelkolla hos Skatteverket). Förluster är inte avdragsgilla. Nästan alltid bäst om du tror på positiv avkastning.
- **AF-konto:** 30 % skatt på vinster, men förluster är avdragsgilla.
- **Valuta:** USD/SEK påverkar din avkastning direkt. Under 2025 föll dollarn kraftigt mot kronan, medan den hittills i år har stigit cirka 7 %.
- **Avgifter:** valutaväxling (ofta runt 0,25 %). Ett valutakonto i USD minskar kostnaden. Utdelningar: 15 % amerikansk källskatt med blanketten W-8BEN.

**Checklista före köp:** affären och vallgraven → siffrorna (tillväxt, marginaler, FCF, ROIC, balansräkning) → värderingen → tekniken (trend och köpläge) → risken (stop, storlek, R:R ≥ 2) → timingen (rapporter och makro).

# Del 2 · Verktygen

## 2.1 Hur handeln fungerar
- **Limitorder** (nästan alltid), **marknadsorder** (farligt vid öppning och i illikvida aktier), **stop loss-order** (kan få sämre pris vid gap, som för Intel idag), **stop limit-order** (riskerar att inte gå igenom) och **trailing stop**.
- **Spread** är en dold kostnad: Amazon cirka 0,01 %, småbolag 1–3 %.
- **Öppettider:** normalt 15.30–22.00 svensk tid. När sommartiden byts vid olika datum i USA och Europa (slutet av mars och slutet av oktober) öppnar USA en timme tidigare. Rapporter släpps före öppning eller efter stängning, vilket ger **gap över natten**.

## 2.2 Index, ETF:er och sanningen om aktieval
Nasdaq Composite innehåller alla cirka 3 400 bolag, Nasdaq-100 de 100 största icke-finansiella och S&P 500 de 500 största i USA. ETF:er som QQQ och SPY följer index. **Omkring 85–90 % av aktiva fonder slår inte sitt index över 10–15 år.** Arbeta därför med **kärna och satellit**: 60–80 % i breda indexfonder och 20–40 % i egna aktieval. Mät alltid din avkastning mot index.

## 2.3 Värdering på djupet
**Förväntad avkastning ≈ FCF-yield + långsiktig tillväxt.** Exempel: 2 % + 8 % = cirka 10 %, eller 6 % + 2 % = cirka 8 %. **Omvänt test:** kräver du 10 % och FCF-yielden är 1 %, måste kassaflödet växa 9 % per år i evighet. Är det rimligt?

**Vinstavkastning** = 1 / P/E. P/E 25 ger 4 %, mindre än 10-årsräntan på 4,95 %, så du betalar för tillväxt. DCF är ett tankeverktyg, inte en sanning. Sum-of-the-parts: Amazon = AWS + annonser + e-handel. Köp med säkerhetsmarginal.

## 2.4 Branschnyckeltal

| Bransch | Styr aktien | Exempel |
|---|---|---|
| Mjukvara (SaaS) | ARR-tillväxt, net revenue retention (över 110 %), Rule of 40 | CRWD, PANW, DDOG |
| Halvledare | Orderingång, kundernas lager, bruttomarginal, capex-cykeln. **Cykliskt.** | NVDA, AMD, MU, INTC |
| Internet och annonser | DAU, ARPU, annonspriser | META, GOOGL, RDDT |
| Moln och AI | Molntillväxt, orderstock (RPO), avkastning på capex | AWS, Azure |
| Detaljhandel | Jämförbar försäljning, bruttomarginal, lageromsättning | COST, WMT |
| Bioteknik | Pipeline, FDA-beslut, kassa och runway | VRTX, REGN, MRNA |
| Energi | Oljepris, kostnad per fat, utdelning | FANG |

**Halvledare har ofta lägst P/E precis på toppen av cykeln.**

## 2.5 Konjunktur, räntor och rotation

| Fas | Leder |
|---|---|
| Tidig återhämtning | Banker, sällanköp, småbolag |
| Mitt i cykeln | Tech, industri |
| Sen cykel | Energi, råvaror |
| Inbromsning | Hälsovård, dagligvaror, kraftbolag |

Håll koll på kalendern: Fed (8 möten per år), KPI (mitten av månaden), jobbrapporten (första fredagen) och rapportsäsongerna. Krascher är normala: Nasdaq föll cirka 78 % 2000–2002 och cirka 35 % 2022, och S&P 500 har ett fall på i snitt cirka 14 % någon gång varje år.

## 2.6 Korrelation
Fem AI-chipaktier är i praktiken *en* satsning. Riktig diversifiering kräver olika drivkrafter: räntekänsligt, cykliskt, defensivt och olika valutor.

## 2.7 Psykologi

| Fallgrop | Exempel |
|---|---|
| Förankring | "Den var 142 $, så 65 $ är billigt" (Intel). Billig är den bara om värdet överstiger priset. |
| FOMO | SanDisk +394 % i år och sedan −34 % på en månad |
| Förlustaversion | Håller förlorare och säljer vinnare för tidigt |
| Bekräftelsebias | Läser bara det som stödjer den egna åsikten |
| Flockbeteende | Mest omtalad på forumen betyder ofta att aktien redan gått |
| Överkonfidens | Ökar insatsen efter några vinster |

**Botemedlet är en tradingjournal:** varför, köpzon, stop, mål, känsla och utfall.

## 2.8 Rapportsäsongen
Implied move visar vad marknaden väntar sig. Efter en mycket stark rapport driver aktien ofta vidare åt samma håll i veckor (*post-earnings drift*). Köp aldrig mer av en aktie som just brutit ned genom ett rapportgap utan ny bekräftelse.

## 2.9 Derivat, blankning och hävstång
Blankning och short squeeze. Bull/Bear-certifikat nollställs dagligen: om index går +10 % och sedan −10 % blir index −1 %, 2x −4 % och 3x −9 %. De är bara för kortsiktig handel. Optioner: se del 4.

## 2.10 Källor
SEC EDGAR (10-K, 10-Q, 8-K, Form 4), bolagens investerarsidor och samtalsutskrifter, TradingView, Finviz, FRED, CME FedWatch och Börsdata. Forum är bra för att se vad folk pratar om, men dåliga som beslutsunderlag.

**Lärordning:** vecka 1–2 rapporterna och kassaflöde → vecka 3–4 värdering → vecka 5–6 teknisk analys → vecka 7–8 riskhantering och egen regelbok → därefter små belopp eller papperstrading i 2–3 månader med journal.

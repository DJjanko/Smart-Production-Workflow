# Changelog — 18. maj 2026

## Povzetek seje

Obsežna seja fokusirana na **kakovostno ocenjevanje LLM odgovorov**, **izboljšave primerjalne strani** in **čiščenje arhitekture** (ločitev LocalGuard kot zastavice od AI modelov kot filtrov). Dodane so bile vse funkcionalnosti za diplomsko tezo: avtomatsko ocenjevanje, ročni popravki ocen, zebra-striping v diagramu, diagonalne oznake funkcij, prazna baza za testiranje in PowerShell startup skripta.

---

## Dodano

### LLM Evaluator — avtomatsko ocenjevanje odgovorov
- **Nov service** `backend/src/services/llm/evaluator.js`
- Po generiranju naravnega odgovora pokliče isti LLM model in oceni odgovor po dveh merilih:
  - **Kakovost** (`qualityScoreAuto`, 1–5): ali odgovor natančno zajame rezultat MCP klica
  - **Berljivost** (`readabilityScoreFinal`, 1–5): ali je odgovor razumljiv in primerno strukturiran
- Vrne tudi `faithfulToMcpResult` (boolean) in `evaluatorReason` (tekstualna utemeljitev)
- Evaluator se ne izvede, če `naturalResponse = false`

### ActivityLog — razširitev modela
Novi polja v `backend/src/models/ActivityLog.js`:
| Polje | Tip | Opis |
|---|---|---|
| `qualityScoreAuto` | Number | Avtomatska ocena kakovosti (1–5) |
| `readabilityScoreAuto` | Number | Avtomatska ocena berljivosti (1–5) |
| `qualityScoreFinal` | Number | Končna ocena (po ročnem popravku) |
| `readabilityScoreFinal` | Number | Končna ocena berljivosti |
| `scoreManuallyAdjusted` | Boolean | Ali je bila avtomatska ocena ročno spremenjena |
| `adjustmentNote` | String | Opomba o razlogu za popravek |
| `evaluatorReason` | String | Utemeljitev evaluatorja |
| `faithfulToMcpResult` | Boolean | Ali odgovor zvesto povzame MCP rezultat |
| `useGuard` | Boolean | Ali je bil lokalni guard aktiven |
| `naturalResponse` | Boolean | Ali je bil LLM naravni odgovor vklopljen |
| `accurate` | Boolean | Točnost dejanja (thumbs up/down) |
| `accuracyNote` | String | Opomba k oceni točnosti |

### API endpoint — ročni popravek ocen
- `PATCH /api/activity-log/:id/accuracy` — sprejme polja:
  - `accurate`, `accuracyNote`
  - `qualityScoreFinal`, `readabilityScoreFinal`
  - `scoreManuallyAdjusted`, `adjustmentNote`

### ComparisonPage — modal za ročni popravek
- Urejevalnik ocen kakovosti in berljivosti v `ActivityDetail` modalu
- Samodejno zazna ali je bila ocena spremenjena (`scoreManuallyAdjusted = true`)
- Polje za opombo (`adjustmentNote`) o razlogu popravka

### LocalGuard — kombinacijski regex vzorci
- Zaznava vzorcev tipa `(ustvari|dodaj|uredi|izbriši) + entiteta`
- Podpora za dvopičje (`znanje: plastika`) in brez (`znanje plastika`)
- Eksplicitno pravilo: `create_order` ≠ `process_work_order` (naročilo ne sproži workflow)
- Sporoči kateri podatki manjkajo, če ukaz ni popoln

### Ločitev LocalGuard od AI modelov (arhitekturna sprememba)
**Pred:** LocalGuard je bil vključen kot "rule" provider v filtrih in bar chartu  
**Po:**
- `LocalGuard` je samo zastavica (`useGuard = true/false`)
- Filtri so razdeljeni v dva ločena nivoja:
  1. **Provider filtri**: OpenAI | Ollama (samo AI modeli)
  2. **Flag filtri**: Brez | Guard | LLM odgovor | Guard + LLM odgovor
- Bar chart `PROVIDERS` ne vsebuje več `"rule"`

### ComparisonPage — izboljšave filtriranja
Nova logika flag filtrov (`frontend/src/pages/ComparisonPage.jsx`):
```js
if (!showAllFlags) {
  if (guardFilterOn && llmFilterOn)
    matchFlags = a.useGuard === true && a.naturalResponse === true;
  else if (guardFilterOn)
    matchFlags = a.useGuard === true;
  else if (llmFilterOn)
    matchFlags = a.naturalResponse === true;
  else
    matchFlags = a.useGuard === false && a.naturalResponse === false;
}
```

### ComparisonPage — Guard/LLM oznake na vsaki vrstici
- Vsaka vrstica v seznamskem pogledu prikaže 4 oznake:
  - `Guard ✓` / `Guard ✗` — ali je bil lokalni guard vklopljen
  - `LLM ✓` / `LLM ✗` — ali je bil naravni odgovor vklopljen
- Barvni razredi: `guardTag`, `noGuardTag`, `llmTag`, `llmOffTag`

### Bar chart — popoln redizajn (navpični stolpčni diagram)
- **Orientacija spremenjena**: horizontalni → **navpični** diagram (stolpci rastejo navzgor)
- **Osi zamenjani**: X-os = MCP funkcije (37), Y-os = vrednost metrike
- **Diagonalne oznake** (`transform: rotate(45deg)`) pod osnovno linijo — prihrani vertikalni prostor
- **Zebra ozadje** — vsaka druga MCP funkcija (stolpec) z rahlo drugačnim odtenkom
- **Odstranjene besedilne oznake** `Ollama` / `OpenAI` ob vsaki palici — samo barva + legenda
- **Horizontalno drsenje** — pomik vodoravno ko 37 funkcij ne ustreza širini
- **Tooltip** — `title` atribut na vsaki palici pokaže vrednost ob hoverju
- **Višina diagrama**: 240px, **širina stolpca**: 32px, **palica**: 12px na provider
- CSS razredi: `.barChartScrollWrap`, `.barChartCanvas`, `.barChartFnCol`, `.barChartFnBars`, `.barChartFnBar`, `.barChartFnName`

### Kompaktne stat kartice (`compactMetrics`)
- Glava ComparisonPage (OpenAI / mock / Ollama bloki) zmanjšana za ~50%
- Padding: `14px → 7px`, ikona: `36px → 22px`, font: `1.45rem → 0.95rem`

### Tabela (drugi pogled) — združena po providerju
- **Pred:** dve ločeni tabeli vzporedno, MCP funkcija v vsaki
- **Po:** ena tabela, MCP funkcija **samo enkrat levo**, nato barvne sekcije:
  - **OpenAI** — modra glava (`#1a8fc1`), subtilno modro ozadje celic
  - **Ollama** — oranžna glava (`#d4850a`), subtilno oranžno ozadje celic
- Stolpci po providerju: `N | ms | ✓ | ✗ | % | ⭐ | 📖`
- `table-layout: fixed`: MCP funkcija = 15%, Ollama = 15%, OpenAI = ~70%
- `max-width: 0` trik za `text-overflow: ellipsis` v fiksnih tabelah
- CSS razredi: `.mergedStatsTable`, `.mstFnCol`, `.mstUntested`

### Rezervacija delov — shramba posnetka
- Ob ustvarjanju delovnega naloga se shrani `reservedParts[]` (snapshot kateri in koliko delov je bilo rezerviranih)
- Ob brisanju delovnega naloga se zaloga sprosti (`inventory.reserved -= qty`)
- Preprečuje "zombie" rezervacije po brisanju

### Seed prazne baze (`seed_empty.js`)
- `npm run seed:empty`
- Ustvari minimalno, a konsistentno bazo za testiranje LLM-jev od nule:
  - 4 uporabniki: `admin`, `marko` (worker), `sara`, `tomaz`
  - 8 vrst rezervnih delov: PL-001, VI-M6, VI-08, VA-001, DIN-35, KU-20, GT-10, BC-50
  - 1 produkt: *Kovinsko ohisje A* (4 faze)
  - 2 naročili: AluTech (brez WO), Bauhaus → WO-001 (z 4 fazami, dodeljenimi delavcem)
  - Zalog delov nastavljenih na realistične vrednosti

### Startup skripta (`start.ps1`)
```powershell
# Odpre 4 terminale v pravilnem vrstnem redu:
# 1. Ollama (model qwen3:8b)
# 2. Backend (Node.js)
# 3. MCP strežnik (standalone)
# 4. Frontend (Vite)
```
- Dokumentirano v `README.md` pod poglavjem "Zagon"

### AboutPage (javna stran)
- Dostopna brez prijave
- Vsebuje: hero sekcija, grid funkcionalnosti, tech stack, demo kredenciali
- Temno transparentno ozadje čez SafeSilk gradient

---

## Popravljeno (Bug Fixes)

| # | Opis | Datoteka |
|---|---|---|
| 1 | `normalize(null)` crash → null check v normalize funkciji | `aiController.js` |
| 2 | `allReservedParts is not defined` v `processCustomerOrderItems` | `catalogController.js` |
| 3 | `productId required` napaka v seed (WorkOrderPhase) | `seed_empty.js` |
| 4 | `productId required` napaka v seed (Order) | `seed_empty.js` |
| 5 | `findOneAndUpdate` brez `$set` operatorja | `aiController.js` |
| 6 | OpenAI klical `process_work_order` namesto `create_product` | System prompt (CRITICAL pravilo) |
| 7 | `create_order` sprožil workflow namesto samo ustvaril naročilo | Guard regex + system prompt |
| 8 | `BarChartView PROVIDERS.map` se je sesul | Odstranil `"rule"` iz `PROVIDERS` |
| 9 | `"rule"` se je prikazal kot ločen provider stolpec v bar chartu | Arhitekturna ločitev LocalGuard |
| 10 | Filter je ostal vezan na prejšnjo sejo (casovni filter) | Popravek useMemo odvisnosti |

---

## Spremenjeno

### `backend/src/controllers/aiController.js`
- Uvoz `evaluateResponse` iz `evaluator.js`
- Klic evaluatorja po `naturalText` generiranju
- Patch ActivityLog z `useGuard` in `naturalResponse` ob vsakem klicu
- Sprejem `useGuard` in `naturalResponse` iz request body

### `frontend/src/components/CopilotPanel.jsx`
- `useGuard` privzeto: `false` (Guard IZKLOPLJEN)
- `naturalResponse` privzeto: `true` (LLM odgovor VKLOPLJEN)
- Oba sta CSS switch toggle-a

### `backend/src/models/ActivityLog.js`
- Dodanih 11 novih polj (glejte tabelo zgoraj)

### `frontend/src/styles.css`
- Novi razredi: `barChartGroup2`, `barChartFnLabel`, `barChartBars`, `barChartBar2Row`
- `chartMetricRow`, `chartMetricBtn` — izbirnik metrik
- `filterGroupSeparated`, `flagGroup` — ločeni filtri
- `comparisonTag` variante: `llmTag`, `llmOffTag`, `guardTag`, `noGuardTag`, `scoreTag`, `rScore`

### `README.md`
- Navodila za `npm run seed:empty`
- PowerShell ukazi za Ollama (`ollama run qwen3:8b`)
- Poglavje "Zagon" s `start.ps1`

---

## Arhitektura sistema (končno stanje)

```
Uporabnik (chat)
    │
    ├─ Guard ON  → LocalGuard (regex, ~1ms) → MCP Tool → [evaluator] → naturalText
    │
    └─ Guard OFF → LLM (OpenAI/Ollama) → MCP Tool → [evaluator] → naturalText
                           ↑
                  gpt-4.1-mini / qwen3:8b
```

### MCP orodja (37 skupaj)
| Kategorija | Orodja |
|---|---|
| Delovni nalogi | `process_work_order`, `create_work_order_only`, `process_existing_order`, `create_work_order_record`, `get_work_orders`, `update_work_order`, `delete_work_order`, `complete_work_order_for_approval`, `summarize_work_order` |
| Faze | `get_work_order_phases`, `create_work_order_phase`, `update_work_order_phase`, `delete_work_order_phase`, `generate_work_order_phases`, `get_my_phases`, `get_my_work_orders` |
| Naročila | `get_orders`, `create_order`, `update_order`, `delete_order` |
| Izdelki | `get_products`, `create_product`, `update_product`, `delete_product` |
| Deli | `get_parts`, `create_part`, `update_part`, `delete_part` |
| Zaposleni | `get_employees`, `create_employee`, `update_employee`, `delete_employee` |
| Zaloga | `check_inventory`, `check_product_availability`, `get_employee_workload` |
| Opozorila | `create_supply_alert`, `get_supply_alerts` |

### Ocenjevalni sistem
```
LLM odgovor (naturalText)
    │
    └─ evaluator.js (isti LLM model)
           ├─ qualityScoreAuto (1–5)
           ├─ readabilityScoreAuto (1–5)
           ├─ faithfulToMcpResult (bool)
           └─ evaluatorReason (string)
                   │
                   └─ Ročni popravek v ComparisonPage → qualityScoreFinal, readabilityScoreFinal
```

---

## Datoteke (ustvarjene / bistveno spremenjene)

| Datoteka | Status | Opis |
|---|---|---|
| `backend/src/services/llm/evaluator.js` | **NOVO** | LLM evaluator za kakovost in berljivost |
| `backend/src/seed_empty.js` | **NOVO** | Prazna baza za testiranje |
| `start.ps1` | **NOVO** | PowerShell startup skripta |
| `frontend/src/pages/AboutPage.jsx` | **NOVO** | Javna info stran |
| `backend/src/models/ActivityLog.js` | Razširjeno | +11 novih polj |
| `backend/src/controllers/aiController.js` | Razširjeno | Evaluator, guard/naturalResponse flags |
| `frontend/src/pages/ComparisonPage.jsx` | Večji rewrite | Ločeni filtri, Guard/LLM oznake, bar chart |
| `frontend/src/styles.css` | Razširjeno | Bar chart, filter, tag CSS razredi |
| `README.md` | Posodobljeno | seed:empty, start.ps1, Ollama ukazi |
| `ASSISTANT_COMMANDS.md` | Posodobljeno | Vsi 37 MCP ukazov za admin in worker |

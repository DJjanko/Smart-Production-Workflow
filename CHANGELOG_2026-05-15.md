# Changelog — 15. maj 2026

## Povzetek seje

Obsežna razvojna seja ki je zaključila vse ključne funkcionalnosti sistema. Fokus je bil na: MCP/LLM arhitekturi, primerjalni strani, pravicah, UI izboljšavah in pripravi za testiranje diplomske naloge.

---

## Dodano

### MCP tooli
- `process_existing_order` — pretvori obstoječe naročilo v delovni nalog s polnim workflow
- `process_work_order` razširjen za **več izdelkov** hkrati (`args.items` array)
- `get_my_phases` — vrne faze dodeljene prijavljenemu delavcu
- `get_my_work_orders` — vrne delovne naloge z delavčevimi fazami
- `create_supply_alert` — delavec pošlje opozorilo adminu za manjkajoče dele
- `get_supply_alerts` — admin vidi odprta opozorila

### LLM naravni odgovor
- Nov service `backend/src/services/llm/responseFormatter.js`
- Po izvedbi MCP toola pokliče LLM še enkrat da oblikuje naravni odgovor
- Toggle **"LLM odgovor"** v assistant chatu
- `naturalText` se vrne v API odgovoru in prikaže v chat bubblu

### Guard toggle
- Toggle **"Guard"** v assistant chatu (CSS switch)
- Ko je izklopljen → vse gre direktno na LLM brez lokalnega guarda
- Podpora za `useGuard` flag skozi cel stack (frontend → aiController → interpretCommandWithProvider)

### Primerjalna stran (ComparisonPage) — popoln rewrite
- **Split view** — OpenAI levo 50%, Ollama desno 50% (vsi 3 pogledi)
- **Statistična tabela** — vse MCP funkcije, testirane + netestirane (`/`)
- **Bar chart** — grupiran po funkciji, oranžna=Ollama, modra=OpenAI, abecedno
- **Seznam pogled** — klik za detail modal z vhodom/izhodom
- **Ocena točnosti** — thumbs up/down + opomba na vsak ActivityLog vnos
- **Filtri**: OpenAI | Ollama | LocalGuard | LLM odgovor | Vse/Teden/Dan
- LocalGuard deluje kot filter (ne odpira lastnega stolpca)

### ActivityLog razširitve
- Novi fieldi: `accurate` (Boolean), `accuracyNote` (String), `useGuard` (Boolean), `naturalResponse` (Boolean)
- PATCH endpoint `PATCH /api/activity-log/:id/accuracy`

### Seed v2
- `backend/src/seed2.js` — bolj realistični demo podatki
- 4 produkti (Kovinsko ohisje A, Elektricna omarica B, Pumpa, Lopata)
- 8 rezervnih delov (vključno z VI-08, GT-10, BC-50)
- 5 zaposlenih z user accounts (Marko, Sara, Tomaz)
- 2 supply alert (VA-001, GT-10)
- `npm run seed2` script

### Dokumentacija
- `ASSISTANT_COMMANDS.md` — vsi ukazi za admina in delavca, organizirani po entitetah
- Help modal v assistant chatu s klikabilnimi primeri

### UI izboljšave
- **ConfirmDeleteModal** na vseh straneh (Izdelki, Deli, Zaposleni, Naročila, Delovni nalogi)
- **StatusBadge barve** v vseh dropdownih (okrogla pika za naročila/WO, kvadrat za faze)
- **Gradient** po statusu faze (casovnica faz, podrobnosti WO)
- **Zebra striping** za zaloga in zasedenost panele
- **Delovni nalogi brez naročila** — sivo ozadje + "brez naročila" oranžni badge
- **Pregled delavca** — graf razporeditve faz/nalogov, status barve, phaseItem slog
- Casovnica faz filter — samo WO ki imajo faze v izbranem tednu
- WorkOrdersTimeline — dodan status filter
- Datumi v casovnici faz → ↑ zgoraj / ↓ spodaj (ločeni vrstici)

### Pravice
- `ADMIN_ONLY_TOOLS` set — worker dobi 403 za admin operacije
- Worker lahko posodablja samo **svoje** faze (`update_work_order_phase`)
- `update_work_order_phase` blokira posodobitev pri **sold/issued** delovnih nalogih
- AI routes (`/api/ai/*`) — odprte za vse prijavljene (ne samo admin)

---

## Popravljeno

### LLM/Guard arhitektura
- Lokalni guard refaktoriran z **verb+entity** vzorcem (namesto boolean zastavic)
- `parseStructuredProductCommand` za kompleksne `create_product` ukaze
- `isComplexStructured` — ukazi z 2+ `znanje:` gredo direktno na LLM
- `sanitizeInterpretation` — posebna obravnava za `process_existing_order`, `create_supply_alert`, `get_my_phases`, itd.
- `normalize(null)` → vrne "" (ne crasha)
- OpenAI prompt — jasno razlikovanje med `create_product` in `process_work_order`
- `create_order` vs `process_work_order` — "ustvari naročilo" ne sproži workflowa

### MCP tool popravki
- `updateCrudProduct` — `addPhase`/`addRequiredPart` sprejme **eno ali array**
- `createCrudOrder` — resolva `productName` → `productId` za vse items
- `create_product` handler — `addRequiredPart` podpora (SKU lookup po kreiranju)
- `formatValidationError` — `e.properties?.enumValues` (ne `e.enumValues`)
- Enum vrednosti — reverse mapping (slovensko → angleško) v `normalizeEnumValue`
- `get_work_order_phases` — filtrira po `workOrderCode` (ne vrača vseh faz)
- `process_work_order_items` — združen z `process_work_order` (en intent za 1 ali N)
- Work order delete — sprosti `reservedQuantity` za končne izdelke IN rezervne dele
- `reservedParts` snapshot shranjen ob kreiranju delovnega naloga

### Frontend popravki
- `api.js` — `data?.result?.message` dodan v error handling
- WorkloadPanel — `employee.id` (ne `_id`) za selectedIds primerjavo
- `phaseColor` preseljena v skupni `i18n.js` util
- `renderResultDetails` — brez `slice(0, 12)` omejitve
- `resultSummary > div` — `flex-direction: column` za pravilni prikaz WO kode in faz

---

## Stanje aplikacije

### Arhitektura
```
React (Vite) → Express API → LLM (Ollama/OpenAI) → MCP Tools → MongoDB
```

### LLM providers
| Provider | Model | Vloga |
|---|---|---|
| Ollama | qwen3:8b (lokalni) | Primary za test brez interneta |
| OpenAI | gpt-4.1-mini (cloud) | Primerjava, kompleksni ukazi |
| LocalGuard | regex/pravila | Hiter interceptor pred LLM |

### MCP tooli (37 skupaj)
Pokrito: get/create/update/delete za parts, employees, products, orders, work_orders, work_order_phases + workflow tooli + worker-specific tooli.

### Pravice
- **Admin**: vse operacije
- **Worker**: get_*, get_my_*, create_supply_alert, update_work_order_phase (samo lastne, ne sold/issued)

### Primerjava — 4 kombinacije za diplomsko nalogo
| | Guard ON | Guard OFF |
|---|---|---|
| Strukturiran odgovor | Hiter, regex interceptor | Vedno LLM |
| LLM naravni odgovor | Guard + LLM format | 2x LLM klic |

### Znane omejitve
- `create_product` z enim ukazom podpira 1 fazo + 1 del (za več → OpenAI ali UI forma)
- Stari ActivityLog vnosi nimajo `useGuard`/`naturalResponse` (nastavljeni testno)
- `complete_work_order_for_approval` beleži provider iz konteksta, ne iz AI klica

---

## Commit message

```
feat: comparison page rewrite, natural LLM response, guard toggle, worker permissions

- Complete rewrite of ComparisonPage with split view (50/50), stats table,
  bar chart, accuracy marking per ActivityLog entry
- Add LLM natural response toggle and responseFormatter.js service
- Add useGuard toggle (CSS switch) in assistant chat panel
- Add useGuard/naturalResponse/accurate/accuracyNote fields to ActivityLog
- Refactor local guard to verb+entity pattern for cleaner intent detection
- Add process_existing_order, get_my_phases, get_my_work_orders, create_supply_alert
- Extend process_work_order to support multiple products (items array)
- Add ADMIN_ONLY_TOOLS permission set; worker can only edit own phases
- Block phase updates on sold/issued work orders
- Add ConfirmDeleteModal to all CRUD pages
- Add responseFormatter.js for post-MCP LLM response generation
- Add seed2.js with more realistic demo data (4 products, 8 parts, 5 employees)
- Add ASSISTANT_COMMANDS.md and Help modal in assistant chat
- Fix createCrudOrder product resolution, addPhase/addRequiredPart arrays,
  get_work_order_phases filter, enum validation, normalize(null) crash
- Improve UI: status gradients, zebra striping, phase colors, date split display
```

---

## PR message

**Title:** `feat: LLM comparison infrastructure, natural responses, worker permissions & UI polish`

**Summary:**

This PR completes the core functionality for the diploma thesis comparing Ollama and OpenAI in a production workflow context.

### Key changes

**LLM & Guard architecture:**
- Added `useGuard` toggle — when OFF, commands bypass the local guard and go directly to the LLM, enabling clean A/B testing
- Added `naturalResponse` toggle — after MCP tool execution, the LLM formats a human-readable summary of the result
- New `responseFormatter.js` service handles the secondary LLM call independently

**Comparison page:**
- Full rewrite with split view (Ollama left, OpenAI right, 50/50)
- Stats table showing ALL 37 MCP functions (tested + untested with `/` placeholders)
- Bar chart grouped by function with alphabetical ordering for side-by-side comparison
- Per-entry accuracy marking (👍/👎) with notes, stored in ActivityLog
- Filters: provider, LocalGuard, LLM response, date (day/week)

**Permissions:**
- `ADMIN_ONLY_TOOLS` set enforces role-based access in MCP layer
- Workers can only update phases assigned to them
- Sold/issued work orders are locked for phase updates

**MCP improvements:**
- `process_work_order` now handles 1 or N products in a single command
- `process_existing_order` converts a draft order into a full production workflow
- `create_supply_alert` / `get_my_phases` / `get_my_work_orders` for worker role
- Work order deletion now releases both finished product and spare part reservations

**Test plan:**
- [ ] Test all 4 combinations: Guard ON/OFF × LLM response ON/OFF
- [ ] Verify split view comparison for common commands (get_parts, create_order, etc.)
- [ ] Confirm accuracy marking persists across page reloads
- [ ] Test worker login — admin tools should return 403
- [ ] Run `npm run seed2` and verify clean state
- [ ] Test `process_existing_order` and multi-product `process_work_order`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

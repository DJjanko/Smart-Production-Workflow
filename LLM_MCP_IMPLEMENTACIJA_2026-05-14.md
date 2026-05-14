# LLM in MCP implementacija - stanje 14. 05. 2026

Ta dokument opisuje, kaj je bilo dodano za Assistant, Ollama, MCP orodja, potrditve akcij in povezavo z obstojecim proizvodnim workflowom.

## Kratek povzetek

Aplikacija ima zdaj dve poti:

1. Rocna pot prek UI strani, na primer gumb na strani Delovni nalogi ali Narocila.
2. AI pot prek Assistant panela, kjer uporabnik napise ukaz, LLM oziroma lokalni guard ga prevede v intent, potem pa backend izvede MCP tool.

Pomembno: rocni klik za delovni nalog trenutno ne gre cez MCP. Gre direktno cez REST endpoint in workflow service. V activity logu je oznacen kot `mock`, ker ni bil uporabljen LLM provider.

## Rocni delovni nalog in narocila

Rocno ustvarjanje delovnega naloga:

- frontend: `frontend/src/pages/WorkOrdersPage.jsx`
- API: `POST /api/work-orders`
- backend controller: `backend/src/controllers/catalogController.js`, funkcija `createManualWorkOrder`
- workflow: `backend/src/services/workflowService.js`
  - `processCustomerOrder`
  - `processCustomerOrderItems`

To pomeni:

- ne gre cez `executeMcpTool`
- ne gre cez Assistant
- ne uporablja Ollame
- v `ActivityLog.llmProvider` je `mock`, ker je to rocni sistemski dogodek

Narocila brez delovnega naloga:

- dobijo status `draft` oziroma `osnutek`
- so v UI obarvana drugace
- imajo gumb `Ustvari nalog`
- klik poklice `POST /api/orders/:id/create-work-order`
- backend uporabi obstojeci `Order._id` in ustvari `WorkOrder.orderId = Order._id`
- ne ustvari novega podvojenega narocila

Pretvorba narocila v delovni nalog:

- controller: `convertOrderToWorkOrder`
- workflow: `processExistingOrder`
- naredi preverjanje zaloge, rezervacije, narocanje manjkajocih delov, faze in dodelitve zaposlenim

## Assistant pot

Assistant pot se zacne v:

- frontend: `frontend/src/components/CopilotPanel.jsx`
- App state: `frontend/src/App.jsx`
- API klic: `frontend/src/api.js`, `runCommand`
- backend route: `POST /api/ai/commands`
- controller: `backend/src/controllers/aiController.js`, funkcija `runCommand`

Tok:

1. Uporabnik vpise ukaz.
2. Frontend poslje `{ command, provider }`.
3. Backend poklice `interpretCommandWithProvider`.
4. Interpreter vrne intent, na primer `get_parts`, `update_product`, `process_work_order`.
5. Backend poklice `executeMcpTool`.
6. MCP tool izvede akcijo nad MongoDB/workflow service.
7. Rezultat se vrne v chat in zapise v `ActivityLog`.

## Ollama

Ollama je trenutno glavni LLM provider.

Nastavitve so v `backend/.env`:

```env
LLM_DEFAULT_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_TIMEOUT_MS=180000
```

Backend ne zaganja Ollame. Ollama mora biti ze zagnana kot servis ali rocno prek `ollama serve`.

Preverjanje:

```powershell
ollama list
ollama ps
```

Ce je model ze nalozen v RAM, je odziv hitrejsi. Cas drzanja modela v RAM-u lahko nastavis z `OLLAMA_KEEP_ALIVE`, ce bos to dodal v sistemsko okolje ali v nacin zagona Ollame.

## OpenAI

OpenAI se ni implementiran kot pravi API provider.

Trenutno:

- UI ima izbiro `OpenAI`
- backend pa za provider, ki ni `ollama`, uporabi fallback `interpretCommand`
- to je deterministicni/mock interpreter, ne OpenAI API

Za OpenAI je se treba dodati:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- provider datoteko, na primer `backend/src/services/llm/openaiProvider.js`
- vejo v `interpretCommandWithProvider`, ki poklice OpenAI namesto fallbacka
- merjenje in primerjave: cas, tocnost izbire intenta, pravilnost argumentov, razumljivost odgovora, cena, stabilnost

## Pravila za LLM

Glavna pravila so v:

- `backend/src/services/llm/prompt.js`

Tam je prompt za model. V njem so pravila, kateri intent naj izbere.

Primeri pravil:

- ce uporabnik zeli ustvariti proizvodni tok, uporabi `process_work_order`
- ce uporabnik napise `SAMO delovni nalog`, uporabi `create_work_order_only`
- ce sprasuje po zalogi rezervnih delov, uporabi `get_parts`
- ce sprasuje po zalogi izdelkov, uporabi `get_products`
- ce sprasuje po vseh zaposlenih, uporabi `get_employees`
- izdelki nimajo obveznega SKU
- rezervni deli imajo obvezen SKU
- create/update/delete potrebujejo potrditev

## Lokalni guard

Poleg LLM prompta obstaja se lokalni guard:

- `backend/src/services/llm/index.js`

To je pomembno, ker lokalni guard popravi najpogostejse primere brez cakanja na Ollamo.

Primeri, ki jih guard ujame:

- `preveri zalogo delov` -> `get_parts`
- `preveri zalogo izdelkov` -> `get_products`
- `Prikazi narocila za AluTech` -> `get_orders` s filtrom `search: "AluTech"`
- `Prikazi mi vse zaposlene` -> `get_employees`
- `Spremeni zalogo izdelka Elektricna omarica B na 5` -> `update_product`
- `Spremeni Vijak M8 (VI-08), zalogo na voljo na 4 in min zalogo na 3` -> `update_part`
- `Spremeni delovni nalog WO-007 status na koncan, zalogo na missing` -> `update_work_order`

Ta guard je razlog, da ni treba vedno natanko pisati anglesko. Dodan je tudi popravek za napako `spremni`.

## MCP registry v backendu

MCP orodja so definirana v:

- `backend/src/services/mcp/tools.js`

Glavna funkcija:

- `executeMcpTool({ toolName, args, actor, provider, rawInput })`

Ta registry uporablja Assistant pot. To ni locen server, ampak interna backend funkcija.

Trenutno pomembna orodja:

- `process_work_order`
- `create_work_order_only`
- `generate_work_order_phases`
- `check_product_availability`
- `get_employee_workload`
- `summarize_work_order`
- `get_parts`, `create_part`, `update_part`, `delete_part`
- `get_products`, `create_product`, `update_product`, `delete_product`
- `get_employees`, `create_employee`, `update_employee`, `delete_employee`
- `get_orders`, `create_order`, `update_order`, `delete_order`
- `get_work_orders`, `create_work_order_record`, `update_work_order`, `delete_work_order`
- `get_work_order_phases`, `create_work_order_phase`, `update_work_order_phase`, `delete_work_order_phase`

Info orodja (`get_*`) ne potrebujejo potrditve.

Create/update/delete orodja potrebujejo potrditev.

## Standalone MCP server

Standalone MCP server je dodan v:

- `backend/src/mcp/server.js`

Zagon:

```powershell
cd backend
npm run mcp
```

Ta server uporablja stdio transport in registrira ista orodja kot backend registry.

Pomembno:

- `npm run dev` ne zazene standalone MCP serverja
- `npm run dev` zazene samo Express backend
- Assistant znotraj aplikacije ne potrebuje standalone MCP serverja, ker uporablja interni registry
- standalone MCP server je namenjen zunanjim MCP klientom

## Potrditve akcij

Akcije, ki spreminjajo podatke, vrnejo pending action.

Model:

- `backend/src/models/PendingMcpAction.js`

Controller:

- `backend/src/controllers/aiController.js`

Endpointi:

- `GET /api/ai/pending-actions`
- `PUT /api/ai/pending-actions/:id/accept`
- `PUT /api/ai/pending-actions/:id/decline`

Frontend:

- `frontend/src/components/CopilotPanel.jsx`
- gumbi `Potrdi` in `Zavrni`

Po potrditvi se akcija izvede z `confirmed: true`.

Po zavrnitvi se ne izvede.

Ko uporabnik klikne `Potrdi` ali `Zavrni`, se kartica potrditve v chatu skrije oziroma oznaci kot resena.

## Dnevnik aktivnosti

Model:

- `backend/src/models/ActivityLog.js`

Endpoint:

- `GET /api/activity-log`

Filtri:

- `limit=30|50|100`
- `mine=true`
- `date=YYYY-MM-DD`

Frontend:

- `frontend/src/components/CopilotPanel.jsx`
- modal `Dnevnik aktivnosti`
- prikaze uporabnikov vnos, JSON vhod, JSON izhod in dejanski prikaz

Za `get_parts`, `get_products`, `get_orders` in druge `get_*` klice se zdaj v log shranijo tudi `items`, ne samo `count`, zato lahko modal prikaze kartice.

## Primeri uporabe

Preverjanje zaloge delov:

```text
preveri zalogo delov
```

Preverjanje zaloge izdelkov:

```text
preveri zalogo izdelkov v shrambi
```

Seznam zaposlenih:

```text
Prikazi mi vse zaposlene
```

Filtrirana narocila:

```text
Prikazi narocila za AluTech
```

Ustvarjanje rezervnega dela:

```text
Naredi novi rezervni del Vijak M8 (VI-08), ki ima kolicino 5
```

Urejanje rezervnega dela:

```text
Spremeni Vijak M8 (VI-08), tako da zalogo na voljo das na 4 in min zalogo na 3
```

Urejanje izdelka:

```text
Spremeni zalogo izdelka Elektricna omarica B na 5
```

Dodajanje faze izdelku:

```text
Spremeni fazo pri izdelku Kovinsko ohisje A, Rezanje naj traja 70 min
```

Ustvarjanje workflow delovnega naloga:

```text
Ustvari delovni nalog za 2 kosa izdelka Kovinsko ohisje A za podjetje Emmiter do 21.6.2026, 23:15
```

Ce ima izdelek ze zalogo na polici, lahko workflow del ali vse kose vzame iz koncne zaloge. Takrat je `toProduce` lahko 0 in faze se ne ustvarijo, ker ni nic za proizvesti.

Ce zelis proizvodnjo in dodelitev faz zaposlenim tudi takrat, ko je izdelek ze na polici, dodaj zahtevo za faze:

```text
Naredi novi delovni nalog za 1 x Elektricna omarica B, kupec Bauhaus, rok 21.6.2026, 23:23. Dodeli faze zaposlenim.
```

To nastavi `forceProduction: true`, zato workflow uporabi `fromStock: 0`, `toProduce: kolicina` in ustvari faze.

Dodajanje faz na obstojeci delovni nalog:

```text
Za delovni nalog WO-008 dodaj potrebne faze zaposlenim
```

To uporabi `generate_work_order_phases`. Backend pogleda izdelke na delovnem nalogu oziroma povezanem narocilu. Ce izdelkov ni, vrne opozorilo. Ce izdelki so, pogleda faze izdelka in jih dodeli zaposlenim: najprej zaposlenim, ki imajo zahtevano znanje in so prosti; ce so vsi z ustreznim znanjem zasedeni, izbere tistega z ustreznim znanjem in najmanj zasedenimi urami.

Samo osnovni delovni nalog brez avtomatskega workflowa:

```text
Ustvari SAMO delovni nalog za 2 kosa izdelka Kovinsko ohisje A za podjetje Emmiter
```

## Kaj je se odprto

Najpomembnejse odprto:

- potrebno popraviti : 
"Ti
14. 05., 21:11
Za delovni nalog WO-008 dodaj potrebne faze zaposlenim

Assistant Ollama
error
Potrebujem se izdelek in kolicino, da lahko nadaljujem."

Naj pogleda za naročilo katere izdelki so (če ni izdelkov naj javi to), če so naj za te izdelke pogleda kateri zaposleni so prvo sposobni in prosti, potem kateri so prosti, če so vsi zasedeni - da random tistem ki ima znanje in ima najmanj ur zasedenih.



- dodati pravi OpenAI provider
- dodati primerjalne meritve za OpenAI proti Ollama
- izboljsati bolj kompleksno ekstrakcijo argumentov za narocila in delovne naloge
- po potrebi dodati identifikator narocila, na primer `ORD-001`, da je urejanje enega narocila manj dvoumno
- razsiriti standalone MCP dokumentacijo za konkreten zunanji MCP klient, ko bo znano, kateri klient bos uporabil


# Smart Production Workflow

Prototip pametnega proizvodnega workflowa zgrajen na MERN stacku z integracijo jezikovnih modelov (LLM) in Model Context Protocol (MCP). Razvit kot praktični del diplomske naloge na temo primerjave lokalnih in oblačnih jezikovnih modelov v industrijskem kontekstu.

---

## Namen

Sistem omogoča upravljanje proizvodnega procesa prek naravnega jezika. Namesto da bi admin klikal po formah, napiše ukaz v slovenščini ali angleščini:

```
Naredi delovni nalog za 3x Kovinsko ohisje A za AluTech, rok 21.6.2026
Prikaži vse rezervne dele
Uredi zaposlenega Marko Reznik, dodaj mu znanje: programiranje
```

Sistem interpretira ukaz z LLM (Ollama ali OpenAI), izbere pravi MCP tool, izvede akcijo in vrne rezultat.

---

## Arhitektura

```
React Frontend (port 3001)
    ↓
Express Backend (port 3000)
    ↓
LLM (Ollama lokalno ali OpenAI API)
    ↓
MCP Tools (37 orodij)
    ↓
MongoDB
```

**Dve poti do istega rezultata:**
- **Lokalni guard** — regex pravila za pogoste ukaze (brez LLM klica, ~1ms)
- **LLM** — Ollama (`qwen3:8b`) ali OpenAI (`gpt-4.1-mini`) za kompleksne ukaze

---

## Zahteve

- Node.js 18+
- MongoDB (lokalno na `127.0.0.1:27017`)
- Ollama (za lokalni LLM) — opcijsko
- OpenAI API ključ — opcijsko

---

## Namestitev in zagon

### 1. Kloniranje in odvisnosti

```bash
git clone https://github.com/DJjanko/Smart-Production-Workflow.git

cd backend
npm install

cd ../frontend
npm install
```

### 2. Okolje (backend)

Ustvari `backend/.env`:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/smart-production-workflow
JWT_SECRET=your-local-secret
CLIENT_ORIGIN=http://localhost:3001

# LLM
LLM_DEFAULT_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_TIMEOUT_MS=180000

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
OPENAI_TIMEOUT_MS=30000
```

### 3. Baza podatkov (seed)

```bash
cd backend

# Originalni seed (2 produkta, 5 delov)
npm run seed

# Razširjeni seed za diplomsko nalogo (4 produkti, 8 delov, 5 zaposlenih)
npm run seed2
```

**Demo prijava po seedu:**

| Vloga | Email | Geslo |
|---|---|---|
| Admin | `admin` | `admin` |
| Delavec | `marko@factory.si` | `password123` |
| Delavec | `sara@factory.si` | `password123` |
| Delavec | `tomaz@factory.si` | `password123` |

### 4. Zagon

#### Hitri zagon (en ukaz)

```powershell
.\start.ps1
```

Odpre ločena terminalna okna za Ollama, Backend, MCP server in Frontend.

```powershell
.\start.ps1 -NoOllama        # brez Ollame (če že teče)
.\start.ps1 -NoMcp           # brez MCP serverja
.\start.ps1 -NoOllama -NoMcp # samo backend + frontend
```

#### Ročni zagon

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 — Standalone MCP server** (opcijsko, za zunanje MCP kliente):
```bash
cd backend
npm run mcp
```

Odpri brskalnik: **http://localhost:3001**

---

## Ollama

Ollama mora teči pred zagonom backenda:

```bash
ollama serve
ollama pull qwen3:8b
```

Preverite:
```bash
ollama list
ollama ps
```

---

## Struktura projekta

```
smart-production-workflow/
├── backend/
│   ├── src/
│   │   ├── controllers/      # REST API kontrolerji
│   │   ├── models/           # Mongoose modeli
│   │   ├── routes/           # Express rute
│   │   ├── services/
│   │   │   ├── llm/          # LLM integracija
│   │   │   │   ├── index.js              # Guard + provider logika
│   │   │   │   ├── ollamaProvider.js     # Ollama klic
│   │   │   │   ├── openaiProvider.js     # OpenAI klic
│   │   │   │   ├── prompt.js             # Skupni prompt
│   │   │   │   └── responseFormatter.js  # Naravni LLM odgovor
│   │   │   ├── mcp/
│   │   │   │   └── tools.js  # 37 MCP toolov
│   │   │   └── workflowService.js        # Poslovna logika
│   │   ├── mcp/server.js     # Standalone MCP server (stdio)
│   │   ├── seed.js           # Demo podatki v1
│   │   └── seed2.js          # Demo podatki v2 (diplomska)
│   └── .env
├── frontend/
│   └── src/
│       ├── pages/            # Strani (Dashboard, Primerjava, ...)
│       ├── components/       # Komponente (CopilotPanel, ...)
│       └── utils/i18n.js     # Slovenščina + angleščina
├── ASSISTANT_COMMANDS.md     # Vsi ukazi za AI asistenta
├── CHANGELOG_2026-05-15.md   # Dnevnik sprememb
└── README.md
```

---

## AI asistent

### Preklopniki v chatu

| Preklopnik | Opis |
|---|---|
| **OpenAI / Ollama** | Izbira LLM providerja |
| **Guard** | Vklop/izklop lokalnega guarda (za primerjavo) |
| **LLM odgovor** | Po izvedbi akcije LLM oblikuje naravni odgovor |

### Primeri ukazov

**Delovni nalogi:**
```
Naredi delovni nalog za 2x Kovinsko ohisje A za AluTech, rok 21.6.2026
Naredi novi delovni nalog za FERI, ki ima 3x Pumpa in 2x Kovinsko ohisje A
Naredi delovni nalog za naročilo BodyFit
Za delovni nalog WO-008 dodaj potrebne faze zaposlenim
```

**Rezervni deli:**
```
Prikaži vse rezervne dele
Dodaj rezervni del Vijak M8 (VI-08), kolicina 5
Spremeni Vijak M8 (VI-08), zalogo na voljo na 4 in min zalogo na 3
```

**Zaposleni:**
```
Prikaži vse zaposlene
Uredi zaposlenega Marko Reznik, dodaj mu znanje: programiranje
```

**Samo za delavce:**
```
Prikaži moje faze
Posodobi status faze WO-004 / Varjenje na zaključeno
Opozori admina - manjkajo DIN letev
```

Celoten seznam ukazov: **[ASSISTANT_COMMANDS.md](./ASSISTANT_COMMANDS.md)**

---

## MCP Tools

37 orodij organiziranih v kategorije:

| Kategorija | Orodja |
|---|---|
| Workflow | `process_work_order`, `create_work_order_only`, `process_existing_order`, `generate_work_order_phases` |
| Informativni | `check_product_availability`, `get_employee_workload`, `summarize_work_order` |
| CRUD — Deli | `get/create/update/delete_part` |
| CRUD — Izdelki | `get/create/update/delete_product` |
| CRUD — Zaposleni | `get/create/update/delete_employee` |
| CRUD — Naročila | `get/create/update/delete_order` |
| CRUD — Del. nalogi | `get/create/update/delete_work_order` |
| CRUD — Faze | `get/create/update/delete_work_order_phase` |
| Delavec | `get_my_phases`, `get_my_work_orders`, `create_supply_alert` |
| Admin | `get_supply_alerts` |

---

## Primerjava modelov

Stran **Primerjava** prikazuje meritve za vsak MCP tool:

- Povprečni čas izvajanja (Ollama vs OpenAI vs LocalGuard)
- Točnost interpretacije (ročna ocena thumbs up/down)
- Split view 50/50 za direktno primerjavo
- Filtri: provider, LocalGuard, LLM odgovor, datum

**4 kombinacije za testiranje:**

| | Guard ON | Guard OFF |
|---|---|---|
| Strukturiran odgovor | Hiter (~1ms za ujete ukaze) | Vedno LLM klic |
| LLM naravni odgovor | Guard + LLM format | 2× LLM klic |

---

## Pravice

| Operacija | Admin | Delavec |
|---|---|---|
| GET vse entitete | ✓ | ✓ |
| CREATE/UPDATE/DELETE | ✓ | ✗ |
| Moje faze/nalogi | ✓ | ✓ |
| Posodobi lastno fazo | ✓ | ✓ (samo lastne) |
| Supply alert | ✓ | ✓ (pošlje) |
| Workflow tooli | ✓ | ✗ |

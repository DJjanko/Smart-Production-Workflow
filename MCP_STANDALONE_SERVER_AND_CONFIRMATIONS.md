# Standalone MCP Server in Confirmation Flow

Ta dokument opisuje, kako je v projektu narejen MCP del, kje se kaj klice in kako se sistem vzpostavi.

## 1. Glavna ideja

Aplikacija ima zdaj dve poti do istih MCP orodij:

```text
React assistant chat
  -> Express backend /api/ai/commands
  -> Ollama interpretacija
  -> executeMcpTool()
  -> MongoDB / poslovna logika
```

in locen standalone MCP server:

```text
MCP client / inspector / zunanji agent
  -> node backend/src/mcp/server.js
  -> MCP stdio transport
  -> executeMcpTool()
  -> MongoDB / poslovna logika
```

Pomembno: poslovna logika ni podvojena. Oba toka uporabljata isto funkcijo:

```text
backend/src/services/mcp/tools.js -> executeMcpTool()
```

To pomeni, da so pravila za `process_work_order`, CRUD orodja, preverjanje zaloge in confirmation varovalke na enem mestu.

## 2. Klucne datoteke

### Standalone MCP server

```text
backend/src/mcp/server.js
```

Ta datoteka:

- nalozi `.env`,
- poveze MongoDB prek `connectDb()`,
- ustvari `McpServer`,
- registrira vsa orodja iz `MCP_TOOLS`,
- za vsako orodje poklice `executeMcpTool()`,
- komunicira prek `StdioServerTransport`.

### MCP orodja

```text
backend/src/services/mcp/tools.js
```

Tu so definirana orodja in izvajanje:

- `MCP_TOOLS` opisuje, katera orodja obstajajo.
- `executeMcpTool()` sprejme `toolName`, `args`, `actor`, `provider`, `rawInput`.
- Info orodja samo berejo.
- Workflow orodja izvajajo poslovno logiko.
- CRUD mutacije zahtevajo `confirmed: true`.

### LLM interpretacija

```text
backend/src/services/llm/prompt.js
backend/src/services/llm/index.js
backend/src/services/llm/ollamaProvider.js
```

Tu Ollama iz naravnega jezika naredi strukturiran intent, na primer:

```json
{
  "intent": "create_part",
  "args": {
    "name": "Vijak M8",
    "sku": "VI-M8",
    "confirmed": false
  }
}
```

### Express assistant endpoint

```text
backend/src/controllers/aiController.js
backend/src/routes/ai.js
```

To uporablja frontend assistant. Ta pot ima dodan se `PendingMcpAction` flow za gumba Accept / Decline.

### Pending confirmation model

```text
backend/src/models/PendingMcpAction.js
```

Hrani akcije, ki cakajo na uporabnikovo potrditev.

## 3. Kako zagnati sistem

### 3.1 MongoDB

MongoDB mora teci na URI iz `backend/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/smart-production-workflow
```

### 3.2 Express backend

V enem terminalu:

```powershell
cd backend
npm run dev
```

Express backend tece na:

```text
http://localhost:3000
```

### 3.3 Frontend

V drugem terminalu:

```powershell
cd frontend
npm run dev
```

Frontend tece na:

```text
http://localhost:3001
```

### 3.4 Standalone MCP server

V locenem terminalu:

```powershell
cd backend
npm run mcp
```

To zazene:

```text
node src/mcp/server.js
```

MCP server uporablja stdio transport, zato ni HTTP endpointa. MCP klient ga zazene kot proces in z njim govori prek stdin/stdout.

## 4. Primer MCP client konfiguracije

Za MCP klient, ki podpira konfiguracijo serverjev, je oblika priblizno taka:

```json
{
  "mcpServers": {
    "smart-production-workflow": {
      "command": "node",
      "args": [
        "D:/ZaključnoDelo/Smart-Production-Workflow/backend/src/mcp/server.js"
      ],
      "env": {
        "MONGODB_URI": "mongodb://127.0.0.1:27017/smart-production-workflow"
      }
    }
  }
}
```

Ce klient podpira `cwd`, lahko je konfiguracija tudi:

```json
{
  "mcpServers": {
    "smart-production-workflow": {
      "command": "node",
      "args": ["src/mcp/server.js"],
      "cwd": "D:/ZaključnoDelo/Smart-Production-Workflow/backend"
    }
  }
}
```

## 5. Katera orodja MCP server izpostavi

### Glavna informativna orodja

- `check_product_availability`
- `get_employee_workload`
- `summarize_work_order`

### Glavna workflow orodja

- `process_work_order`
- `create_work_order_only`

`process_work_order` je najpomembnejsi tok. Naredi celoten proizvodni workflow:

```text
preveri izdelek
-> preveri izdelke na polici
-> rezervira izdelke na polici, ce obstajajo
-> preveri dele
-> naroci/simulira manjkajoce dele
-> rezervira material
-> ustvari narocilo in delovni nalog
-> generira faze
-> dodeli zaposlene
```

`create_work_order_only` je za primer, ko uporabnik rece "SAMO delovni nalog". Takrat ne naredi avtomatskega workflowa.

### CRUD orodja

Rezervni deli:

- `get_parts`
- `create_part`
- `update_part`
- `delete_part`

Zaposleni:

- `get_employees`
- `create_employee`
- `update_employee`
- `delete_employee`

Izdelki:

- `get_products`
- `create_product`
- `update_product`
- `delete_product`

Delovni nalogi:

- `get_work_orders`
- `create_work_order_record`
- `update_work_order`
- `delete_work_order`

Faze:

- `get_work_order_phases`
- `create_work_order_phase`
- `update_work_order_phase`
- `delete_work_order_phase`

## 6. Confirmation pravilo

Vsa CRUD orodja, ki spreminjajo podatke, zahtevajo:

```json
{
  "confirmed": true
}
```

To velja za:

```text
create_*
update_*
delete_*
```

Ce `confirmed` manjka ali je `false`, MCP orodje ne pise v bazo. Vrne:

```json
{
  "requiresConfirmation": true,
  "code": "CONFIRMATION_REQUIRED",
  "message": "Za create (...) potrebujem potrditev."
}
```

## 7. Kako deluje Accept / Decline v assistant chatu

Ta del je vezan na Express backend in frontend, ne neposredno na standalone MCP stdio server.

### Korak 1: uporabnik zahteva mutacijo

Primer:

```text
Dodaj rezervni del Testni vijak s sifro TV-001.
```

Frontend poslje:

```text
POST /api/ai/commands
```

Backend:

1. poklice Ollama,
2. dobi intent `create_part`,
3. poklice `executeMcpTool()`,
4. MCP vrne `requiresConfirmation`,
5. backend shrani `PendingMcpAction`,
6. frontend dobi `pendingAction`.

### Korak 2: frontend prikaze gumba

Assistant panel prikaze:

```text
Confirmation required
[Accept] [Decline]
```

### Korak 3A: Accept

Frontend poklice:

```text
PUT /api/ai/pending-actions/:id/accept
```

Backend:

1. najde pending action,
2. poklice isto MCP orodje,
3. doda `confirmed: true`,
4. izvede zapis v bazo,
5. pending action oznaci kot `accepted`.

### Korak 3B: Decline

Frontend poklice:

```text
PUT /api/ai/pending-actions/:id/decline
```

Backend:

1. najde pending action,
2. oznaci jo kot `declined`,
3. ne klice mutacije,
4. ne spremeni poslovne baze.

## 8. Razlika med assistant flow in standalone MCP flow

### Assistant flow

```text
React UI
-> Express /api/ai/commands
-> Ollama
-> executeMcpTool()
-> PendingMcpAction, ce je potrebna potrditev
-> Accept/Decline gumba
```

Ta flow ima uporabniku prijazno confirmation memory.

### Standalone MCP flow

```text
MCP client
-> backend/src/mcp/server.js
-> executeMcpTool()
```

Tu MCP server sam ne prikazuje gumbov. Ce klient poklice mutacijsko orodje brez `confirmed: true`, server vrne `requiresConfirmation`. Nato mora MCP klient sam odlociti, ali bo uporabnika vprasal za potrditev in ponovno poklical orodje s:

```json
{
  "confirmed": true
}
```

## 9. Kako testirati MCP server

Osnovni smoke test je bil narejen s SDK klientom:

```text
MCP client
-> start node src/mcp/server.js
-> listTools()
-> callTool("get_parts")
```

Rezultat:

```text
25 MCP tools registered
get_parts returned real MongoDB data
```

Rocno lahko testiras tako:

```powershell
cd backend
npm run mcp
```

Za interaktivno testiranje uporabi MCP klient ali inspector, ki zna zagnati stdio server.

## 10. Kaj je se odprto

OpenAI in primerjave modelov se namenoma niso dodajali v tej fazi. Za naslednji korak so smiselni kriteriji:

- cas izvajanja,
- natancnost izbire orodja,
- pravilnost argumentov,
- stevilo potrebnih dodatnih vprasanj,
- uspesnost izvedbe workflowa,
- zanesljivost JSON odgovora,
- razumljivost koncnega odgovora,
- lokalno/zasebnostno izvajanje proti cloud izvajanju,
- cena klica,
- stabilnost pri slovenskem jeziku.


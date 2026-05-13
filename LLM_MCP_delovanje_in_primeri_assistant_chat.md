# Delovanje LLM in MCP v aplikaciji za delovne naloge

## 1. Namen dokumenta

Ta dokument opisuje, kako bo v aplikaciji za upravljanje delovnih nalogov delovala povezava med:

- uporabniškim vnosom v **AI assistant chatu**,
- interpretacijo zahteve s strani **LLM**,
- izbiro ustreznega **MCP orodja**,
- izvedbo poslovne logike v backendu,
- vračanjem rezultatov ali napak uporabniku.

Aplikacija že vsebuje klasični MERN del:

- MongoDB,
- Express backend,
- React frontend,
- admin in user pogled,
- CRUD za zaposlene, izdelke, dele, naročila in delovne naloge,
- ročno dodeljevanje faz delovnih nalogov zaposlenim,
- AI assistant chat,
- activity log za MCP/LLM funkcije.

Preostali cilj je dodati **LLM interpretacijo** in **MCP orodja**, ki bodo omogočila upravljanje sistema prek naravnega jezika.

---

## 2. Osnovna arhitektura

```text
React frontend
   ↓
Express backend
   ↓
LLM orchestrator
   ↓
OpenAI API ali Ollama
   ↓
MCP client
   ↓
MCP server
   ↓
Express poslovna logika / MongoDB
   ↓
rezultat nazaj do LLM
   ↓
odgovor uporabniku v chatu
```

### Vloga posameznih komponent

#### React frontend
- prikaže assistant chat,
- pošlje uporabniški vnos backendu,
- prikaže odgovor LLM-a,
- posodobi UI, če se podatki spremenijo.

#### Express backend
- sprejme prompt,
- kliče LLM,
- sprejme odločitev LLM-a,
- pokliče ustrezno MCP orodje,
- sprejme rezultat MCP/backend logike,
- rezultat pošlje nazaj LLM-u za oblikovanje končnega odgovora.

#### LLM
- razume naravni jezik,
- določi namen uporabnika,
- ugotovi, ali gre za:
  - informativno zahtevo,
  - enostavno akcijo,
  - workflow,
  - nepopolno ali dvoumno zahtevo,
- izlušči parametre,
- sproži ustrezno MCP orodje,
- uporabnika vpraša za manjkajoče podatke,
- oblikuje razumljiv končni odgovor.

#### MCP
- izpostavi aplikacijske funkcije kot orodja,
- omogoči standardizirano povezavo med LLM-om in aplikacijo,
- kliče obstoječo backend logiko,
- vrača strukturirane rezultate in napake.

---

## 3. Glavno načelo: uporabnik piše naravno

Uporabnik ne sme poznati posebnih ukazov ali točne sintakse.

Sistem mora razumeti naravne izraze, na primer:

- `Preveri zalogo za izdelek A.`
- `Ali imamo dovolj materiala za 10 izdelkov A?`
- `Naroči 100 vijakov M6.`
- `Naredi delovni nalog za 5 kovinskih ohišij.`
- `Naredi samo delovni nalog za 5 kovinskih ohišij.`

LLM mora razumeti **namen**, ne samo prepoznati točno določene ključne besede.

---

## 4. Glavne vrste uporabniških zahtev

### 4.1 Informativna zahteva

Uporabnik želi samo informacijo. Sistem ne spreminja podatkov.

#### Primeri
- `Koliko vijakov M6 imamo na zalogi?`
- `Ali imamo dovolj delov za 5 izdelkov A?`
- `Kateri zaposleni je najbolj zaseden?`
- `Pokaži stanje delovnega naloga WO-004.`

#### Možna MCP orodja
- `check_inventory`
- `check_product_availability`
- `get_employee_workload`
- `summarize_work_order`

---

### 4.2 Enostavna akcija

Uporabnik želi eno konkretno spremembo.

#### Primeri
- `Naroči 100 vijakov M6.`
- `Dodaj 50 kovinskih plošč na zalogo.`
- `Zamakni delovni nalog WO-004 za dva dni.`
- `Spremeni status naloga WO-007 v zaključeno.`

#### Možna MCP orodja
- `order_parts`
- `update_inventory`
- `reschedule_work_order`
- `update_work_order_status`

---

### 4.3 Celoten workflow

Uporabnik želi, da sistem izvede celoten poslovni proces.

Najpomembnejši workflow je ustvarjanje delovnega naloga.

#### Primeri
- `Naredi delovni nalog za 5 izdelkov A.`
- `Ustvari delovni nalog za 10 kovinskih ohišij.`
- `Pripravi proizvodnjo za naročilo podjetja AluTech.`
- `Naredi delovni nalog, preveri zalogo in dodeli faze zaposlenim.`

#### MCP orodje
- `process_work_order`

---

### 4.4 Nepopolna ali dvoumna zahteva

Če manjkajo ključni podatki, sistem ne sme ugibati.

#### Primer
- `Naredi delovni nalog.`

Manjkajo:
- izdelek,
- količina.

#### Odgovor asistenta
- `Za kateri izdelek in za koliko kosov naj ustvarim delovni nalog?`

#### Drug primer
- `Naroči vijake M6.`

Manjka:
- količina.

#### Odgovor asistenta
- `Koliko kosov vijakov M6 naj naročim?`

---

## 5. Posebna logika za delovne naloge

### 5.1 Privzeto: "naredi delovni nalog" pomeni workflow

Če uporabnik napiše:

```text
Naredi delovni nalog za 5 izdelkov A.
```

sistem sproži celoten workflow:

1. preveri izdelek,
2. preveri potrebne dele,
3. preveri zalogo,
4. če deli manjkajo, jih simulirano naroči,
5. pripravi oziroma rezervira potrebne podatke,
6. generira faze izdelave,
7. dodeli faze zaposlenim,
8. ustvari delovni nalog,
9. posodobi podatke za dashboard in časovnico.

#### MCP orodje
- `process_work_order`

---

### 5.2 Primer z delno navedenim workflowom

Če uporabnik napiše:

```text
Naredi delovni nalog za 5 izdelkov A in preveri zalogo.
```

to še vedno pomeni celoten workflow.

Razlog:
- uporabnik je jasno izrazil namen ustvariti delovni nalog,
- preverjanje zaloge je eden izmed korakov standardnega workflowa,
- sistem sam nadaljuje še z ostalimi koraki, kot sta generiranje faz in dodelitev zaposlenim.

#### Izvede se
- `process_work_order`

---

### 5.3 Poseben primer: "SAMO delovni nalog"

Če uporabnik izrecno napiše:

```text
Naredi SAMO delovni nalog za 5 izdelkov A.
```

ali:

```text
Ustvari samo zapis delovnega naloga za 5 izdelkov A.
```

potem sistem ne izvede celotnega workflowa.

#### Izvede se samo
- kreiranje osnovnega delovnega naloga,
- preverjanje samo tistih podatkov, ki so nujni za osnovno kreiranje.

#### Ne izvede se
- preverjanje zaloge,
- avtomatsko naročanje delov,
- avtomatsko generiranje faz,
- avtomatsko dodeljevanje faz zaposlenim.

#### MCP orodje
- `create_work_order_only`

---

## 6. Kdaj sistem sprašuje uporabnika

Sistem uporabnika vpraša za dodatne informacije, kadar:

- manjka izdelek,
- manjka količina,
- manjka ime dela ali podatek o količini pri naročanju delov,
- je zahteva dvoumna,
- obstaja več možnih interpretacij.

### Primer 1
#### Vnos
```text
Naredi delovni nalog.
```

#### Odgovor
```text
Za kateri izdelek in za koliko kosov naj ustvarim delovni nalog?
```

### Primer 2
#### Vnos
```text
Naroči dele za izdelek A.
```

#### Možna reakcija
Če sistem ne more ugotoviti, kaj točno naj naroči:
```text
Ali želiš naročiti vse manjkajoče dele za izdelek A ali želiš določiti konkretne dele?
```

### Primer 3
#### Vnos
```text
Pripravi vse za izdelek A.
```

#### Odgovor
```text
Ali želiš samo preverjanje zaloge in izvedljivosti ali naj ustvarim tudi delovni nalog?
```

---

## 7. Kaj se nahaja v LLM promptu in kaj v MCP/backend logiki

### 7.1 V LLM promptu

LLM dobi pravila za interpretacijo uporabnika:

- prepoznaj namen uporabnika,
- loči med:
  - informacijo,
  - enostavno akcijo,
  - workflowom,
  - nepopolnim vnosom,
- če uporabnik zahteva delovni nalog, privzeto uporabi workflow,
- če uporabnik izrecno zahteva `SAMO delovni nalog`, uporabi omejeno funkcijo,
- če manjkajo obvezni podatki, postavi dodatno vprašanje,
- ne izmišljaj izdelkov, delov ali zaposlenih.

---

### 7.2 V MCP/backend logiki

MCP in backend vsebujejo dejanska poslovna pravila:

- katera polja so obvezna,
- kako se preveri zaloga,
- kako se simulirano naročijo manjkajoči deli,
- kako se ustvarijo faze,
- kako se dodelijo faze zaposlenim,
- kako se ustvari delovni nalog,
- kako se premakne časovnica,
- kako se vračajo strukturirane napake.

---

## 8. Predlagana MCP orodja

### 8.1 Informativna orodja
- `check_inventory`
- `check_product_availability`
- `get_employee_workload`
- `summarize_work_order`

### 8.2 Enostavna akcijska orodja
- `order_parts`
- `update_inventory`
- `reschedule_work_order`
- `update_work_order_status`

### 8.3 Workflow orodja
- `process_work_order`
- `create_work_order_only`

---

## 9. Primeri MCP / LLM odločanja

### Primer A: naročilo delov

#### Uporabnikov vnos
```text
Naroči 100 vijakov M6.
```

#### Interpretacija
```json
{
  "intent": "order_parts",
  "type": "simple_action",
  "tool": "order_parts",
  "arguments": {
    "partName": "vijak M6",
    "quantity": 100
  },
  "missingFields": []
}
```

#### Izvede se
- `order_parts`

---

### Primer B: preverjanje zaloge

#### Uporabnikov vnos
```text
Ali imamo dovolj delov za 10 izdelkov A?
```

#### Interpretacija
```json
{
  "intent": "check_product_availability",
  "type": "information",
  "tool": "check_product_availability",
  "arguments": {
    "productName": "izdelek A",
    "quantity": 10
  },
  "missingFields": []
}
```

#### Izvede se
- `check_product_availability`

---

### Primer C: standardni workflow

#### Uporabnikov vnos
```text
Naredi delovni nalog za 5 kovinskih ohišij.
```

#### Interpretacija
```json
{
  "intent": "process_work_order",
  "type": "workflow",
  "tool": "process_work_order",
  "arguments": {
    "productName": "kovinsko ohišje",
    "quantity": 5
  },
  "missingFields": []
}
```

#### Izvede se
- `process_work_order`

---

### Primer D: standardni workflow z delno navedenimi koraki

#### Uporabnikov vnos
```text
Naredi delovni nalog za 5 izdelkov A in preveri zalogo.
```

#### Interpretacija
```json
{
  "intent": "process_work_order",
  "type": "workflow",
  "tool": "process_work_order",
  "arguments": {
    "productName": "izdelek A",
    "quantity": 5
  },
  "missingFields": []
}
```

#### Izvede se
- `process_work_order`

#### Opomba
Čeprav uporabnik omeni samo delovni nalog in preverjanje zaloge, sistem uporabi celoten workflow, ker je ustvarjanje delovnega naloga v tej aplikaciji sestavljen poslovni proces.

---

### Primer E: samo delovni nalog

#### Uporabnikov vnos
```text
Naredi SAMO delovni nalog za 5 izdelkov A.
```

#### Interpretacija
```json
{
  "intent": "create_work_order_only",
  "type": "simple_action",
  "tool": "create_work_order_only",
  "arguments": {
    "productName": "izdelek A",
    "quantity": 5
  },
  "missingFields": []
}
```

#### Izvede se
- `create_work_order_only`

#### Ne izvede se
- avtomatsko preverjanje zaloge,
- naročanje manjkajočih delov,
- avtomatska dodelitev faz zaposlenim.

---

### Primer F: manjkajo podatki

#### Uporabnikov vnos
```text
Naredi delovni nalog.
```

#### Interpretacija
```json
{
  "intent": "process_work_order",
  "type": "workflow",
  "tool": "process_work_order",
  "arguments": {},
  "missingFields": ["productName", "quantity"]
}
```

#### Odgovor asistenta
```text
Za kateri izdelek in za koliko kosov naj ustvarim delovni nalog?
```

---

## 10. Statusne kode in napake

Backend oziroma MCP mora vračati strukturirane rezultate.

### Uspešen odgovor

```json
{
  "success": true,
  "statusCode": 201,
  "code": "WORK_ORDER_CREATED",
  "message": "Delovni nalog je bil uspešno ustvarjen.",
  "data": {
    "workOrderId": "WO-004"
  }
}
```

### Napaka: manjkajoči podatki

```json
{
  "success": false,
  "statusCode": 400,
  "code": "MISSING_REQUIRED_FIELDS",
  "message": "Manjkata izdelek in količina.",
  "missingFields": ["productName", "quantity"]
}
```

### Napaka: izdelek ne obstaja

```json
{
  "success": false,
  "statusCode": 404,
  "code": "PRODUCT_NOT_FOUND",
  "message": "Izdelek 'izdelek A' ne obstaja."
}
```

### Tehnična napaka

```json
{
  "success": false,
  "statusCode": 500,
  "code": "INTERNAL_SERVER_ERROR",
  "message": "Prišlo je do napake pri obdelavi zahteve."
}
```

---

## 11. Kako LLM uporabi odgovor backenda

LLM ne odgovarja na pamet, ampak na podlagi rezultata orodja.

### Če je rezultat uspešen
Odgovor je lahko:
```text
Delovni nalog WO-004 je bil uspešno ustvarjen. Sistem je preveril zalogo, po potrebi naročil manjkajoče dele in pripravil nadaljnje korake.
```

### Če izdelek ne obstaja
Odgovor je lahko:
```text
Izdelka z navedenim imenom nisem našel. Preveri ime izdelka ali ga najprej dodaj v sistem.
```

### Če manjkajo podatki
Odgovor je lahko:
```text
Za dokončanje potrebujem še količino izdelkov.
```

---

## 12. Activity log

Za vsak AI/MCP klic se shrani:

- uporabniški prompt,
- uporabljen model:
  - OpenAI API,
  - Ollama,
- prepoznan intent,
- vrsta zahteve,
- izbrano MCP orodje,
- argumenti,
- statusna koda,
- rezultat,
- error message, če obstaja,
- čas trajanja,
- končni odgovor asistenta.

### Primer activity log zapisa

```json
{
  "provider": "openai",
  "userPrompt": "Naredi delovni nalog za 5 kovinskih ohišij.",
  "intent": "process_work_order",
  "type": "workflow",
  "tool": "process_work_order",
  "arguments": {
    "productName": "kovinsko ohišje",
    "quantity": 5
  },
  "statusCode": 201,
  "status": "success",
  "durationMs": 1840,
  "resultCode": "WORK_ORDER_CREATED"
}
```

---

## 13. Primeri uporabniških vnosov za assistant chat

### Informativni vnosi
```text
Koliko vijakov M6 imamo trenutno na zalogi?
```

```text
Ali imamo dovolj delov za 10 kovinskih ohišij?
```

```text
Kateri zaposleni ima trenutno največ dodeljenih faz?
```

```text
Povzemi stanje delovnega naloga WO-004.
```

---

### Enostavne akcije
```text
Naroči 100 vijakov M6.
```

```text
Dodaj 30 kovinskih plošč na zalogo.
```

```text
Zamakni delovni nalog WO-003 za tri dni.
```

```text
Spremeni status delovnega naloga WO-006 v zaključen.
```

---

### Workflow vnosi
```text
Naredi delovni nalog za 5 kovinskih ohišij.
```

```text
Ustvari delovni nalog za 10 izdelkov A in dodeli faze zaposlenim.
```

```text
Naredi delovni nalog za 3 izdelke B in preveri zalogo.
```

```text
Pripravi proizvodnjo za naročilo 8 izdelkov C.
```

---

### Samo osnovno kreiranje delovnega naloga
```text
Naredi SAMO delovni nalog za 5 izdelkov A.
```

```text
Ustvari samo zapis delovnega naloga za 10 izdelkov B.
```

```text
Dodaj samo delovni nalog brez avtomatskega dodeljevanja faz.
```

---

### Nepopolni vnosi
```text
Naredi delovni nalog.
```

```text
Naroči vijake M6.
```

```text
Pripravi proizvodnjo.
```

Pri teh primerih mora asistent postaviti dodatno vprašanje.

---

## 14. Predlagani LLM intenti

Možni intenti:

```text
check_inventory
check_product_availability
order_parts
update_inventory
process_work_order
create_work_order_only
assign_work_order_phases
get_employee_workload
summarize_work_order
reschedule_work_order
update_work_order_status
ask_clarification
```

---

## 15. Ključna odločitev za implementacijo

Najbolj smiselna zasnova je:

- **LLM** interpretira uporabniški naravni jezik,
- **MCP** izpostavi orodja in workflowe,
- **backend** izvaja dejansko poslovno logiko,
- **MongoDB** hrani podatke,
- **activity log** dokumentira vse AI/MCP akcije.

Posebej pomembno:

- `process_work_order` pomeni celoten workflow,
- `create_work_order_only` pomeni samo osnovno kreiranje delovnega naloga,
- sistem ne sme siliti uporabnika v točno določeno sintakso,
- pri manjkajočih ali dvoumnih podatkih mora asistent vprašati za dopolnitev.

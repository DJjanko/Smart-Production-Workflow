# Smart Production Workflow — Ukazi asistenta (MCP)

Ta datoteka dokumentira vse ukaze, ki jih lahko pošljete asistentskemu chatu v aplikaciji Smart Production Workflow. Ukazi so razdeljeni glede na vlogo: **ADMIN** in **DELAVEC**.

---

## Kazalo vsebine

- [Splošne napotke](#splošne-napotke)
- [ADMIN ukazi](#admin-ukazi)
  - [Izdelki](#izdelki-products)
  - [Deli](#deli-parts)
  - [Zaposleni](#zaposleni-employees)
  - [Naročila](#naročila-orders)
  - [Delovni nalogi](#delovni-nalogi-work-orders)
  - [Faze](#faze-work-order-phases)
  - [Opozorila](#opozorila-supply-alerts)
- [DELAVEC ukazi](#delavec-ukazi)
  - [Moje faze](#moje-faze)
  - [Moji delovni nalogi](#moji-delovni-nalogi)
  - [Posodobitev statusa lastne faze](#posodobitev-statusa-lastne-faze)
  - [Opozorila adminu](#opozorila-adminu)
- [Vrednosti statusov](#vrednosti-statusov)
- [OpenAI vs Ollama](#openai-vs-ollama)

---

## Splošne napotke

| Tip operacije | Potrditev potrebna? | Opis |
|---|---|---|
| `GET` (branje) | Ne | Podatki se prikažejo takoj |
| `CREATE` (ustvari) | **Da** — Potrdi / Zavrni | Asistent prikaže predogled pred izvedbo |
| `UPDATE` (posodobi) | **Da** — Potrdi / Zavrni | Asistent prikaže spremembe pred izvedbo |
| `DELETE` (izbriši) | **Da** — Potrdi / Zavrni | Asistent zahteva potrditev pred brisanjem |
| Workflow orodja | **Da** — Potrdi / Zavrni | Npr. generiranje faz, obdelava naročil |

> **Lokalna zapora (Local guard):** Sistem prestreže pogoste enostavne ukaze še pred klicem jezikovnega modela, kar zagotavlja hitrejši odziv.

---

## ADMIN ukazi

---

### Izdelki (Products)

#### Prikaz vseh izdelkov

| Polje | Vrednost |
|---|---|
| MCP funkcija | `get_products` |
| Potrditev | Ne |

```
Prikaži vse izdelke
```
```
Preveri zalogo izdelkov
```

---

#### Ustvari izdelek (enostavno)

| Polje | Vrednost |
|---|---|
| MCP funkcija | `create_product` |
| Potrditev | Da |

```
Ustvari izdelek Lopata
```

---

#### Ustvari izdelek (s fazami in deli — priporočeno z OpenAI)

| Polje | Vrednost |
|---|---|
| MCP funkcija | `create_product` |
| Potrditev | Da |
| Opomba | Za kompleksne ukaze z več fazami in deli je OpenAI bolj zanesljiv |

```
Dodaj izdelek Printer2, faze: Sestavljanje znanje: sestavljanje 30 min in Pakiranje znanje: pakiranje 15 min. Deli 5x (VA-001) in 10x (VI-M6)
```

---

#### Ustvari izdelek (strukturirano — ena faza, en del)

| Polje | Vrednost |
|---|---|
| MCP funkcija | `create_product` |
| Potrditev | Da |

```
Ustvari izdelek Lopata, faze: Sestavljanje, znanje: sestavljanje in trajanje 30 ter brez odvisnosti; Deli 4xVijakM8 (VI-08)
```

---

#### Posodobi zalogo izdelka

| Polje | Vrednost |
|---|---|
| MCP funkcija | `update_product` |
| Potrditev | Da |

```
Spremeni zalogo izdelka Elektricna omarica B na 5
```

---

#### Dodaj fazo obstoječemu izdelku

| Polje | Vrednost |
|---|---|
| MCP funkcija | `update_product` |
| Potrditev | Da |

```
Dodaj fazo Rezanje, znanje: rezanje in trajanje 45 min pri Kovinsko ohisje A
```

---

#### Dodaj del obstoječemu izdelku

| Polje | Vrednost |
|---|---|
| MCP funkcija | `update_product` |
| Potrditev | Da |

```
Dodaj Printerju del (VA-001), kolicina 5
```

---

#### Izbriši izdelek

| Polje | Vrednost |
|---|---|
| MCP funkcija | `delete_product` |
| Potrditev | Da |

```
Izbriši izdelek Lopata
```

---

### Deli (Parts)

#### Prikaz vseh delov

| Polje | Vrednost |
|---|---|
| MCP funkcija | `get_parts` |
| Potrditev | Ne |

```
Prikaži vse rezervne dele
```
```
Preveri zalogo delov
```

---

#### Prikaz enega dela

| Polje | Vrednost |
|---|---|
| MCP funkcija | `get_parts` |
| Potrditev | Ne |

```
Pokaži rezervni del VI-08
```
```
Prikaži del Vijak M8
```

---

#### Ustvari del

| Polje | Vrednost |
|---|---|
| MCP funkcija | `create_part` |
| Potrditev | Da |

```
Dodaj rezervni del Vijak M8 (VI-08), kolicina 5
```

---

#### Posodobi del

| Polje | Vrednost |
|---|---|
| MCP funkcija | `update_part` |
| Potrditev | Da |

```
Spremeni Vijak M8 (VI-08), zalogo na voljo na 4 in min zalogo na 3
```

---

#### Izbriši del

| Polje | Vrednost |
|---|---|
| MCP funkcija | `delete_part` |
| Potrditev | Da |

```
Izbriši rezervni del (VI-08)
```

---

### Zaposleni (Employees)

#### Prikaz vseh zaposlenih

| Polje | Vrednost |
|---|---|
| MCP funkcija | `get_employees` |
| Potrditev | Ne |

```
Prikaži vse zaposlene
```

---

#### Ustvari zaposlenega

| Polje | Vrednost |
|---|---|
| MCP funkcija | `create_employee` |
| Potrditev | Da |

```
Dodaj zaposlenega Janez Novak
```

---

#### Dodaj znanje zaposlenemu

| Polje | Vrednost |
|---|---|
| MCP funkcija | `update_employee` |
| Potrditev | Da |

```
Uredi zaposlenega Marko Reznik, dodaj mu znanje: programiranje
```

---

#### Odstrani znanje zaposlenemu

| Polje | Vrednost |
|---|---|
| MCP funkcija | `update_employee` |
| Potrditev | Da |

```
Odstrani Marku Rezniku znanje varjenje
```

---

#### Izbriši zaposlenega

| Polje | Vrednost |
|---|---|
| MCP funkcija | `delete_employee` |
| Potrditev | Da |

```
Izbriši zaposlenega Janez Novak
```

---

### Naročila (Orders)

#### Prikaz naročil

| Polje | Vrednost |
|---|---|
| MCP funkcija | `get_orders` |
| Potrditev | Ne |

```
Prikaži naročila za AluTech
```
```
Prikaži vsa naročila
```

---

#### Ustvari naročilo

| Polje | Vrednost |
|---|---|
| MCP funkcija | `create_order` |
| Potrditev | Da |

```
Ustvari naročilo za podjetje Rutar, 3x Kovinsko ohisje A, rok 30.6.2026
```

---

#### Posodobi količino v naročilu

| Polje | Vrednost |
|---|---|
| MCP funkcija | `update_order` |
| Potrditev | Da |

```
Uredi naročilo BodyFit, Spremeni količino Lopata na 3
```

---

#### Posodobi status naročila

| Polje | Vrednost |
|---|---|
| MCP funkcija | `update_order` |
| Potrditev | Da |
| Opomba | Glej [tabelo statusov](#vrednosti-statusov) za veljavne vrednosti |

```
Spremeni naročilo Rutar, status: osnutek
```

---

#### Izbriši naročilo

| Polje | Vrednost |
|---|---|
| MCP funkcija | `delete_order` |
| Potrditev | Da |

```
Izbriši naročilo za Rutar
```

---

#### Ustvari delovni nalog iz obstoječega naročila

| Polje | Vrednost |
|---|---|
| MCP funkcija | `process_existing_order` |
| Potrditev | Da |

```
Naredi delovni nalog za naročilo BodyFit
```

---

### Delovni nalogi (Work Orders)

#### Prikaz vseh delovnih nalogov

| Polje | Vrednost |
|---|---|
| MCP funkcija | `get_work_orders` |
| Potrditev | Ne |

```
Prikaži vse delovne naloge
```

---

#### Ustvari delovni nalog (en izdelek)

| Polje | Vrednost |
|---|---|
| MCP funkcija | `process_work_order` |
| Potrditev | Da |
| Opomba | Samodejno generira faze in dodeli zaposlene |

```
Naredi delovni nalog za 2 kosa Kovinsko ohisje A za podjetje AluTech, rok 21.6.2026
```

---

#### Ustvari delovni nalog (več izdelkov)

| Polje | Vrednost |
|---|---|
| MCP funkcija | `process_work_order` |
| Potrditev | Da |

```
Naredi novi delovni nalog za FERI, ki ima 3x Pumpa in 2x Kovinsko ohisje A
```

---

#### Ustvari samo delovni nalog (brez workflow — brez faz in dodeljevanja)

| Polje | Vrednost |
|---|---|
| MCP funkcija | `create_work_order_only` |
| Potrditev | Da |
| Opomba | Ustvari zapis delovnega naloga brez generiranja faz ali dodelitve zaposlenih |

```
Ustvari SAMO delovni nalog za 2 kosa Kovinsko ohisje A
```

---

#### Posodobi status delovnega naloga

| Polje | Vrednost |
|---|---|
| MCP funkcija | `update_work_order` |
| Potrditev | Da |
| Opomba | Glej [tabelo statusov](#vrednosti-statusov) za veljavne vrednosti |

```
Spremeni WO-010 status na v procesu
```

---

#### Dodaj faze obstoječemu delovnemu nalogu

| Polje | Vrednost |
|---|---|
| MCP funkcija | `generate_work_order_phases` |
| Potrditev | Da |
| Opomba | Generira faze na podlagi faz v definiciji izdelka in jih dodeli razpoložljivim zaposlenim |

```
Za delovni nalog WO-008 dodaj potrebne faze zaposlenim
```

---

#### Povzetek delovnega naloga

| Polje | Vrednost |
|---|---|
| MCP funkcija | `summarize_work_order` |
| Potrditev | Ne |

```
Povzemi delovni nalog WO-004
```

---

#### Preveri razpoložljivost delov za izdelek

| Polje | Vrednost |
|---|---|
| MCP funkcija | `check_product_availability` |
| Potrditev | Ne |

```
Ali imamo dovolj delov za 5 Kovinsko ohisje A?
```

---

#### Preveri obremenitev zaposlenih

| Polje | Vrednost |
|---|---|
| MCP funkcija | `get_employee_workload` |
| Potrditev | Ne |

```
Kateri zaposleni je najbolj zaseden?
```

---

#### Izbriši delovni nalog

| Polje | Vrednost |
|---|---|
| MCP funkcija | `delete_work_order` |
| Potrditev | Da |

```
Izbriši delovni nalog WO-012
```

---

### Faze (Work Order Phases)

#### Prikaz faz delovnega naloga

| Polje | Vrednost |
|---|---|
| MCP funkcija | `get_work_order_phases` |
| Potrditev | Ne |

```
Prikaži faze delovnega naloga WO-004
```

---

#### Posodobi status faze

| Polje | Vrednost |
|---|---|
| MCP funkcija | `update_work_order_phase` |
| Potrditev | Da |
| Opomba | Deluje za ADMIN — za DELAVCA glej [spodaj](#posodobitev-statusa-lastne-faze) |

```
Posodobi status faze WO-004 / Varjenje na zaključeno
```
```
Označi fazo Rezanje pri WO-002 kot v procesu
```
```
Spremeni fazo WO-008, pakiranje na zaključeno
```

---

#### Izbriši fazo

| Polje | Vrednost |
|---|---|
| MCP funkcija | `delete_work_order_phase` |
| Potrditev | Da |

```
Izbriši fazo Rezanje pri WO-002
```

---

### Opozorila (Supply Alerts)

#### Prikaz vseh opozoril

| Polje | Vrednost |
|---|---|
| MCP funkcija | `get_supply_alerts` |
| Potrditev | Ne |

```
Prikaži opozorila
```
```
Pokaži vse supply alerts
```

---

## DELAVEC ukazi

> **Pomembno:** Delavci imajo omejen dostop. Vidijo in urejajo **samo lastne** faze in delovne naloge. Dostop do podatkov drugega delavca ali zaključenih nalogov je blokiran.

---

### Moje faze

#### Prikaz mojih faz

| Polje | Vrednost |
|---|---|
| MCP funkcija | `get_my_phases` |
| Potrditev | Ne |

```
Prikaži moje faze
```
```
Katere faze imam?
```

---

### Moji delovni nalogi

#### Prikaz mojih delovnih nalogov

| Polje | Vrednost |
|---|---|
| MCP funkcija | `get_my_work_orders` |
| Potrditev | Ne |

```
Prikaži moje delovne naloge
```
```
Moji nalogi
```

---

### Posodobitev statusa lastne faze

| Polje | Vrednost |
|---|---|
| MCP funkcija | `update_work_order_phase` |
| Potrditev | Da |
| Omejitev | Samo faze, ki so dodeljene prijavljenemu delavcu |

```
Posodobi status faze WO-004 / Varjenje na zaključeno
```

#### Blokade in napake

| Scenarij | Sporočilo napake |
|---|---|
| Faza ni dodeljena tebi | `Lahko urejate samo faze ki so dodeljene vam.` |
| Delovni nalog je zaključen (status: sold ali issued) | `Delovni nalog je zaključen` |

---

### Opozorila adminu

#### Ustvari supply alert

| Polje | Vrednost |
|---|---|
| MCP funkcija | `create_supply_alert` |
| Potrditev | Da |
| Opomba | Obvestilo se pošlje adminu; delavec ga ne more sam zapreti |

```
Opozori admina - manjkajo DIN letev
```
```
Ustvari opozorilo za vijak VI-08, opis: zmankuje pri montazi
```

---

## Vrednosti statusov

Asistent sprejema slovenske vnose in jih avtomatsko pretvori v angleške vrednosti, ki jih pričakuje API.

### Naročila in delovni nalogi

| Slovensko (vnos) | Angleško (API vrednost) |
|---|---|
| `osnutek` | `draft` |
| `potrjeno` | `confirmed` |
| `v produkciji` | `in_production` |
| `zaključeno` | `completed` |
| `prodano` | `sold` |

### Faze delovnega naloga

| Slovensko (vnos) | Angleško (API vrednost) |
|---|---|
| `planirano` | `planned` |
| `v procesu` | `in_progress` |
| `zaključeno` | `completed` |
| `zamuja` | `delayed` |

---

## OpenAI vs Ollama

Sistem podpira **OpenAI** (oblak) in **Ollama** (lokalno). Oba razumeta iste ukaze v slovenščini, vendar obstajajo razlike pri kompleksnih nalogah.

| Kriterij | OpenAI | Ollama |
|---|---|---|
| Enostavni ukazi (GET, brisanje) | Odlično | Odlično |
| Ustvarjanje z eno fazo in enim delom | Odlično | Dobro |
| Kompleksni ukazi (več faz + več delov) | **Priporočeno** | Manj zanesljivo |
| Hitrost (enostavni ukazi) | Hitra (+ local guard) | Hitra (lokalno) |
| Zasebnost podatkov | Oblak | **Lokalno — brez prenosa podatkov** |
| Strošek | Plačljivo | Brezplačno |

> **Priporočilo:** Za ukaze z več fazami in deli hkrati (npr. `create_product` z 2+ fazami in 2+ deli) uporabite **OpenAI**. Za enostavne operacije je Ollama dovolj zanesljiv in hitrejši lokalno.

> **Local guard:** Sistem prepozna pogoste enostavne vzorce (npr. "prikaži vse izdelke") in direktno pokliče MCP funkcijo brez posredovanja LLM-ja — to zmanjša latenco in stroške.

---

*Dokumentacija velja za verzijo aplikacije Smart Production Workflow z MCP integracijo.*

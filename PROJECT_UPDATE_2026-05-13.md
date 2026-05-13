# Project Update - 2026-05-13

## Povzetek stanja

Glavni styling pass je zakljucen in aplikacija je zdaj v funkcionalni fazi. Frontend ima dejanske zavihke, CRUD tokove, vloge admin/user, casovnice, statusne filtre, osnovno zalogo izdelkov in delov ter pripravljeno mesto za AI assistant.

Prebral sem tudi `PROJECT_NOTES.md` in dodan dokument `LLM_MCP_delovanje_in_primeri_assistant_chat.md`. Naslednja vecja faza projekta je zato jasna: povezati assistant chat z LLM interpretacijo, MCP orodji in backend poslovno logiko.

## Posodobljeno danes

- Popravljen je dashboard panel `Zasedenost`: oznaka `ure / faze` je prestavljena pod izbiro datuma in ostane v eni vrstici.
- Ure in stevilo faz pri zaposlenih so prikazani eden pod drugim z locilno crto.
- Desni scrollbar/track je ociscen: ozadje tracka je transparentno, `main` uporablja samo en stabilen gutter, zato se ne bi smela vec risati siva navpicna crta.
- Dodan in razsirjen je osnovni i18n sloj za slovenscino in anglescino.
- Sidebar zdaj prevaja tudi `Odjava` / `Log out`.
- Prevedeni so glavni zavihki, dashboard kartice, naslovi strani, iskalniki, statusi, gumbi in vecina stalnih form labelov.
- Prevedeni so vidni admin/user pogledi za izdelke, zalogo, zaposlene, narocila, delovne naloge, casovnico, nastavitve, my account in assistant panel.
- Na formah so prevedeni glavni vnosi za dodajanje in urejanje: kupec, rok, status, izdelek, kolicina, opis, naziv, znanja, ure, stanje zaloge, lokacija, uporabniki in jezik.
- Build frontend aplikacije je preverjen z `npm run build`.

## Trenutna funkcionalnost

- Admin lahko upravlja izdelke, dele, zalogo, zaposlene, narocila, delovne naloge, uporabnike in nastavitve.
- User ima omejen pogled: vidi svoje naloge/faze, katalog, zalogo, zaposlene in svoj racun.
- User lahko ureja statuse svojih dodeljenih faz.
- Casovnica podpira statusne filtre, filtre po nalogih/zaposlenih, prikaz tega tedna ali vseh datumov ter drag-and-drop premik faz med statusi.
- Dashboard prikazuje delovne naloge, zalogo izdelkov, casovnico faz in zasedenost zaposlenih.
- Delovni nalogi imajo podrobni pogled s fazami in dodeljevanjem zaposlenih.
- Narocila imajo podrobni pogled in podporo za vec izdelkov.
- Zaloga podpira dele, stanje delov, izdelke na polici in opozorila adminu.
- My account podpira spremembo jezika, gesla, slike in osnovno statistiko uporabnika.

## Naslednja faza: LLM + MCP + assistant chat

Naslednji korak je, da trenutni mock assistant preraste v dejanski LLM/MCP tok:

1. LLM interpretira naravni jezik uporabnika.
2. Backend odloci, kateri intent in katero MCP orodje sta primerna.
3. MCP server izpostavi orodja, kot so:
   - `check_inventory`
   - `check_product_availability`
   - `order_parts`
   - `update_inventory`
   - `process_work_order`
   - `create_work_order_only`
   - `assign_work_order_phases`
   - `get_employee_workload`
   - `summarize_work_order`
   - `reschedule_work_order`
   - `update_work_order_status`
4. Backend izvede poslovno logiko nad MongoDB.
5. Assistant vrne razumljiv odgovor uporabniku.
6. Activity log shrani prompt, provider, intent, orodje, argumente, rezultat, napake in trajanje.

## Dodatno za naslednji razvoj

- Dodati bo treba vec demo izdelkov, sestavnih delov, faz in zaloge, da bo LLM/MCP workflow imel realnejse primere.
- Smiselno bo dodati enostavne pomocne funkcije za iskanje izdelkov, delov, zaposlenih in delovnih nalogov po imenu ali kodi.
- `process_work_order` naj najprej preveri zalogo koncnih izdelkov na polici, nato sele zalogo delov, nato generiranje faz in dodelitev zaposlenim.
- `create_work_order_only` naj ustvari samo osnovni zapis brez avtomatskega workflowa.
- Pri manjkajocih podatkih mora asistent postaviti dodatno vprasanje, ne ugibati.

import { useEffect, useRef, useState } from "react";
import { Bot, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, HelpCircle, Play, X, XCircle } from "lucide-react";
import { EmptyState } from "./EmptyState.jsx";
import { label } from "../utils/i18n.js";

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getResultMessage(response) {
  if (response?.pendingAction?.status === "pending") {
    return "Ta akcija potrebuje potrditev.";
  }

  const items = response?.result?.items;
  if (Array.isArray(items) && items.length > 0) {
    if (response?.tool === "get_parts" || response?.interpreted?.intent === "get_parts") {
      return `Najdenih ${items.length} rezervnih delov.`;
    }
    if (response?.tool === "get_products" || response?.interpreted?.intent === "get_products") {
      return `Najdenih ${items.length} izdelkov.`;
    }
    return `Najdenih ${items.length} zapisov.`;
  }

  return response?.result?.message || response?.interpreted?.message || "Akcija je bila izvedena.";
}

function getActivityCommand(activity) {
  return activity?.input?.command || activity?.input?.originalInput?.command || activity?.input?.originalInput?.interpreted?.rawInput?.command || "";
}

function formatShortDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatItems(items = []) {
  return items.map((item) => `${item.quantity} x ${item.productName || item.productId?.name || "izdelek"}`).join(", ");
}

function renderItemDetails(item) {
  if (item.customerName) {
    return (
      <>
        <span>{formatItems(item.items) || "Brez izdelkov"}</span>
        <span>Status: {label(item.status) || item.status} / Rok: {formatShortDate(item.requestedDeadline)}</span>
      </>
    );
  }

  return (
    <>
      {item.sku && <span>{item.sku}</span>}
      {"availableQuantity" in item && (
        <span>
          Zaloga: {item.availableQuantity} {item.unit || "pcs"} / uporabno: {item.usableQuantity ?? item.availableQuantity}
          {item.reservedQuantity ? ` / rezervirano: ${item.reservedQuantity}` : ""}
          {item.location ? ` / lokacija: ${item.location}` : ""}
        </span>
      )}
      {!("availableQuantity" in item) && item.status && <span>Status: {label(item.status) || item.status}</span>}
      {Array.isArray(item.skills) && <span>Znanja: {item.skills.join(", ") || "-"}</span>}
      {item.workingHoursPerDay !== undefined && <span>Ure na dan: {item.workingHoursPerDay}</span>}
    </>
  );
}

function renderResultDetails(response) {
  const items = response?.result?.items;

  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="assistantResultList">
      {items.map((item) => (
        <div className="assistantResultItem" key={item._id || item.id || item.sku || item.name}>
          <strong>{item.customerName || item.name || item.code || item.sku || "Zapis"}</strong>
          {renderItemDetails(item)}
        </div>
      ))}
    </div>
  );
}

function renderActivityDisplay(activity) {
  const output = activity?.output || {};
  const items = Array.isArray(output.items) ? output.items : [];

  if (!output.message && !items.length && !output.workOrder && !output.status && !output.code) {
    return <EmptyState label="Za to aktivnost ni posebnega prikaza." />;
  }

  return (
    <div className="activityActualDisplay">
      {output.message && <p>{output.message}</p>}
      {output.workOrder && (
        <div className="resultSummary">
          <CheckCircle2 size={18} />
          <div>
            <strong>{output.workOrder.code}</strong>
            <span>{output.phases?.length || 0} {label("phasesShort")} - {output.workOrder.inventoryStatus || output.workOrder.status}</span>
          </div>
        </div>
      )}
      {items.length > 0 && (
        <div className="assistantResultList">
          {items.slice(0, 20).map((item) => (
            <div className="assistantResultItem" key={item._id || item.id || item.sku || item.name || item.code}>
              <strong>{item.customerName || item.name || item.code || item.sku || item.tool || "Zapis"}</strong>
              {renderItemDetails(item)}
            </div>
          ))}
        </div>
      )}
      {!items.length && output.status && <span>Status: {output.status}</span>}
      {!items.length && output.code && <span>Koda: {output.code}</span>}
    </div>
  );
}

function ActivityDetails({ activity }) {
  if (!activity) return null;
  const command = getActivityCommand(activity);

  return (
    <div className="activityDetails">
      <div className="activityDetailsHeader">
        <div>
          <strong>{activity.mcpTool || activity.action}</strong>
          <span>{activity.llmProvider} - {activity.durationMs} ms - {formatDateTime(activity.createdAt)}</span>
        </div>
      </div>
      {command && (
        <div className="activityUserCommand">
          <span>Uporabnikov vnos</span>
          <strong>{command}</strong>
        </div>
      )}
      <label>
        Vhod
        <pre>{JSON.stringify(activity.input || {}, null, 2)}</pre>
      </label>
      <label>
        Izhod
        <pre>{JSON.stringify(activity.output || {}, null, 2)}</pre>
      </label>
      <div className="activityDisplayBlock">
        <span>Dejanski prikaz</span>
        {renderActivityDisplay(activity)}
      </div>
    </div>
  );
}

export function CopilotPanel({
  activities,
  activityFilters,
  messages,
  command,
  provider,
  result,
  loading,
  setCommand,
  setProvider,
  onRunCommand,
  onAcceptPending,
  onDeclinePending,
  onActivityFiltersChange,
  onHide
}) {
  const [activityOpen, setActivityOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [useGuard, setUseGuard] = useState(true);
  const [naturalResponse, setNaturalResponse] = useState(false);

  function useExample(text) {
    setCommand(text);
    setHelpOpen(false);
  }
  const commandRef = useRef(null);
  const threadRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const providerName = provider === "openai" ? "OpenAI API" : "Ollama";
  const selectedActivity = activities.find((activity) => activity._id === selectedActivityId) || activities[0] || null;

  useEffect(() => {
    const textarea = commandRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const styles = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 22;
    const padding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
    const border = Number.parseFloat(styles.borderTopWidth) + Number.parseFloat(styles.borderBottomWidth);
    const maxHeight = (lineHeight * 5) + padding + border;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [command]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread || !shouldAutoScrollRef.current) return;

    thread.scrollTo({
      top: thread.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, loading]);

  function handleThreadScroll(event) {
    const thread = event.currentTarget;
    const distanceFromBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
  }

  return (
    <>
      <aside className="copilot">
        <div className="copilotHeader">
          <div className="copilotTitle">
            <Bot size={22} />
            <div>
              <strong>Assistant {providerName}</strong>
            </div>
          </div>
          <button type="button" className="copilotHideButton" onClick={onHide} aria-label="Skrij AI asistenta">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="chatPanel">
          <div className="sectionHeader compact">
            <h2>Pogovor</h2>
            {result?.interpreted?.intent && <span>{result.interpreted.intent}</span>}
          </div>
          <div className="assistantThread" ref={threadRef} onScroll={handleThreadScroll}>
            <div className="assistantThreadInner">
              {messages.length === 0 && !loading && <EmptyState label={label("waitingForCommand")} />}
              {messages.map((message) => (
                <div className={`chatBubble ${message.role === "user" ? "userBubble" : "assistantBubble"}`} key={message.id}>
                  <div className="messageMeta">
                    <strong>{message.role === "user" ? "Ti" : `Assistant ${message.provider === "openai" ? "OpenAI" : "Ollama"}`}</strong>
                    <span>{message.action || formatDateTime(message.createdAt)}</span>
                  </div>
                  {message.text ? <p>{message.text}</p> : <p>{getResultMessage(message.response)}</p>}
                  {message.response?.naturalText && (
                    <p className="naturalResponseText">{message.response.naturalText}</p>
                  )}
                  {message.response?.result?.workOrder && (
                    <div className="resultSummary">
                      <CheckCircle2 size={18} />
                      <div>
                        <strong>{message.response.result.workOrder.code}</strong>
                        <span>{message.response.result.phases?.length ?? 0} {label("phasesShort")} — {message.response.result.workOrder.inventoryStatus}</span>
                      </div>
                    </div>
                  )}
                  {renderResultDetails(message.response)}
                  {message.response?.pendingAction?.status === "pending" && (
                    <div className="confirmationCard">
                      <div>
                        <strong>Potrditev je potrebna</strong>
                        <span>{message.response.pendingAction.previewMessage || message.response.result?.message}</span>
                      </div>
                      <div className="confirmationActions">
                        <button type="button" className="primary acceptButton" onClick={() => onAcceptPending?.(message.response.pendingAction.id)} disabled={loading}>
                          <CheckCircle2 size={16} />
                          Potrdi
                        </button>
                        <button type="button" className="iconText declineButton" onClick={() => onDeclinePending?.(message.response.pendingAction.id)} disabled={loading}>
                          <XCircle size={16} />
                          Zavrni
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="chatBubble assistantBubble copilotTyping" aria-label="Assistant pripravlja odgovor">
              <span />
              <span />
              <span />
            </div>
          ) : null}
        </div>

        <form onSubmit={(e) => onRunCommand(e, { useGuard, naturalResponse })} className="commandForm">
          <div className="segmented">
            <button type="button" className={provider === "openai" ? "selected" : ""} onClick={() => setProvider("openai")}>OpenAI</button>
            <button type="button" className={provider === "ollama" ? "selected" : ""} onClick={() => setProvider("ollama")}>Ollama</button>
          </div>
          <label className="guardToggle" title={useGuard ? "Lokalni guard vklopljen" : "Lokalni guard izklopljen"}>
            <input type="checkbox" checked={useGuard} onChange={(e) => setUseGuard(e.target.checked)} />
            <span>Guard</span>
          </label>
          <label className="guardToggle" title={naturalResponse ? "LLM oblikuje naravni odgovor" : "Strukturiran odgovor (privzeto)"}>
            <input type="checkbox" checked={naturalResponse} onChange={(e) => setNaturalResponse(e.target.checked)} />
            <span>LLM odgovor</span>
          </label>
          <textarea
            ref={commandRef}
            className="commandTextarea"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Kako lahko pomagam?"
            rows={2}
          />
          <button className="primary runButton" disabled={loading}>
            <Play size={17} />
            {label("run")}
          </button>
        </form>

        <div className="activityToggleRow">
          <button type="button" className="activityToggleButton" onClick={() => setActivityOpen(true)}>
            <ClipboardList size={17} />
            {label("activityLog")}
            <span>{activities.length}</span>
          </button>
          <button type="button" className="activityToggleButton helpToggleButton" onClick={() => setHelpOpen(true)}>
            <HelpCircle size={17} />
            Pomoč
          </button>
        </div>
      </aside>

      {activityOpen && (
        <div className="modalOverlay activityModalOverlay">
          <div className="activityModal">
            <div className="modalHeader">
              <div>
                <h2>{label("activityLog")}</h2>
                <span>Podroben pregled MCP/LLM akcij, vhodov, izhodov in trajanja.</span>
              </div>
              <button type="button" className="iconButton" onClick={() => setActivityOpen(false)} aria-label="Zapri dnevnik aktivnosti">
                <X size={18} />
              </button>
            </div>

            <div className="activityModalBody">
              <div className="activityModalList">
                <div className="sectionHeader compact">
                  <h2>Aktivnosti</h2>
                  <CalendarClock size={16} />
                </div>
                <div className="activityFilters">
                  <label>
                    Prikaz
                    <select
                      value={activityFilters.limit}
                      onChange={(event) => onActivityFiltersChange?.({ limit: Number(event.target.value) })}
                    >
                      <option value={30}>30</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </label>
                  <label>
                    Datum
                    <input
                      type="date"
                      value={activityFilters.date}
                      onChange={(event) => onActivityFiltersChange?.({ date: event.target.value })}
                    />
                  </label>
                  <label className="activityMineFilter">
                    <input
                      type="checkbox"
                      checked={activityFilters.mine}
                      onChange={(event) => onActivityFiltersChange?.({ mine: event.target.checked })}
                    />
                    Samo moje
                  </label>
                  {activityFilters.date && (
                    <button type="button" className="iconText clearActivityDate" onClick={() => onActivityFiltersChange?.({ date: "" })}>
                      Pocisti datum
                    </button>
                  )}
                </div>
                {activities.map((activity) => (
                  <button
                    type="button"
                    className={`activityItem ${selectedActivity?._id === activity._id ? "selected" : ""}`}
                    key={activity._id}
                    onClick={() => setSelectedActivityId(activity._id)}
                  >
                    <strong>{activity.mcpTool || activity.action}</strong>
                    {getActivityCommand(activity) && <span>{getActivityCommand(activity)}</span>}
                    <span>{activity.llmProvider} - {activity.durationMs} ms - {formatDateTime(activity.createdAt)}</span>
                  </button>
                ))}
                {activities.length === 0 && <EmptyState label="Ni aktivnosti." />}
              </div>

              <ActivityDetails activity={selectedActivity} />
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="modalOverlay activityModalOverlay" onClick={() => setHelpOpen(false)}>
          <div className="activityModal helpModal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <h2>Pomoč — Assistant chat</h2>
                <span>Primeri ukazov — klikni za vnos v polje</span>
              </div>
              <button type="button" className="iconButton" onClick={() => setHelpOpen(false)}><X size={18} /></button>
            </div>
            <div className="helpLayout">
              <nav className="helpNav">
                <button type="button" onClick={() => document.getElementById("help-splosno")?.scrollIntoView({ behavior: "smooth" })}>Splošno</button>
                {["Izdelki","Rezervni deli","Delovni nalogi","Faze","Zaposleni","Naročila","Opozorila","Samo za delavce"].map((s) => (
                  <button key={s} type="button" onClick={() => document.getElementById(`help-${s.toLowerCase().replace(/\s+/g,"-").replace(/č/g,"c").replace(/š/g,"s").replace(/ž/g,"z").replace(/ó/g,"o")}`)?.scrollIntoView({ behavior: "smooth" })}>
                    {s}
                  </button>
                ))}
              </nav>
              <div className="helpContent">
              <div className="helpSection" id="help-splosno">
                <h3>Splošno</h3>
                <p>Asistent razume slovenščino in angleščino. Za mutacije (ustvari/posodobi/izbriši) boš moral potrditi akcijo.</p>
                <p><strong>OpenAI</strong> — priporočeno za kompleksne ukaze (več faz, več delov) &nbsp;·&nbsp; <strong>Ollama</strong> — hitrejši za enostavne ukaze</p>
              </div>
              {[
                { title: "Izdelki", items: [
                  { text: "Prikaži vse izdelke", fn: "get_products" },
                  { text: "Ustvari izdelek Lopata, faze: Sestavljanje, znanje: sestavljanje in trajanje 30 ter brez odvisnosti; Deli 4xVijakM8 (VI-08)", fn: "create_product" },
                  { text: "Dodaj fazo Rezanje, znanje: rezanje in trajanje 45 min pri Kovinsko ohisje A", fn: "update_product" },
                  { text: "Spremeni zalogo izdelka Elektricna omarica B na 5", fn: "update_product" },
                  { text: "Izbriši izdelek Lopata", fn: "delete_product" },
                ]},
                { title: "Rezervni deli", items: [
                  { text: "Prikaži vse rezervne dele", fn: "get_parts" },
                  { text: "Pokaži rezervni del VI-08", fn: "get_parts" },
                  { text: "Dodaj rezervni del Vijak M8 (VI-08), kolicina 5", fn: "create_part" },
                  { text: "Spremeni Vijak M8 (VI-08), zalogo na voljo na 4 in min zalogo na 3", fn: "update_part" },
                  { text: "Izbriši rezervni del (VI-08)", fn: "delete_part" },
                ]},
                { title: "Delovni nalogi", items: [
                  { text: "Prikaži vse delovne naloge", fn: "get_work_orders" },
                  { text: "Ali imamo dovolj delov za 5 Kovinsko ohisje A?", fn: "check_product_availability" },
                  { text: "Naredi delovni nalog za 2 kosa Kovinsko ohisje A za AluTech, rok 21.6.2026", fn: "process_work_order" },
                  { text: "Naredi novi delovni nalog za FERI, ki ima 3x Pumpa in 2x Kovinsko ohisje A", fn: "process_work_order" },
                  { text: "Naredi delovni nalog za naročilo BodyFit", fn: "process_existing_order" },
                  { text: "Ustvari SAMO delovni nalog za 2 kosa Kovinsko ohisje A", fn: "create_work_order_only" },
                  { text: "Za delovni nalog WO-008 dodaj potrebne faze zaposlenim", fn: "generate_work_order_phases" },
                  { text: "Spremeni WO-010 status na v procesu", fn: "update_work_order" },
                  { text: "Povzemi delovni nalog WO-004", fn: "summarize_work_order" },
                  { text: "Izbriši delovni nalog WO-012", fn: "delete_work_order" },
                ]},
                { title: "Faze", items: [
                  { text: "Prikaži faze delovnega naloga WO-004", fn: "get_work_order_phases" },
                  { text: "Posodobi status faze WO-004 / Varjenje na zaključeno", fn: "update_work_order_phase" },
                  { text: "Označi fazo Rezanje pri WO-002 kot v procesu", fn: "update_work_order_phase" },
                  { text: "Izbriši fazo Rezanje pri WO-002", fn: "delete_work_order_phase" },
                ]},
                { title: "Zaposleni", items: [
                  { text: "Prikaži vse zaposlene", fn: "get_employees" },
                  { text: "Dodaj zaposlenega Jana Novak, znanja: rezanje, varjenje", fn: "create_employee" },
                  { text: "Uredi zaposlenega Marko Reznik, dodaj mu znanje: programiranje", fn: "update_employee" },
                  { text: "Kateri zaposleni je najbolj zaseden?", fn: "get_employee_workload" },
                  { text: "Izbriši zaposlenega Jana Novak", fn: "delete_employee" },
                ]},
                { title: "Naročila", items: [
                  { text: "Prikaži naročila za AluTech", fn: "get_orders" },
                  { text: "Ustvari naročilo za podjetje Rutar, 3x Kovinsko ohisje A, rok 30.6.2026", fn: "create_order" },
                  { text: "Uredi naročilo BodyFit, Spremeni količino Lopata na 3", fn: "update_order" },
                  { text: "Uredi naročilo BodyFit, rok: 30.6.2026 23:00", fn: "update_order" },
                  { text: "Naredi delovni nalog za naročilo BodyFit", fn: "process_existing_order" },
                  { text: "Izbriši naročilo za Rutar", fn: "delete_order" },
                ]},
                { title: "Opozorila", items: [
                  { text: "Prikaži vsa opozorila", fn: "get_supply_alerts" },
                  { text: "Opozori admina - manjkajo DIN letev", fn: "create_supply_alert" },
                  { text: "Ustvari opozorilo za vijak VI-08, opis: zmankuje pri montazi", fn: "create_supply_alert" },
                ]},
                { title: "Samo za delavce", items: [
                  { text: "Prikaži moje faze", fn: "get_my_phases" },
                  { text: "Prikaži moje delovne naloge", fn: "get_my_work_orders" },
                  { text: "Opozori admina - manjkajo DIN letev", fn: "create_supply_alert" },
                ]},
              ].map(({ title, items }) => {
                const sectionId = `help-${title.toLowerCase().replace(/\s+/g,"-").replace(/č/g,"c").replace(/š/g,"s").replace(/ž/g,"z").replace(/ó/g,"o")}`;
                return (
                  <div className="helpSection" key={title} id={sectionId}>
                    <h3>{title}</h3>
                    {items.map(({ text, fn }) => (
                      <button key={text} type="button" className="helpExample" onClick={() => useExample(text)} title="Klikni za vnos">
                        <span className="helpExampleText">{text}</span>
                        <span className="helpExampleFn">{fn}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
              <div className="helpSection">
                <h3>Statusi (slovensko)</h3>
                <p>osnutek · potrjeno · v produkciji · zaključeno · prodano · planirano · v procesu · zamuja</p>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

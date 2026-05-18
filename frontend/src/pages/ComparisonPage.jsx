import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, List, Search, Table2, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { label } from "../utils/i18n.js";

const ALL_MCP_TOOLS = [
  "check_inventory","check_product_availability","complete_work_order_for_approval",
  "get_employee_workload","summarize_work_order",
  "generate_work_order_phases","process_work_order","create_work_order_only",
  "process_existing_order","create_work_order_record",
  "get_parts","create_part","update_part","delete_part",
  "get_employees","create_employee","update_employee","delete_employee",
  "get_products","create_product","update_product","delete_product",
  "get_orders","create_order","update_order","delete_order",
  "get_work_orders","update_work_order","delete_work_order",
  "get_work_order_phases","create_work_order_phase","update_work_order_phase","delete_work_order_phase",
  "get_my_phases","get_my_work_orders","create_supply_alert","get_supply_alerts"
];

const PROVIDERS = [
  { key: "openai",  label: "OpenAI" },
  { key: "ollama",  label: "Ollama" },
  { key: "rule",    label: "LocalGuard" }
];

function AccuracyBadge({ accurate }) {
  if (accurate === true)  return <span className="accuracyBadge accurate">✓ pravilno</span>;
  if (accurate === false) return <span className="accuracyBadge inaccurate">✗ napačno</span>;
  return <span className="accuracyBadge pending">? ni ocenjeno</span>;
}

function ActivityDetail({ activity, onClose, onAccuracy, token }) {
  const [note, setNote] = useState(activity.accuracyNote || "");
  const [saving, setSaving] = useState(false);
  const [qFinal, setQFinal] = useState(activity.qualityScoreFinal ?? activity.qualityScoreAuto ?? "");
  const [rFinal, setRFinal] = useState(activity.readabilityScoreFinal ?? activity.readabilityScoreAuto ?? "");
  const [adjNote, setAdjNote] = useState(activity.adjustmentNote || "");

  async function save(accurate) {
    setSaving(true);
    await onAccuracy(activity._id, { accurate, accuracyNote: note });
    setSaving(false);
  }

  async function saveScores() {
    setSaving(true);
    const qNum = qFinal !== "" ? Number(qFinal) : null;
    const rNum = rFinal !== "" ? Number(rFinal) : null;
    const adjusted = qNum !== activity.qualityScoreAuto || rNum !== activity.readabilityScoreAuto;
    await onAccuracy(activity._id, {
      qualityScoreFinal: qNum,
      readabilityScoreFinal: rNum,
      scoreManuallyAdjusted: adjusted,
      adjustmentNote: adjNote
    });
    setSaving(false);
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="activityModal comparisonDetail" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <h2>{activity.mcpTool || activity.action}</h2>
            <span>{activity.llmProvider} · {activity.durationMs} ms · {new Date(activity.createdAt).toLocaleString("sl-SI")}</span>
          </div>
          <button type="button" className="iconButton" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="comparisonDetailBody">
          <div className="comparisonDetailSection">
            <h4>Ukaz</h4>
            <p>{activity.input?.command || activity.input?.originalInput?.command || "—"}</p>
            <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
              <span className={`providerChip ${activity.llmProvider}`}>{activity.llmProvider}</span>
              {activity.useGuard !== null && activity.useGuard !== undefined && (
                <span className={`providerChip ${activity.useGuard ? "rule" : "openai"}`}>
                  Guard: {activity.useGuard ? "ON" : "OFF"}
                </span>
              )}
              {activity.naturalResponse && <span className="providerChip" style={{background:"#ece8f8",color:"#4a3070"}}>LLM odgovor</span>}
            </div>
          </div>
          <div className="comparisonDetailSection">
            <h4>Vhod (intent + args)</h4>
            <pre>{JSON.stringify(activity.input?.interpreted || activity.input || {}, null, 2)}</pre>
          </div>
          <div className="comparisonDetailSection">
            <h4>Izhod</h4>
            <pre>{JSON.stringify(activity.output || {}, null, 2)}</pre>
          </div>
          <div className="comparisonDetailSection accuracySection">
            <h4>Ocena točnosti</h4>
            <AccuracyBadge accurate={activity.accurate} />
            <div className="accuracyButtons">
              <button type="button" className={`accuracyBtn correct ${activity.accurate === true ? "active" : ""}`} onClick={() => save(true)} disabled={saving}>
                <ThumbsUp size={16} /> Pravilno
              </button>
              <button type="button" className={`accuracyBtn incorrect ${activity.accurate === false ? "active" : ""}`} onClick={() => save(false)} disabled={saving}>
                <ThumbsDown size={16} /> Napačno
              </button>
              <button type="button" className="accuracyBtn reset" onClick={() => save(null)} disabled={saving}>
                <X size={14} /> Ponastavi
              </button>
            </div>
            <textarea
              className="accuracyNote"
              placeholder="Opomba: npr. ni dodal vseh faz, napačen provider, manjkajo deli..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
            <button type="button" className="primary saveNoteBtn" onClick={() => save(activity.accurate)} disabled={saving}>Shrani opombo</button>
          </div>

          {(activity.naturalResponse || activity.qualityScoreAuto != null) && (
            <div className="comparisonDetailSection accuracySection">
              <h4>Kakovost in berljivost odgovora (1–5)</h4>
              {activity.qualityScoreAuto != null && (
                <p style={{fontSize:"0.82rem",color:"#72818a",marginBottom:8}}>
                  Avtomatska ocena: kakovost <strong>{activity.qualityScoreAuto}</strong>, berljivost <strong>{activity.readabilityScoreAuto}</strong>
                  {activity.evaluatorReason && <> — <em>{activity.evaluatorReason}</em></>}
                </p>
              )}
              {activity.faithfulToMcpResult !== null && activity.faithfulToMcpResult !== undefined && (
                <p style={{fontSize:"0.82rem",color: activity.faithfulToMcpResult ? "#1a5e3f" : "#8a2a2d",marginBottom:8}}>
                  Zvestoba rezultatu: {activity.faithfulToMcpResult ? "✓ zvest" : "✗ odstopa"}
                </p>
              )}
              <div className="scoreRow">
                <label>Kakovost (končna):
                  <select className="scoreSelect" value={qFinal} onChange={(e) => setQFinal(e.target.value)}>
                    <option value="">—</option>
                    {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label>Berljivost (končna):
                  <select className="scoreSelect" value={rFinal} onChange={(e) => setRFinal(e.target.value)}>
                    <option value="">—</option>
                    {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
              <textarea
                className="accuracyNote"
                placeholder="Opomba ob korekciji: zakaj si spremenil avtomatsko oceno..."
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                rows={2}
              />
              <button type="button" className="primary saveNoteBtn" onClick={saveScores} disabled={saving}>
                Shrani ocene
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STAT_PROVIDERS = [
  { key: "openai", label: "OpenAI", hBg: "#1a8fc1", hColor: "#fff", subBg: "#eaf5fb", subColor: "#1a5f82", cellBg: "rgba(223,240,250,0.28)", cellBgEven: "rgba(223,240,250,0.52)" },
  { key: "ollama", label: "Ollama", hBg: "#d4850a", hColor: "#fff", subBg: "#fdf4e4", subColor: "#7a4d06", cellBg: "rgba(255,241,216,0.28)", cellBgEven: "rgba(255,241,216,0.52)" },
];

const STAT_COLS = [
  { key: "n",       label: "N",      title: "Število klicev" },
  { key: "ms",      label: "ms",     title: "Povprečen odzivni čas" },
  { key: "ok",      label: "✓",      title: "Pravilnih" },
  { key: "err",     label: "✗",      title: "Napačnih" },
  { key: "acc",     label: "%",      title: "Točnost" },
  { key: "q",       label: "⭐",     title: "Povprečna kakovost (1-5)" },
  { key: "r",       label: "📖",     title: "Povprečna berljivost (1-5)" },
];

function StatsTable({ activities, activeProviders }) {
  const visibleProviders = STAT_PROVIDERS.filter((p) => !activeProviders || activeProviders.includes(p.key));

  const rows = useMemo(() => {
    const byTool = new Map();
    for (const a of activities) {
      const tool = a.mcpTool || a.action;
      const prov = a.llmProvider || "mock";
      if (prov === "rule") continue;
      if (!byTool.has(tool)) byTool.set(tool, {});
      const td = byTool.get(tool);
      if (!td[prov]) td[prov] = { count: 0, totalMs: 0, correct: 0, incorrect: 0, unrated: 0, totalQ: 0, countQ: 0, totalR: 0, countR: 0 };
      const d = td[prov];
      d.count++;
      d.totalMs += a.durationMs || 0;
      if (a.accurate === true) d.correct++;
      else if (a.accurate === false) d.incorrect++;
      else d.unrated++;
      const q = a.qualityScoreFinal ?? a.qualityScoreAuto;
      const r = a.readabilityScoreFinal ?? a.readabilityScoreAuto;
      if (q != null) { d.totalQ += q; d.countQ++; }
      if (r != null) { d.totalR += r; d.countR++; }
    }
    const testedTools = new Set(byTool.keys());
    const testedRows = Array.from(byTool.entries()).map(([tool, pd]) => {
      const provStats = {};
      for (const p of STAT_PROVIDERS) {
        const d = pd[p.key];
        if (!d) { provStats[p.key] = null; continue; }
        provStats[p.key] = {
          n: d.count,
          ms: Math.round(d.totalMs / d.count),
          ok: d.correct || null,
          err: d.incorrect || null,
          acc: (d.count - d.unrated) > 0 ? Math.round((d.correct / (d.count - d.unrated)) * 100) : null,
          q: d.countQ > 0 ? (d.totalQ / d.countQ).toFixed(1) : null,
          r: d.countR > 0 ? (d.totalR / d.countR).toFixed(1) : null,
        };
      }
      return { tool, untested: false, ...provStats };
    });
    const untestedRows = ALL_MCP_TOOLS
      .filter((t) => !testedTools.has(t))
      .map((t) => ({ tool: t, untested: true }));
    return [...testedRows, ...untestedRows].sort((a, b) => a.tool.localeCompare(b.tool));
  }, [activities]);

  return (
    <div className="statsTableWrap">
      <table className="statsTable mergedStatsTable">
        <thead>
          <tr>
            <th className="mstFnCol" rowSpan={2} style={{ width: "15%" }}>MCP funkcija</th>
            {visibleProviders.map((p, i) => (
              <th key={p.key} colSpan={STAT_COLS.length}
                style={{
                  ...(i === visibleProviders.length - 1 ? { width: "15%" } : {}),
                  background: p.hBg, color: p.hColor, textAlign: "center", borderBottom: `2px solid ${p.hBg}`, letterSpacing: "0.06em"
                }}>
                {p.label}
              </th>
            ))}
          </tr>
          <tr>
            {visibleProviders.flatMap((p) =>
              STAT_COLS.map((c) => (
                <th key={`${p.key}-${c.key}`} title={c.title}
                  style={{ background: p.subBg, color: p.subColor, borderBottom: `1px solid ${p.subBg === "#eaf5fb" ? "#aed8ef" : "#e8c47c"}` }}>
                  {c.label}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isEven = idx % 2 === 0;
            return (
              <tr key={row.tool} className={row.untested ? "untestedRow" : ""}>
                <td className="mstFnCol"><code>{row.tool}</code></td>
                {visibleProviders.flatMap((p) => {
                  const d = row[p.key];
                  const bg = isEven ? p.cellBgEven : p.cellBg;
                  if (!d) return STAT_COLS.map((c) => (
                    <td key={`${p.key}-${c.key}`} style={{ background: bg }} className="mstUntested">/</td>
                  ));
                  return STAT_COLS.map((c) => (
                    <td key={`${p.key}-${c.key}`} style={{ background: bg }}
                      className={c.key === "ok" ? "correct" : c.key === "err" ? "incorrect" : ""}>
                      {d[c.key] ?? "—"}{c.key === "acc" && d[c.key] != null ? "%" : ""}{c.key === "ms" && d[c.key] != null ? " ms" : ""}
                    </td>
                  ));
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const CHART_METRICS = [
  { key: "time",     label: "Čas (ms)",    unit: "ms",  color: null },
  { key: "quality",  label: "⭐ Kakovost", unit: "/5",  color: null },
  { key: "readability", label: "📖 Berljivost", unit: "/5", color: null },
  { key: "accuracy", label: "✓ Točnost",   unit: "%",   color: null }
];

function BarChartView({ activities, providers: activeProviders, metric = "time" }) {
  const [hoveredProvider, setHoveredProvider] = useState(null);
  const CHART_H = 240;

  const PROVIDERS = [
    { key: "openai", label: "OpenAI", color: "#1a8fc1" },
    { key: "ollama", label: "Ollama", color: "#d4850a" }
  ].filter((p) => !activeProviders || activeProviders.includes(p.key));

  const data = useMemo(() => {
    const byTool = new Map();
    for (const a of activities) {
      const tool = a.mcpTool || a.action;
      const prov = a.llmProvider || "mock";
      if (!byTool.has(tool)) byTool.set(tool, {});
      const pm = byTool.get(tool);
      pm[prov] = pm[prov] || { count: 0, totalMs: 0, correct: 0, rated: 0, totalQ: 0, countQ: 0, totalR: 0, countR: 0 };
      pm[prov].count++;
      pm[prov].totalMs += a.durationMs || 0;
      if (a.accurate === true) pm[prov].correct++;
      if (a.accurate !== null) pm[prov].rated++;
      const q = a.qualityScoreFinal ?? a.qualityScoreAuto;
      const r = a.readabilityScoreFinal ?? a.readabilityScoreAuto;
      if (q != null) { pm[prov].totalQ += q; pm[prov].countQ++; }
      if (r != null) { pm[prov].totalR += r; pm[prov].countR++; }
    }
    return ALL_MCP_TOOLS.slice().sort().map((tool) => {
      const pm = byTool.get(tool) || {};
      const row = { tool };
      let anyTested = false;
      for (const p of PROVIDERS) {
        const d = pm[p.key];
        if (!d) { row[p.key] = null; continue; }
        anyTested = true;
        if (metric === "time") row[p.key] = Math.round(d.totalMs / d.count);
        else if (metric === "quality") row[p.key] = d.countQ > 0 ? +(d.totalQ / d.countQ).toFixed(2) : null;
        else if (metric === "readability") row[p.key] = d.countR > 0 ? +(d.totalR / d.countR).toFixed(2) : null;
        else if (metric === "accuracy") row[p.key] = d.rated > 0 ? Math.round((d.correct / d.rated) * 100) : null;
      }
      row.untested = !anyTested;
      return row;
    });
  }, [activities, metric, PROVIDERS.map(p => p.key).join()]);

  const maxVal = Math.max(...data.flatMap((d) => PROVIDERS.map((p) => d[p.key] ?? 0)), 1);
  const metaInfo = CHART_METRICS.find((m) => m.key === metric);

  return (
    <div className="barChartView">
      <div className="barChartLegend">
        {PROVIDERS.map((p) => (
          <span key={p.key} className="barChartLegendItem"
            onMouseEnter={() => setHoveredProvider(p.key)}
            onMouseLeave={() => setHoveredProvider(null)}
            style={{ cursor: "pointer", opacity: hoveredProvider && hoveredProvider !== p.key ? 0.35 : 1 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: p.color, marginRight: 4, flexShrink: 0 }} />
            {p.label}
          </span>
        ))}
        <span className="barChartLegendMetric">{metaInfo?.label}</span>
      </div>

      <div className="barChartScrollWrap">
        <div className="barChartCanvas" style={{ height: `${CHART_H}px` }}>
          {data.map((row, idx) => (
            <div key={row.tool}
              className={`barChartFnCol ${idx % 2 === 0 ? "even" : ""} ${row.untested ? "untestedFnCol" : ""}`}>
              <div className="barChartFnBars">
                {PROVIDERS.map((p) => {
                  const val = row[p.key];
                  const pct = val != null ? (val / maxVal) * 100 : 0;
                  const h = Math.max((pct / 100) * CHART_H, 2);
                  const color = !hoveredProvider || hoveredProvider === p.key ? p.color : "#d0dce1";
                  return (
                    <div key={p.key} className="barChartFnBar"
                      style={{ height: val != null ? `${h}px` : "3px", background: val != null ? color : "#e8eef1" }}
                      title={`${p.label} · ${row.tool}: ${val != null ? `${val}${metaInfo?.unit || ""}` : "ni testirano"}`}
                    />
                  );
                })}
              </div>
              <div className="barChartFnName" title={row.tool}>
                <code>{row.tool}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ComparisonPage({ session, dataRefreshKey }) {
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState("");
  const [providers, setProviders] = useState(["openai", "ollama"]);
  const [showAllFlags, setShowAllFlags] = useState(true);
  const [guardFilterOn, setGuardFilterOn] = useState(false);
  const [llmFilterOn, setLlmFilterOn] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [chartMetric, setChartMetric] = useState("time");
  const [error, setError] = useState("");
  const [selectedActivity, setSelectedActivity] = useState(null);

  useEffect(() => {
    api.activityLog({ limit: 500 }, session?.token).then(setActivities).catch((err) => setError(err.message));
  }, [session?.token, dataRefreshKey]);

  function toggleProvider(p) {
    setProviders((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
  }

  async function handleAccuracy(id, body) {
    const updated = await api.setActivityAccuracy(id, body, session?.token);
    setActivities((cur) => cur.map((a) => a._id === updated._id ? updated : a));
    if (selectedActivity?._id === updated._id) setSelectedActivity(updated);
  }

  const providerStats = useMemo(() => {
    const groups = new Map();
    for (const a of activities) {
      const p = a.llmProvider || "mock";
      const cur = groups.get(p) || { provider: p, count: 0, totalMs: 0 };
      cur.count++;
      cur.totalMs += a.durationMs || 0;
      groups.set(p, cur);
    }
    return Array.from(groups.values()).map((r) => ({ ...r, avgMs: r.count ? Math.round(r.totalMs / r.count) : 0 }));
  }, [activities]);

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    return activities.filter((a) => {
      // Provider filter: "rule" entries = LocalGuard intercepted; useGuard filter = guard was ON
      const providerKey = a.llmProvider || "mock";
      const matchProv = providers.length === 0 || (
        (providers.includes(providerKey)) ||
        (providers.includes("rule") && a.useGuard === true)
      );
      const matchSearch = !query || [a.actor, a.action, a.llmProvider, a.mcpTool, a.durationMs].join(" ").toLowerCase().includes(query);
      let matchFlags = true;
      if (!showAllFlags) {
        if (guardFilterOn && llmFilterOn) matchFlags = a.useGuard === true && a.naturalResponse === true;
        else if (guardFilterOn) matchFlags = a.useGuard === true;
        else if (llmFilterOn) matchFlags = a.naturalResponse === true;
        else matchFlags = a.useGuard === false && a.naturalResponse === false;
      }
      let matchDate = true;
      if (dateFilter === "day") {
        const d = new Date(a.createdAt);
        matchDate = d.toDateString() === now.toDateString();
      } else if (dateFilter === "week") {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
        matchDate = new Date(a.createdAt) >= weekAgo;
      }
      return matchProv && matchSearch && matchFlags && matchDate;
    });
  }, [activities, providers, search, showAllFlags, guardFilterOn, llmFilterOn, dateFilter]);

  const splitView = providers.includes("openai") && providers.includes("ollama");
  const activeColumns = [
    providers.includes("ollama") && { key: "ollama", label: "Ollama" },
    providers.includes("openai") && { key: "openai", label: "OpenAI" },
  ].filter(Boolean);
  const leftActivities  = filteredActivities.filter((a) => a.llmProvider === "ollama");
  const rightActivities = filteredActivities.filter((a) => a.llmProvider === "openai");

  function ActivityRow({ activity }) {
    const qScore = activity.qualityScoreFinal ?? activity.qualityScoreAuto;
    const rScore = activity.readabilityScoreFinal ?? activity.readabilityScoreAuto;
    return (
      <div className={`entityItem comparisonRow accuracy-${activity.accurate === true ? "correct" : activity.accurate === false ? "incorrect" : "unrated"}`}
        role="button" tabIndex={0} onClick={() => setSelectedActivity(activity)} onKeyDown={(e) => e.key === "Enter" && setSelectedActivity(activity)}>
        <div className="comparisonRowMain">
          <div>
            <strong>{activity.mcpTool || activity.action}</strong>
            <span>{activity.llmProvider} · {activity.durationMs} ms</span>
            <p className="comparisonRowCmd">{activity.input?.command || activity.actor}</p>
          </div>
          <div className="comparisonRowMeta">
            <span className={`comparisonTag ${activity.naturalResponse ? "llmTag" : "llmOffTag"}`}>LLM {activity.naturalResponse ? "✓" : "✗"}</span>
            <span className={`comparisonTag ${activity.useGuard ? "guardTag" : "noGuardTag"}`}>Guard {activity.useGuard ? "✓" : "✗"}</span>
            {qScore != null && <span className="comparisonTag scoreTag" title={`Kakovost: ${qScore}/5`}>⭐{qScore}</span>}
            {rScore != null && <span className="comparisonTag scoreTag rScore" title={`Berljivost: ${rScore}/5`}>📖{rScore}</span>}
          </div>
        </div>
        <AccuracyBadge accurate={activity.accurate} />
      </div>
    );
  }

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <h1>{label("comparison")}</h1>
          <p>{label("comparisonSubtitle")}</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

      <section className="metrics compactMetrics">
        {providerStats.map((stat) => (
          <div className={`metric ${stat.provider === "openai" ? "blue" : stat.provider === "ollama" ? "amber" : ""}`} key={stat.provider}>
            <div className="metricIcon"><BarChart3 size={14} /></div>
            <span>{stat.provider}</span>
            <strong>{stat.avgMs} ms</strong>
            <p style={{fontSize:"0.65rem",color:"#72818a",marginTop:0}}>{stat.count} klicev</p>
          </div>
        ))}
      </section>

      <section className="surface pageSection">
        <div className="sectionHeader">
          <h2>{label("activityLog")}</h2>
          <span>{filteredActivities.length} / {activities.length}</span>
        </div>

        <div className="comparisonFilters">
          <label className="searchInputWrap compactSearch">
            <Search size={17} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Išči meritve..." />
          </label>
          <div className="filterGroupSeparated">
            <div className="providerToggleGroup">
              {PROVIDERS.map(({ key, label: lbl }) => (
                <button key={key} type="button"
                  className={`providerToggleBtn ${key} ${providers.includes(key) ? "active" : ""}`}
                  onClick={() => toggleProvider(key)}>
                  {lbl}
                </button>
              ))}
            </div>
            <div className="providerToggleGroup flagGroup">
              <button type="button"
                className={`providerToggleBtn flagBtn ${showAllFlags ? "active" : ""}`}
                onClick={() => { setShowAllFlags(true); setGuardFilterOn(false); setLlmFilterOn(false); }}>
                Brez
              </button>
              <button type="button"
                className={`providerToggleBtn flagBtn ${!showAllFlags && guardFilterOn ? "active" : ""}`}
                onClick={() => { setShowAllFlags(false); setGuardFilterOn((v) => !v); }}>
                LocalGuard
              </button>
              <button type="button"
                className={`providerToggleBtn flagBtn llmAnswer ${!showAllFlags && llmFilterOn ? "active" : ""}`}
                onClick={() => { setShowAllFlags(false); setLlmFilterOn((v) => !v); }}>
                LLM odgovor
              </button>
            </div>
          </div>
          <div className="viewToggleGroup">
            <button type="button" className={dateFilter === "all" ? "selected" : ""} onClick={() => setDateFilter("all")}>Vse</button>
            <button type="button" className={dateFilter === "week" ? "selected" : ""} onClick={() => setDateFilter("week")}>Teden</button>
            <button type="button" className={dateFilter === "day" ? "selected" : ""} onClick={() => setDateFilter("day")}>Dan</button>
          </div>
          <div className="viewToggleGroup">
            <button type="button" className={viewMode === "list" ? "selected" : ""} onClick={() => setViewMode("list")} title="Seznam"><List size={16} /></button>
            <button type="button" className={viewMode === "table" ? "selected" : ""} onClick={() => setViewMode("table")} title="Tabela"><Table2 size={16} /></button>
            <button type="button" className={viewMode === "chart" ? "selected" : ""} onClick={() => setViewMode("chart")} title="Graf"><BarChart3 size={16} /></button>
          </div>
        </div>

        {viewMode === "table" && (
          <StatsTable activities={filteredActivities} activeProviders={providers} />
        )}
        {viewMode === "chart" && (
          <>
            <div className="chartMetricRow">
              <span className="chartMetricLabel">Metrika:</span>
              {CHART_METRICS.map((m) => (
                <button key={m.key} type="button"
                  className={`chartMetricBtn ${chartMetric === m.key ? "selected" : ""}`}
                  onClick={() => setChartMetric(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
            <BarChartView activities={filteredActivities} providers={providers} metric={chartMetric} />
          </>
        )}
        {viewMode === "list" && (
          activeColumns.length > 1 ? (
            <div className="comparisonSplitView" style={{ gridTemplateColumns: `repeat(${activeColumns.length}, 1fr)` }}>
              {activeColumns.map((col) => {
                const colActivities = filteredActivities.filter((a) => (a.llmProvider || "mock") === col.key);
                return (
                  <div className="comparisonColumn" key={col.key}>
                    <div className="comparisonColumnHeader">{col.label} <span>({colActivities.length})</span></div>
                    <div className="entityList">{colActivities.map((a) => <ActivityRow key={a._id} activity={a} />)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="entityList">
              {filteredActivities.map((a) => <ActivityRow key={a._id} activity={a} />)}
              {filteredActivities.length === 0 && <EmptyState label={label("noResults")} />}
            </div>
          )
        )}
      </section>

      {selectedActivity && (
        <ActivityDetail
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onAccuracy={handleAccuracy}
          token={session?.token}
        />
      )}
    </main>
  );
}

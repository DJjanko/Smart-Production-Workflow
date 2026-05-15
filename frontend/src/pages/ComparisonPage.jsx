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

  async function save(accurate) {
    setSaving(true);
    await onAccuracy(activity._id, { accurate, accuracyNote: note });
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
            <button type="button" className="primary" onClick={() => save(activity.accurate)} disabled={saving} style={{marginTop:4}}>Shrani opombo</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsTable({ activities }) {
  const stats = useMemo(() => {
    const map = new Map();
    for (const a of activities) {
      const tool = a.mcpTool || a.action;
      const prov = a.llmProvider || "mock";
      const key = `${tool}__${prov}`;
      const cur = map.get(key) || { tool, provider: prov, count: 0, totalMs: 0, correct: 0, incorrect: 0, unrated: 0 };
      cur.count++;
      cur.totalMs += a.durationMs || 0;
      if (a.accurate === true) cur.correct++;
      else if (a.accurate === false) cur.incorrect++;
      else cur.unrated++;
      map.set(key, cur);
    }
    const testedRows = Array.from(map.values()).map((r) => ({
      ...r,
      avgMs: Math.round(r.totalMs / r.count),
      accuracy: r.count - r.unrated > 0 ? Math.round((r.correct / (r.count - r.unrated)) * 100) : null,
      untested: false
    }));
    const testedTools = new Set(testedRows.map((r) => r.tool));
    const untestedRows = ALL_MCP_TOOLS
      .filter((t) => !testedTools.has(t))
      .map((t) => ({ tool: t, provider: "—", count: 0, avgMs: null, correct: 0, incorrect: 0, unrated: 0, accuracy: null, untested: true }));
    return [...testedRows, ...untestedRows].sort((a, b) => a.tool.localeCompare(b.tool));
  }, [activities]);

  return (
    <div className="statsTableWrap">
      <table className="statsTable">
        <thead>
          <tr>
            <th>MCP funkcija</th>
            <th>Provider</th>
            <th>N</th>
            <th>Povp. ms</th>
            <th>✓</th>
            <th>✗</th>
            <th>Točnost</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((row) => (
            <tr key={`${row.tool}-${row.provider}`} className={row.untested ? "untestedRow" : ""}>
              <td><code>{row.tool}</code></td>
              <td>{row.untested ? <span className="untestedChip">ni testirano</span> : <span className={`providerChip ${row.provider}`}>{row.provider}</span>}</td>
              <td>{row.untested ? "/" : row.count}</td>
              <td>{row.untested ? "/" : `${row.avgMs} ms`}</td>
              <td className="correct">{row.untested ? "/" : (row.correct || "—")}</td>
              <td className="incorrect">{row.untested ? "/" : (row.incorrect || "—")}</td>
              <td>{row.untested ? "/" : (row.accuracy !== null ? `${row.accuracy}%` : "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarChartView({ activities, providers: activeProviders }) {
  const data = useMemo(() => {
    const byTool = new Map();
    for (const a of activities) {
      const tool = a.mcpTool || a.action;
      const prov = a.llmProvider || "mock";
      if (!byTool.has(tool)) byTool.set(tool, {});
      const provMap = byTool.get(tool);
      provMap[prov] = provMap[prov] || { count: 0, totalMs: 0 };
      provMap[prov].count++;
      provMap[prov].totalMs += a.durationMs || 0;
    }
    return ALL_MCP_TOOLS.slice().sort().map((tool) => {
      const provMap = byTool.get(tool) || {};
      const openai = provMap.openai ? Math.round(provMap.openai.totalMs / provMap.openai.count) : null;
      const ollama = provMap.ollama ? Math.round(provMap.ollama.totalMs / provMap.ollama.count) : null;
      const rule   = provMap.rule   ? Math.round(provMap.rule.totalMs   / provMap.rule.count)   : null;
      return { tool, openai, ollama, rule, untested: openai === null && ollama === null && rule === null };
    });
  }, [activities]);

  const maxMs = Math.max(...data.flatMap((d) => [d.openai ?? 0, d.ollama ?? 0, d.rule ?? 0]), 1);

  return (
    <div className="barChartView">
      {data.map((row, idx) => (
        <div key={row.tool} className={`barChartGroup ${idx % 2 === 0 ? "even" : ""} ${row.untested ? "untestedGroup" : ""}`}>
          <div className="barChartGroupLabel"><code>{row.tool}</code>{row.untested && <span className="untestedChip">ni testirano</span>}</div>
          {[
            { key: "openai", label: "OpenAI", color: "#1a8fc1" },
            { key: "ollama", label: "Ollama",  color: "#d4850a" },
            { key: "rule",   label: "Guard",   color: "#1f7b52" }
          ].filter((p) => (!activeProviders || activeProviders.includes(p.key))).map((p) => (
            <div key={p.key} className="barChartRow">
              <span className="barChartProvLabel" style={{ color: row.untested ? "#c8d2d7" : p.color }}>{p.label}</span>
              <div className="barChartTrack">
                {!row.untested && row[p.key] !== null && (
                  <div className="barChartBar" style={{ width: `${(row[p.key] / maxMs) * 100}%`, background: p.color }} />
                )}
              </div>
              <span className="barChartValue" style={{ color: row.untested ? "#c8d2d7" : undefined }}>
                {row.untested ? "/" : row[p.key] !== null ? `${row[p.key]} ms` : "—"}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ComparisonPage({ session, dataRefreshKey }) {
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState("");
  const [providers, setProviders] = useState(["openai", "ollama", "rule"]);
  const [onlyLlmAnswer, setOnlyLlmAnswer] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list");
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
      const matchLlm = !onlyLlmAnswer || a.naturalResponse === true || a.action === "llm_natural_response" || a.output?.naturalText;
      let matchDate = true;
      if (dateFilter === "day") {
        const d = new Date(a.createdAt);
        matchDate = d.toDateString() === now.toDateString();
      } else if (dateFilter === "week") {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
        matchDate = new Date(a.createdAt) >= weekAgo;
      }
      return matchProv && matchSearch && matchLlm && matchDate;
    });
  }, [activities, providers, search, onlyLlmAnswer, dateFilter]);

  const splitView = providers.includes("openai") && providers.includes("ollama");
  const activeColumns = [
    providers.includes("ollama") && { key: "ollama", label: "Ollama" },
    providers.includes("openai") && { key: "openai", label: "OpenAI" },
  ].filter(Boolean);
  const leftActivities  = filteredActivities.filter((a) => a.llmProvider === "ollama");
  const rightActivities = filteredActivities.filter((a) => a.llmProvider === "openai");

  function ActivityRow({ activity }) {
    return (
      <div className={`entityItem comparisonRow accuracy-${activity.accurate === true ? "correct" : activity.accurate === false ? "incorrect" : "unrated"}`}
        role="button" tabIndex={0} onClick={() => setSelectedActivity(activity)} onKeyDown={(e) => e.key === "Enter" && setSelectedActivity(activity)}>
        <div>
          <strong>{activity.mcpTool || activity.action}</strong>
          <span>{activity.llmProvider} / {activity.durationMs} ms</span>
          <p>{activity.input?.command || activity.actor}</p>
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

      <section className="metrics">
        {providerStats.map((stat) => (
          <div className={`metric ${stat.provider === "openai" ? "blue" : stat.provider === "ollama" ? "amber" : ""}`} key={stat.provider}>
            <div className="metricIcon"><BarChart3 size={20} /></div>
            <span>{stat.provider}</span>
            <strong>{stat.avgMs} ms</strong>
            <p style={{fontSize:"0.75rem",color:"#72818a",marginTop:2}}>{stat.count} klicev</p>
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
          <div className="providerToggleGroup">
            {PROVIDERS.map(({ key, label: lbl }) => (
              <button key={key} type="button"
                className={`providerToggleBtn ${key} ${providers.includes(key) ? "active" : ""}`}
                onClick={() => toggleProvider(key)}>
                {lbl}
              </button>
            ))}
            <button type="button"
              className={`providerToggleBtn llmAnswer ${onlyLlmAnswer ? "active" : ""}`}
              onClick={() => setOnlyLlmAnswer((v) => !v)}
              title="Prikaži samo klice z LLM odgovorom">
              LLM odgovor
            </button>
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
          activeColumns.length > 1 ? (
            <div className="comparisonSplitView" style={{ gridTemplateColumns: `repeat(${activeColumns.length}, 1fr)` }}>
              {activeColumns.map((col) => {
                const colActivities = filteredActivities.filter((a) => (a.llmProvider || "mock") === col.key);
                return (
                  <div className="comparisonColumn" key={col.key}>
                    <div className="comparisonColumnHeader">{col.label} <span>({colActivities.length})</span></div>
                    <StatsTable activities={colActivities} />
                  </div>
                );
              })}
            </div>
          ) : <StatsTable activities={filteredActivities} />
        )}
        {viewMode === "chart" && (
          activeColumns.length > 1 ? (
            <div className="comparisonSplitView" style={{ gridTemplateColumns: `repeat(${activeColumns.length}, 1fr)` }}>
              {activeColumns.map((col) => (
                <div className="comparisonColumn" key={col.key}>
                  <div className="comparisonColumnHeader">{col.label}</div>
                  <BarChartView activities={filteredActivities.filter((a) => (a.llmProvider || "mock") === col.key)} providers={[col.key]} />
                </div>
              ))}
            </div>
          ) : <BarChartView activities={filteredActivities} providers={providers} />
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

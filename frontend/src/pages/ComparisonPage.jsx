import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Gauge, Search } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { label } from "../utils/i18n.js";

export function ComparisonPage() {
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    api.activityLog().then(setActivities).catch((err) => setError(err.message));
  }, []);

  const providerStats = useMemo(() => {
    const groups = new Map();
    for (const activity of activities) {
      const key = activity.llmProvider || "mock";
      const current = groups.get(key) || { provider: key, count: 0, totalMs: 0 };
      current.count += 1;
      current.totalMs += activity.durationMs || 0;
      groups.set(key, current);
    }
    return Array.from(groups.values()).map((item) => ({
      ...item,
      avgMs: item.count ? Math.round(item.totalMs / item.count) : 0
    }));
  }, [activities]);

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activities.filter((activity) => {
      const matchesProvider = provider === "all" || activity.llmProvider === provider;
      const matchesSearch = !query || [
        activity.actor,
        activity.action,
        activity.llmProvider,
        activity.mcpTool,
        activity.durationMs
      ].join(" ").toLowerCase().includes(query);

      return matchesProvider && matchesSearch;
    });
  }, [activities, provider, search]);

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
          <div className="metric blue" key={stat.provider}>
            <div className="metricIcon"><Gauge /></div>
            <span>{stat.provider}</span>
            <strong>{stat.avgMs} ms</strong>
          </div>
        ))}
      </section>

      <section className="surface pageSection">
        <div className="sectionHeader"><h2>{label("activityLog")}</h2><span>{filteredActivities.length} / {activities.length}</span></div>
        <div className="comparisonFilters">
          <label>
            {label("searchMeasurements")}
            <span className="searchInputWrap">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={label("searchMeasurements")} />
            </span>
          </label>
          <label>
            {label("provider")}
            <select value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="all">{label("all")}</option>
              <option value="mock">mock</option>
              <option value="openai">openai</option>
              <option value="ollama">ollama</option>
            </select>
          </label>
        </div>
        <div className="entityList">
          {filteredActivities.map((activity) => (
            <div className="entityItem" key={activity._id}>
              <div>
                <strong>{activity.mcpTool || activity.action}</strong>
                <span>{activity.llmProvider} / {activity.durationMs} ms</span>
                <p>{activity.actor}</p>
              </div>
            </div>
          ))}
          {filteredActivities.length === 0 && <EmptyState label={label("noResults")} />}
        </div>
      </section>
    </main>
  );
}

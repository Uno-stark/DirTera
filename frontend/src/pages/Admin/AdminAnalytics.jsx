import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  CalendarDays, RotateCcw, TrendingUp, AlertCircle,
  BarChart2, LineChart as LineChartIcon, Search, X,
  ArrowUpDown, ArrowDown, ArrowUp,
} from "lucide-react";
import { fetchAllWebsitesForAnalytics, fetchBulkStats, keys } from "../../api/queries";

/* ── Date preset helpers ─────────────────────────────────────────────────── */
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: "All time", value: "all" },
  { label: "Today",    value: "today" },
  { label: "7 days",   value: "7d" },
  { label: "30 days",  value: "30d" },
  { label: "90 days",  value: "90d" },
  { label: "Custom",   value: "custom" },
];

function presetToDates(preset) {
  const now = new Date();
  const today = isoDate(now);
  switch (preset) {
    case "today": return { start: today, end: today };
    case "7d": {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { start: isoDate(d), end: today };
    }
    case "30d": {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      return { start: isoDate(d), end: today };
    }
    case "90d": {
      const d = new Date(now); d.setDate(d.getDate() - 89);
      return { start: isoDate(d), end: today };
    }
    default: return { start: "", end: "" };  // "all" and "custom"
  }
}
function BarTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "white", border: "1px solid #e4e7ec", borderRadius: 8,
      padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,.08)", fontSize: 13,
    }}>
      <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#111827" }}>{d.name}</p>
      <p style={{ margin: 0, color: "#6366f1" }}>
        {d.clicks.toLocaleString()} click{d.clicks !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

/* ── Custom line tooltip ─────────────────────────────────────────────────── */
function LineTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "white", border: "1px solid #e4e7ec", borderRadius: 8,
      padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,.08)", fontSize: 13,
    }}>
      <p style={{ margin: "0 0 6px", fontWeight: 600, color: "#111827" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ margin: "2px 0", color: p.color }}>
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

/* ── Skeleton chart ──────────────────────────────────────────────────────── */
function SkeletonChart() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 220, padding: "0 16px" }}>
      {[60, 90, 50, 130, 80, 110, 70, 95, 55, 120, 85, 100].map((h, i) => (
        <div key={i} className="skeleton" style={{ flex: 1, height: `${h}px`, borderRadius: 4 }} />
      ))}
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub }) {
  return (
    <div className="admin-stat-card">
      <p className="admin-stat-label">{label}</p>
      <p className="admin-stat-value" style={{ fontSize: 22 }}>{value}</p>
      {sub && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#9ca3af" }}>{sub}</p>}
    </div>
  );
}

/* ── Sort icon ───────────────────────────────────────────────────────────── */
function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ArrowUpDown size={11} style={{ opacity: 0.3 }} />;
  return sortDir === "desc"
    ? <ArrowDown size={11} style={{ color: "#6366f1" }} />
    : <ArrowUp   size={11} style={{ color: "#6366f1" }} />;
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
function AdminAnalytics() {
  const [preset,    setPreset]    = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [chartMode, setChartMode] = useState("bar");   // "bar" | "line"
  const [siteSearch, setSiteSearch] = useState("");
  const [sortField,  setSortField]  = useState("clicks");  // "name" | "clicks"
  const [sortDir,    setSortDir]    = useState("desc");    // "asc" | "desc"
  const [topN,       setTopN]       = useState(20);

  /* Active date range sent to API — undefined means "omit the param entirely" */
  const activeDates = useMemo(() => {
    if (preset === "custom") {
      return {
        start: startDate || undefined,
        end:   endDate   || undefined,
      };
    }
    const { start, end } = presetToDates(preset);
    return {
      start: start || undefined,
      end:   end   || undefined,
    };
  }, [preset, startDate, endDate]);

  /* Fetch ALL websites (paginates through up to 100-per-page automatically) */
  const {
    data: websites = [],
    isLoading: loadingWebsites,
    isError: websiteError,
  } = useQuery({
    queryKey: ["admin", "all-websites-for-analytics"],
    queryFn:  fetchAllWebsitesForAnalytics,
    staleTime: 5 * 60_000,
  });

  const websiteIds = useMemo(() => websites.map((s) => s.id), [websites]);

  /* Fetch bulk stats — only send date params when they are actual values */
  const { data: statsMap, isLoading: loadingStats } = useQuery({
    queryKey: keys.analyticsBulk({
      ids:   websiteIds,
      start: activeDates.start,
      end:   activeDates.end,
    }),
    queryFn: () => fetchBulkStats({
      websiteIds,
      startDate: activeDates.start,
      endDate:   activeDates.end,
    }),
    enabled:   websiteIds.length > 0,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const isLoading = loadingWebsites || (websiteIds.length > 0 && loadingStats);

  /* Full sorted + filtered dataset */
  const allData = useMemo(() => {
    if (!statsMap || !websites.length) return [];
    return websites.map((s) => ({
      id:     s.id,
      name:   s.name,
      url:    s.url,
      clicks: statsMap[s.id] ?? 0,
    }));
  }, [statsMap, websites]);

  /* Site-search filtered */
  const filteredData = useMemo(() => {
    const q = siteSearch.trim().toLowerCase();
    return q ? allData.filter((d) => d.name.toLowerCase().includes(q)) : allData;
  }, [allData, siteSearch]);

  /* Sorted table data */
  const sortedData = useMemo(() => {
    const copy = [...filteredData];
    copy.sort((a, b) => {
      const dir = sortDir === "desc" ? -1 : 1;
      if (sortField === "name") return dir * a.name.localeCompare(b.name);
      return dir * (a.clicks - b.clicks);
    });
    return copy;
  }, [filteredData, sortField, sortDir]);

  /* Chart data (top-N by clicks, always sorted desc for visual clarity) */
  const chartData = useMemo(() => {
    return [...filteredData]
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, topN);
  }, [filteredData, topN]);

  /* Summary stats */
  const totalClicks = useMemo(() => filteredData.reduce((s, d) => s + d.clicks, 0), [filteredData]);
  const topSite     = chartData[0];
  const avgClicks   = filteredData.length ? Math.round(totalClicks / filteredData.length) : 0;
  const withClicks  = filteredData.filter((d) => d.clicks > 0).length;

  /* Sort toggler */
  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => d === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  /* Preset selector */
  const handlePreset = (val) => {
    setPreset(val);
    if (val !== "custom") {
      setStartDate("");
      setEndDate("");
    }
  };

  const isFiltered = preset !== "all" || (preset === "custom" && (startDate || endDate));

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Analytics</h1>
          <p className="admin-subtitle">Click traffic across the platform.</p>
        </div>
      </div>

      {websiteError && (
        <div className="admin-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={14} /> Failed to load analytics.
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Preset pills */}
          <div className="admin-filter-pills">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                className={`admin-pill${preset === p.value ? " active" : ""}`}
                onClick={() => handlePreset(p.value)}
              >
                {p.label}
              </button>
            ))}
            {isFiltered && preset !== "custom" && (
              <button
                className="admin-button-outline"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => handlePreset("all")}
              >
                <RotateCcw size={11} /> Reset
              </button>
            )}
          </div>

          {/* Custom date inputs */}
          {preset === "custom" && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
              <div className="admin-field" style={{ maxWidth: 160 }}>
                <label>
                  <CalendarDays size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  Start date
                </label>
                <input
                  type="date"
                  className="admin-input"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="admin-field" style={{ maxWidth: 160 }}>
                <label>
                  <CalendarDays size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  End date
                </label>
                <input
                  type="date"
                  className="admin-input"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              {(startDate || endDate) && (
                <button
                  className="admin-button-outline"
                  style={{ padding: "8px 12px", fontSize: 12 }}
                  onClick={() => { setStartDate(""); setEndDate(""); }}
                >
                  <RotateCcw size={11} /> Clear dates
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Summary stats ── */}
      {!isLoading && allData.length > 0 && (
        <div className="admin-stat-grid" style={{ marginBottom: 16 }}>
          <StatCard
            label="Total clicks"
            value={totalClicks.toLocaleString()}
            sub={isFiltered ? "in selected range" : "all time"}
          />
          <StatCard
            label="Top site"
            value={topSite?.name ?? "—"}
            sub={topSite ? `${topSite.clicks.toLocaleString()} clicks` : undefined}
          />
          <StatCard
            label="Avg / site"
            value={avgClicks.toLocaleString()}
            sub={`across ${filteredData.length} sites`}
          />
          <StatCard
            label="Active sites"
            value={withClicks.toLocaleString()}
            sub={`of ${filteredData.length} have clicks`}
          />
        </div>
      )}

      {/* ── Chart card ── */}
      <div className="admin-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <TrendingUp size={15} color="#6366f1" />
          <h2 className="admin-card-title" style={{ margin: 0, flex: 1 }}>
            Top {topN} sites by clicks
            {isFiltered && (
              <span style={{ fontWeight: 400, fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>
                (filtered)
              </span>
            )}
          </h2>

          {/* Chart mode toggle */}
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className={`admin-pill${chartMode === "bar" ? " active" : ""}`}
              onClick={() => setChartMode("bar")}
              title="Bar chart"
            >
              <BarChart2 size={12} />
            </button>
            <button
              className={`admin-pill${chartMode === "line" ? " active" : ""}`}
              onClick={() => setChartMode("line")}
              title="Line chart"
            >
              <LineChartIcon size={12} />
            </button>
          </div>

          {/* Top-N selector */}
          <select
            className="admin-select"
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>Top {n}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <SkeletonChart />
        ) : chartData.length === 0 ? (
          <p className="admin-empty">No click data available.</p>
        ) : chartMode === "bar" ? (
          <div className="admin-chart-wrap" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 16, left: 0, bottom: 64 }}
                barSize={Math.max(8, Math.floor(360 / chartData.length))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                />
                <Tooltip content={<BarTip />} cursor={{ fill: "#f5f5ff" }} />
                <Bar dataKey="clicks" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? "#6366f1" : i < 3 ? "#818cf8" : "#c7d2fe"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Line chart — rank positions on X, click count on Y */
          <div className="admin-chart-wrap" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData.map((d, i) => ({ ...d, rank: `#${i + 1}` }))}
                margin={{ top: 4, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="rank"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                />
                <Tooltip content={<LineTip />} cursor={{ stroke: "#e5e7eb" }} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={() => "Clicks"}
                />
                <Line
                  type="monotone"
                  dataKey="clicks"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#6366f1" }}
                  activeDot={{ r: 5 }}
                  name="Clicks"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Full sortable table ── */}
      <div className="admin-card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <h2 className="admin-card-title" style={{ margin: 0, flex: 1 }}>
            All sites
            {filteredData.length !== allData.length && (
              <span style={{ fontWeight: 400, fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>
                ({filteredData.length} of {allData.length})
              </span>
            )}
          </h2>

          {/* Site search */}
          <div className="admin-search-wrap" style={{ maxWidth: 240 }}>
            <Search size={13} className="admin-search-icon" />
            <input
              type="search"
              className="admin-search"
              placeholder="Filter sites…"
              value={siteSearch}
              onChange={(e) => setSiteSearch(e.target.value)}
            />
            {siteSearch && (
              <button
                className="admin-search-clear"
                onClick={() => setSiteSearch("")}
                aria-label="Clear filter"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: "16px 0" }}>
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 14, marginBottom: 12, width: `${60 + i * 6}%` }} />
            ))}
          </div>
        ) : sortedData.length === 0 ? (
          <p className="admin-empty">
            {siteSearch ? `No sites match "${siteSearch}".` : "No data."}
          </p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>
                    <button
                      style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: "inherit", fontWeight: "inherit", color: "inherit", textTransform: "inherit", letterSpacing: "inherit", padding: 0 }}
                      onClick={() => toggleSort("name")}
                    >
                      Site <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                    </button>
                  </th>
                  <th style={{ textAlign: "right" }}>
                    <button
                      style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: "inherit", fontWeight: "inherit", color: "inherit", textTransform: "inherit", letterSpacing: "inherit", padding: 0, marginLeft: "auto" }}
                      onClick={() => toggleSort("clicks")}
                    >
                      Clicks <SortIcon field="clicks" sortField={sortField} sortDir={sortDir} />
                    </button>
                  </th>
                  <th style={{ textAlign: "right", width: 100 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((s, i) => {
                  const pct = totalClicks > 0
                    ? ((s.clicks / totalClicks) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <tr key={s.id}>
                      <td style={{ color: "#9ca3af", fontSize: 12 }}>{i + 1}</td>
                      <td>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-link"
                        >
                          {s.name}
                        </a>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "#111827" }}>
                        {loadingStats
                          ? <span className="skeleton skeleton-cell" style={{ width: 50, display: "inline-block" }} />
                          : s.clicks.toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                          <div style={{
                            height: 4, width: 60, borderRadius: 999, background: "#f0f0f0", overflow: "hidden",
                          }}>
                            <div style={{
                              height: "100%",
                              width: `${Math.min(100, parseFloat(pct))}%`,
                              background: "#6366f1",
                              borderRadius: 999,
                            }} />
                          </div>
                          <span style={{ fontSize: 11.5, color: "#9ca3af", minWidth: 36, textAlign: "right" }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminAnalytics;

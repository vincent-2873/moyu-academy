"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Candidate = { email: string; name: string; brand: string | null; latest_date: string; record_count: number; exists: boolean };
type Skipped = { email: string; name: string; brand: string | null; latest_date: string; record_count: number; filtered_reason?: string };
type Data = {
  ok: boolean;
  total_distinct: number;
  candidates: Candidate[];
  skipped: Skipped[];
  summary: { already_exists: number; new_to_create: number; filtered_count: number; filter_reason: string };
};

type Health = {
  ok: boolean;
  sales_metrics_daily: { total_rows: number; latest_date: string; earliest_date: string; distinct_users: number; xunlian_filtered: number; days_behind_today: number | null; health: "healthy" | "warning" | "critical" };
  by_brand: { brand: string; rows: number; latest: string }[];
  users_table: { total: number; active: number };
  cross_check: { metabase_distinct_emails: number; users_table_emails: number; missing_in_users: number; missing_examples: string[] };
  recent_sync_runs: any[];
  schedule: { label: string; cron: string[]; timezone_window: string; runs_per_day: number };
};

const healthColor = (h: string) => h === "healthy" ? "var(--gold-thread, #c9a96e)" : h === "warning" ? "#d97706" : "var(--accent-red, #b91c1c)";

export default function EmployeesFromMetabaseTab() {
  const [data, setData] = useState<Data | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [hideSkipped, setHideSkipped] = useState(true);

  async function refresh() {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      fetch("/api/admin/employees/from-metabase").then(r => r.json()),
      fetch("/api/admin/metabase/health").then(r => r.json()),
    ]);
    setData(r1);
    setHealth(r2);
    // 預選所有 new
    if (r1?.candidates) {
      setSelected(new Set(r1.candidates.filter((c: Candidate) => !c.exists).map((c: Candidate) => c.email)));
    }
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  function toggle(email: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(email)) n.delete(email); else n.add(email);
      return n;
    });
  }

  function selectAll(filteredCands: Candidate[]) {
    setSelected(new Set(filteredCands.filter(c => !c.exists).map(c => c.email)));
  }

  function deselectAll() { setSelected(new Set()); }

  async function batchCreate() {
    if (selected.size === 0) return;
    if (!confirm(`建立 ${selected.size} 個員工帳號?預設密碼 0000 / role staff / stage intermediate / stage_path business`)) return;
    setWorking(true);
    setResult(null);
    const r = await fetch("/api/admin/employees/from-metabase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: Array.from(selected) }),
    });
    const j = await r.json();
    setResult(j);
    setWorking(false);
    if (j.ok) { setSelected(new Set()); refresh(); }
  }

  async function triggerSync() {
    setWorking(true);
    setResult(null);
    const r = await fetch("/api/admin/cron-config", { method: "GET" }); // ignore actual; just an alibi for spinner
    // 實際觸發 GitHub Actions
    try {
      // 沒有 server-side 觸發 GH Actions 的 endpoint,顯示 hint
      setResult({ note: "請在本機執行: gh workflow run \"Metabase Daily Sync\" --ref main" });
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "var(--ink-mid)", fontSize: 13 }}>掃描 Metabase 資料中…</div>;
  if (!data || !health) return <div style={{ padding: 48 }}>載入失敗</div>;

  const filteredCands = data.candidates.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.email.toLowerCase().includes(s) || (c.name || "").toLowerCase().includes(s) || (c.brand || "").toLowerCase().includes(s);
  });

  return (
    <div style={{ padding: "8px 0 48px", background: "var(--bg-paper, #f7f1e3)" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={labelStyle}>真實員工 EMPLOYEES</div>
        <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", letterSpacing: 4, marginTop: 6 }}>從 Metabase 同步真實員工</div>
        <div style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 6 }}>掃 sales_metrics_daily distinct user_email · 過濾「新訓-」前綴 · 一鍵建 user account</div>
      </div>

      {/* Metabase health */}
      <div style={{ ...cardOuterStyle, marginBottom: 20, borderLeft: `4px solid ${healthColor(health.sales_metrics_daily.health)}` }}>
        <div style={labelStyle}>Metabase 同步健康度</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginTop: 12 }}>
          <Stat label="sales_metrics_daily" value={health.sales_metrics_daily.total_rows.toLocaleString() + " rows"} />
          <Stat label="最新資料日" value={health.sales_metrics_daily.latest_date || "—"} color={healthColor(health.sales_metrics_daily.health)} />
          <Stat label="落後今天" value={(health.sales_metrics_daily.days_behind_today ?? "—") + " 天"} />
          <Stat label="distinct 員工" value={health.sales_metrics_daily.distinct_users.toString()} />
          <Stat label="新訓- 過濾" value={health.sales_metrics_daily.xunlian_filtered.toString()} />
        </div>
        <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--bg-paper)", borderRadius: 4 }}>
          <div style={{ fontSize: 11, color: "var(--ink-mid)", marginBottom: 4, fontFamily: "var(--font-jetbrains-mono)" }}>
            自動 sync 排程: <strong style={{ color: "var(--ink-deep)" }}>{health.schedule.label}</strong> · {health.schedule.timezone_window} · {health.schedule.runs_per_day} 次/天
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)" }}>
            cron: {health.schedule.cron.join(" + ")}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={labelStyle}>各品牌 rows</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 8 }}>
            {health.by_brand.map((b) => (
              <div key={b.brand} style={{ padding: "8px 10px", background: "var(--bg-paper)", borderRadius: 4, fontSize: 11 }}>
                <div style={{ color: "var(--ink-deep)", fontFamily: "var(--font-noto-serif-tc)" }}>{b.brand}</div>
                <div style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--ink-mid)" }}>
                  {b.rows.toLocaleString()} rows · {b.latest}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(217,119,6,0.06)", borderRadius: 4 }}>
          <div style={{ fontSize: 11, color: "var(--ink-deep)", marginBottom: 4 }}>
            <strong>對齊:</strong> Metabase 有 <strong>{health.cross_check.metabase_distinct_emails}</strong> distinct emails,
            users 表已存 <strong>{health.cross_check.users_table_emails}</strong>,
            待建立 <strong style={{ color: "var(--accent-red)" }}>{health.cross_check.missing_in_users}</strong> 人
          </div>
          {health.cross_check.missing_examples.length > 0 && (
            <div style={{ fontSize: 10, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)" }}>
              缺例: {health.cross_check.missing_examples.join(", ")}{health.cross_check.missing_in_users > 10 ? "..." : ""}
            </div>
          )}
        </div>
      </div>

      {/* candidates list */}
      <div style={cardOuterStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={labelStyle}>同步候選人 · {filteredCands.length} (共 {data.total_distinct})</div>
            <div style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 4 }}>
              ✓ 已存 {data.summary.already_exists} · ⊕ 待建立 {data.summary.new_to_create} · ⊘ 過濾 {data.summary.filtered_count}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜 email/姓名/品牌"
              style={{ padding: "6px 10px", borderRadius: 4, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", fontSize: 12, minWidth: 180 }} />
            <button onClick={() => selectAll(filteredCands)} style={btnSmall}>全選 new</button>
            <button onClick={deselectAll} style={btnSmall}>清空</button>
            <motion.button whileHover={{ scale: selected.size > 0 ? 1.03 : 1 }} whileTap={{ scale: selected.size > 0 ? 0.97 : 1 }}
              onClick={batchCreate} disabled={working || selected.size === 0}
              style={{ ...btnPrimary, opacity: working || selected.size === 0 ? 0.4 : 1 }}>
              {working ? "建立中…" : `📥 一鍵建立 ${selected.size} 人`}
            </motion.button>
          </div>
        </div>

        <div style={{ maxHeight: 480, overflowY: "auto", border: "1px solid var(--border-soft, rgba(26,26,26,0.06))", borderRadius: 4 }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, background: "var(--bg-elev, rgba(247,241,227,0.95))" }}>
              <tr>
                <th style={th}>選</th>
                <th style={th}>email</th>
                <th style={th}>姓名</th>
                <th style={th}>品牌</th>
                <th style={th}>最新資料</th>
                <th style={th}>筆數</th>
                <th style={th}>狀態</th>
              </tr>
            </thead>
            <tbody>
              {filteredCands.map((c) => (
                <tr key={c.email} style={{ borderTop: "1px solid var(--border-soft, rgba(26,26,26,0.04))" }}>
                  <td style={td}>
                    <input type="checkbox" checked={selected.has(c.email)} onChange={() => toggle(c.email)} disabled={c.exists} />
                  </td>
                  <td style={{ ...td, fontFamily: "var(--font-jetbrains-mono)" }}>{c.email}</td>
                  <td style={td}>{c.name}</td>
                  <td style={{ ...td, fontFamily: "var(--font-jetbrains-mono)", color: "var(--ink-mid)" }}>{c.brand || "—"}</td>
                  <td style={{ ...td, fontFamily: "var(--font-jetbrains-mono)", color: "var(--ink-mid)" }}>{c.latest_date}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "var(--font-jetbrains-mono)" }}>{c.record_count}</td>
                  <td style={td}>
                    {c.exists ? <span style={{ color: "var(--gold-thread, #c9a96e)" }}>✓ 已存</span>
                      : <span style={{ color: "var(--accent-red)" }}>⊕ 待建</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 過濾掉的清單(展開) */}
        {data.skipped.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setHideSkipped(!hideSkipped)} style={{ ...btnSmall, marginBottom: 8 }}>
              {hideSkipped ? "▶" : "▼"} 過濾名單 · {data.skipped.length} ({data.summary.filter_reason})
            </button>
            {!hideSkipped && (
              <div style={{ maxHeight: 240, overflowY: "auto", padding: 8, background: "rgba(26,26,26,0.03)", borderRadius: 4 }}>
                {data.skipped.map((s) => (
                  <div key={s.email} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr 100px", gap: 8, padding: "6px 8px", fontSize: 11, fontFamily: "var(--font-jetbrains-mono)", color: "var(--ink-mid)", borderBottom: "1px dashed rgba(26,26,26,0.04)" }}>
                    <span>{s.email}</span>
                    <span>{s.name}</span>
                    <span>{s.brand || "—"}</span>
                    <span style={{ color: "var(--accent-red)" }}>{s.filtered_reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ marginTop: 16, padding: 16, background: result.ok ? "rgba(201,169,110,0.08)" : "rgba(185,28,28,0.08)", borderLeft: `3px solid ${result.ok ? "var(--gold-thread, #c9a96e)" : "var(--accent-red)"}`, borderRadius: 4 }}>
            <div style={{ fontSize: 13, color: "var(--ink-deep)", fontFamily: "var(--font-noto-serif-tc)", marginBottom: 4 }}>
              {result.ok ? `✓ 已建立 ${result.inserted} 人` : `× 失敗: ${result.error}`}
            </div>
            {result.note && <div style={{ fontSize: 11, color: "var(--ink-mid)" }}>{result.note}</div>}
            {result.skipped && result.skipped.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 11, color: "var(--ink-mid)", cursor: "pointer" }}>跳過 {result.skipped.length}</summary>
                <div style={{ fontSize: 10, fontFamily: "var(--font-jetbrains-mono)", marginTop: 4, color: "var(--ink-mid)" }}>
                  {result.skipped.map((s: any) => (
                    <div key={s.email}>{s.email} — {s.reason}</div>
                  ))}
                </div>
              </details>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 18, color: color || "var(--ink-deep)", marginTop: 4, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-mid)", letterSpacing: 3, fontWeight: 600, textTransform: "uppercase" };
const cardOuterStyle: React.CSSProperties = { background: "var(--bg-elev, rgba(247,241,227,0.85))", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, padding: "20px 24px" };
const btnPrimary: React.CSSProperties = { padding: "8px 16px", borderRadius: 4, background: "var(--ink-deep)", color: "var(--bg-paper)", fontSize: 12, fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 3, border: "none", cursor: "pointer" };
const btnSmall: React.CSSProperties = { padding: "6px 12px", borderRadius: 4, background: "transparent", color: "var(--ink-deep)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", fontSize: 11, fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 1, cursor: "pointer", whiteSpace: "nowrap" };
const th: React.CSSProperties = { padding: "8px 10px", textAlign: "left", fontSize: 10, color: "var(--ink-mid)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px 10px", color: "var(--ink-deep)" };

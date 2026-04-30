"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type CronItem = {
  code: string;
  label: string;
  default_schedule: string;
  is_enabled: boolean;
  schedule: string;
  runs_24h: number;
  pass_rate: number | null;
  last_run_status: "ok" | "fail" | "noop";
};

export default function CronConfigEditor() {
  const [items, setItems] = useState<CronItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/admin/cron-config");
    const d = await r.json();
    setItems(d.items || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function toggle(code: string, is_enabled: boolean) {
    setSaving(code);
    const item = items.find(x => x.code === code);
    await fetch("/api/admin/cron-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, is_enabled, schedule: item?.schedule }),
    });
    await refresh();
    setSaving(null);
  }

  async function updateSchedule(code: string, schedule: string) {
    setSaving(code);
    const item = items.find(x => x.code === code);
    await fetch("/api/admin/cron-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, schedule, is_enabled: item?.is_enabled }),
    });
    await refresh();
    setSaving(null);
  }

  if (loading) return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入排程…</div>;

  const enabledCount = items.filter(i => i.is_enabled).length;
  const failingCount = items.filter(i => i.last_run_status === "fail").length;

  return (
    <div style={{ padding: "32px", maxWidth: 1200, margin: "0 auto" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}>
        ADMIN · CRON SCHEDULE
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: "clamp(40px, 6vw, 64px)", color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 16, lineHeight: 1.1 }}>
        排程 · {enabledCount}/{items.length}
      </motion.h1>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ fontSize: 13, color: "var(--ink-mid)", marginBottom: 32 }}>
        {enabledCount} 啟用 · {failingCount > 0 && <span style={{ color: "var(--accent-red)" }}>{failingCount} 失敗</span>}
      </motion.div>

      <div className="space-y-3">
        {items.map((it, idx) => (
          <motion.div
            key={it.code}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            whileHover={{ y: -1 }}
            style={{
              padding: 16,
              background: "var(--bg-paper)",
              border: `1px solid ${it.last_run_status === "fail" ? "var(--accent-red)" : "var(--border-soft, rgba(26,26,26,0.10))"}`,
              borderRadius: 6,
              display: "grid",
              gridTemplateColumns: "auto 200px 1fr 200px auto",
              gap: 16,
              alignItems: "center",
            }}
          >
            {/* enable toggle */}
            <button
              onClick={() => toggle(it.code, !it.is_enabled)}
              disabled={saving === it.code}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: it.is_enabled ? "var(--gold-thread, #c9a96e)" : "var(--border-soft, rgba(26,26,26,0.10))",
                position: "relative",
                border: "none",
                cursor: saving === it.code ? "wait" : "pointer",
                transition: "background 0.2s",
              }}
            >
              <motion.span
                animate={{ x: it.is_enabled ? 22 : 2 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={{ position: "absolute", top: 2, left: 0, width: 20, height: 20, borderRadius: "50%", background: "var(--bg-paper)", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
              />
            </button>

            {/* code */}
            <div>
              <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--ink-mid)", letterSpacing: 1 }}>
                {it.code}
              </div>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 14, color: "var(--ink-deep)", marginTop: 2 }}>
                {it.label}
              </div>
            </div>

            {/* schedule */}
            <div>
              <input
                type="text"
                defaultValue={it.schedule}
                onBlur={(e) => { if (e.target.value !== it.schedule) updateSchedule(it.code, e.target.value); }}
                placeholder={it.default_schedule}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: 4,
                  border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
                  background: "var(--bg-elev)",
                  fontSize: 11,
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: "var(--ink-deep)",
                }}
              />
              <div style={{ fontSize: 9, color: "var(--ink-mid)", marginTop: 2, opacity: 0.6 }}>cron syntax</div>
            </div>

            {/* health */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div>
                <div style={{ fontSize: 9, color: "var(--ink-mid)", letterSpacing: 1 }}>24H</div>
                <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 18, color: "var(--ink-deep)", fontWeight: 600 }}>{it.runs_24h}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "var(--ink-mid)", letterSpacing: 1 }}>PASS%</div>
                <div style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 18, fontWeight: 600, color: it.pass_rate == null ? "var(--ink-mid)" : it.pass_rate >= 80 ? "var(--gold-thread, #c9a96e)" : "var(--accent-red)" }}>
                  {it.pass_rate ?? "—"}
                </div>
              </div>
            </div>

            {/* status badge */}
            <div>
              <span style={{
                fontSize: 10,
                padding: "3px 8px",
                borderRadius: 2,
                background: it.last_run_status === "ok" ? "rgba(201,169,110,0.2)" : it.last_run_status === "fail" ? "rgba(185,28,28,0.15)" : "var(--border-soft, rgba(26,26,26,0.10))",
                color: it.last_run_status === "ok" ? "var(--gold-thread, #c9a96e)" : it.last_run_status === "fail" ? "var(--accent-red)" : "var(--ink-mid)",
                letterSpacing: 1,
                fontWeight: 600,
              }}>
                {it.last_run_status === "ok" ? "正常" : it.last_run_status === "fail" ? "失敗" : "閒置"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        style={{ marginTop: 32, padding: 20, background: "var(--bg-elev)", borderRadius: 4, fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.7 }}
      >
        <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 14, color: "var(--ink-deep)", marginBottom: 8 }}>說明</div>
        - 排程改變後 cron 路由執行時會看 cron_config.is_enabled<br/>
        - GitHub Actions 排程改變要改 .github/workflows/*.yml(本 toggle 不影響 GitHub Actions schedule)<br/>
        - 24H runs 從 system_run_log 統計
      </motion.div>
    </div>
  );
}

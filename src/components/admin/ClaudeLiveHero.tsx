"use client";

import { useEffect, useState } from "react";

interface RunStats {
  total_24h: number;
  ok_24h: number;
  partial_24h: number;
  failed_24h: number;
  active_workers: number;
}

/**
 * Claude 即時狀態 hero(/admin/claude/live 頂部)
 * 對齊 system-tree v2 §AI 工作台 §Claude 即時狀態:
 *   - Claude 虛擬形象(會呼吸 — CSS keyframes)
 *   - 過去 24h 統計
 *   - 自我健康度(看下方 HealthStrip)
 */
export default function ClaudeLiveHero() {
  const [stats, setStats] = useState<RunStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/system-run-log?range=24h", { cache: "no-store" })
      .then(r => r.json())
      .then(j => {
        // 從 SystemRunLogPanel 用的 endpoint 拿 24h 統計
        const runs = j?.runs ?? j?.records ?? [];
        const total = runs.length;
        const ok = runs.filter((r: { status?: string }) => r.status === "ok").length;
        const partial = runs.filter((r: { status?: string }) => r.status === "partial").length;
        const failed = runs.filter((r: { status?: string }) => r.status === "failed" || r.status === "error").length;
        const sources = new Set(runs.map((r: { source_id?: string }) => r.source_id).filter(Boolean));
        setStats({ total_24h: total, ok_24h: ok, partial_24h: partial, failed_24h: failed, active_workers: sources.size });
      })
      .catch(() => setStats(null));
  }, []);

  const successRate = stats && stats.total_24h > 0
    ? Math.round((stats.ok_24h / stats.total_24h) * 100)
    : null;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto 1fr",
      gap: 24,
      alignItems: "center",
      background: "linear-gradient(135deg, #FAFAF7 0%, #F0EFEA 100%)",
      border: "1px solid var(--ink-line, #E5E2DA)",
      borderRadius: 12,
      padding: 20,
      marginBottom: 18,
    }}>
      {/* Claude 虛擬形象(呼吸動畫) */}
      <div style={{ position: "relative", width: 80, height: 80 }}>
        <div className="claude-breath" style={{
          width: 80, height: 80,
          borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #C8102E 0%, #8B0E20 70%, #5A0814 100%)",
          boxShadow: "0 4px 20px rgba(200, 16, 46, 0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, color: "#fff", fontWeight: 900,
          fontFamily: '"Noto Serif TC", serif',
        }}>
          墨
        </div>
        <style jsx>{`
          .claude-breath {
            animation: breath 4s ease-in-out infinite;
          }
          @keyframes breath {
            0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(200, 16, 46, 0.3); }
            50%      { transform: scale(1.06); box-shadow: 0 6px 30px rgba(200, 16, 46, 0.5); }
          }
        `}</style>
      </div>

      {/* 24h 統計 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 16 }}>
        <Stat label="24h 執行" value={stats?.total_24h ?? "—"} />
        <Stat label="活躍 worker" value={stats?.active_workers ?? "—"} accent="#6B7E94" />
        <Stat label="成功" value={stats?.ok_24h ?? "—"} accent="#6B7A5A" />
        <Stat label="部分" value={stats?.partial_24h ?? "—"} accent="#B89968" />
        <Stat label="失敗" value={stats?.failed_24h ?? "—"} accent="#B8474A" />
        <Stat label="成功率" value={successRate !== null ? `${successRate}%` : "—"} accent={
          successRate !== null && successRate >= 80 ? "#6B7A5A"
          : successRate !== null && successRate >= 50 ? "#B89968"
          : "#B8474A"
        } big />
      </div>
    </div>
  );
}

function Stat({ label, value, accent = "#2A2622", big = false }: { label: string; value: number | string; accent?: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text3, #888)", letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: big ? 26 : 20, fontWeight: 800, color: accent, marginTop: 2 }}>{value}</div>
    </div>
  );
}

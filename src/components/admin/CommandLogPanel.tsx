"use client";

import { useEffect, useState } from "react";

interface ClaudeTask {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: number | null;
  status: string;
  why: string | null;
  expected_input: string | null;
  blocked_features: string[] | null;
  created_at: string;
  updated_at: string | null;
}

const STATUS_GROUPS = [
  { id: "pending",     label: "🟡 待辦",     accent: "#B89968" },
  { id: "in_progress", label: "🔵 進行中",   accent: "#6B7E94" },
  { id: "done",        label: "✅ 已完成",   accent: "#6B7A5A" },
  { id: "stuck",       label: "🔴 卡住",     accent: "#B8474A" },
  { id: "ignored",     label: "⚫ 被忽略",   accent: "#8A8276" },
] as const;

/**
 * 命令日誌(/admin/claude/log Tab 1)
 * 對齊 system-tree v2 §AI 工作台 §工作日誌 Tab 1:
 *   - 待辦 / 進行中 / 已完成 / 卡住 / 被忽略
 *   - Claude 派的所有命令
 *
 * 資料來源:claude_tasks table
 */
export default function CommandLogPanel() {
  const [tasks, setTasks] = useState<ClaudeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<string>("pending");

  useEffect(() => {
    fetch("/api/admin/claude-tasks", { cache: "no-store" })
      .then(r => r.json())
      .then(j => setTasks(j?.tasks ?? []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

  const grouped = STATUS_GROUPS.map(g => ({
    ...g,
    items: tasks.filter(t => t.status === g.id),
  }));

  const activeGroup = grouped.find(g => g.id === activeStatus) ?? grouped[0];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {grouped.map(g => {
          const isActive = activeStatus === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setActiveStatus(g.id)}
              style={{
                padding: "6px 12px",
                border: `1px solid ${isActive ? g.accent : "var(--ink-line, #E5E2DA)"}`,
                borderRadius: 16,
                background: isActive ? g.accent : "var(--ink-paper, #FAFAF7)",
                color: isActive ? "#fff" : "var(--text2, #555)",
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {g.label} <span style={{ opacity: 0.8 }}>({g.items.length})</span>
            </button>
          );
        })}
      </div>

      {loading && <div style={infoBox}>載入命令日誌…</div>}
      {!loading && activeGroup.items.length === 0 && (
        <div style={infoBox}>📭 此分類無命令</div>
      )}
      {!loading && activeGroup.items.map(t => (
        <div key={t.id} style={{
          background: "var(--ink-paper, #FAFAF7)",
          border: "1px solid var(--ink-line, #E5E2DA)",
          borderLeft: `4px solid ${activeGroup.accent}`,
          borderRadius: 8,
          padding: 14,
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 11, color: "var(--text3, #888)", marginBottom: 4 }}>
            {t.category ?? "uncategorized"} · {new Date(t.created_at).toLocaleString("zh-TW")}
            {t.priority !== null && ` · P${t.priority}`}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t.title}</div>
          {t.description && (
            <div style={{ fontSize: 12, color: "var(--text2, #666)", lineHeight: 1.6 }}>{t.description}</div>
          )}
          {t.why && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text3, #888)", fontStyle: "italic" }}>
              理由:{t.why}
            </div>
          )}
          {(t.blocked_features?.length ?? 0) > 0 && (
            <div style={{ marginTop: 6, fontSize: 11 }}>
              <span style={{ color: "#B8474A" }}>🚫 卡住的功能:</span> {t.blocked_features?.join(", ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const infoBox: React.CSSProperties = {
  padding: 14,
  background: "var(--ink-mist, #F0EFEA)",
  borderRadius: 6,
  fontSize: 13,
  color: "var(--text2, #666)",
};

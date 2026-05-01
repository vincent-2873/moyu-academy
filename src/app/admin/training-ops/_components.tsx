"use client";

import { useState } from "react";

/**
 * 共用 UI 元件給 /admin/training-ops/* 4 個子頁
 * 下劃線開頭 = Next.js App Router 不把此檔當 route
 */

const BRAND_LABELS: Record<string, string> = {
  nschool:  "nSchool 財經",
  xuemi:    "XUEMI 學米",
  ooschool: "ooschool 無限",
  aischool: "aischool 未來",
  xlab:     "X LAB 實體",
};

export function brandLabel(brand: string): string {
  return BRAND_LABELS[brand] ?? brand;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header style={{ marginBottom: 28 }}>
      <h1 style={{
        fontSize: 28,
        fontWeight: 600,
        color: "var(--text)",
        margin: 0,
        fontFamily: '"Noto Serif TC", serif',
        letterSpacing: "-0.01em",
      }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{
          color: "var(--text3)",
          marginTop: 6,
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          {subtitle}
        </p>
      )}
    </header>
  );
}

export function KPICard({ label, value, accent = "default" }: {
  label: string;
  value: number | string;
  accent?: "default" | "ruby" | "amber";
}) {
  const accentColor = accent === "ruby"  ? "var(--accent)"
                    : accent === "amber" ? "var(--gold)"
                    : "var(--text)";
  return (
    <div style={{
      padding: 24,
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      transition: "transform 150ms ease-out, box-shadow 150ms",
    }}>
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10, letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{
        fontSize: 36,
        fontWeight: 700,
        color: accentColor,
        fontFamily: '"JetBrains Mono", monospace',
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  );
}

export function StubNotice({ tasks }: { tasks: string[] }) {
  return (
    <div style={{
      padding: 20,
      background: "var(--card2)",
      border: "1px dashed var(--border-strong)",
      borderRadius: 8,
      color: "var(--text2)",
      fontSize: 13,
      lineHeight: 1.7,
    }}>
      <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
        待實作 (Task chain)
      </div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {tasks.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      padding: 16,
      background: "var(--card)",
      border: "1px solid var(--accent)",
      borderRadius: 8,
      color: "var(--accent)",
      marginBottom: 16,
      fontSize: 13,
    }}>
      載入錯誤:{message}
    </div>
  );
}

export function LoadingBox() {
  return <div style={{ color: "var(--text3)", padding: 24, fontSize: 13 }}>載入中…</div>;
}

export function SectionHeader({ title, count, accent = "default" }: {
  title: string;
  count?: number;
  accent?: "default" | "ruby" | "amber" | "jade";
}) {
  const colorMap = {
    default: "var(--text)",
    ruby:    "var(--accent)",
    amber:   "var(--gold)",
    jade:    "var(--green)",
  };
  return (
    <h2 style={{
      fontSize: 16,
      fontWeight: 600,
      color: colorMap[accent],
      marginTop: 32,
      marginBottom: 12,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}>
      {title}
      {typeof count === "number" && (
        <span style={{
          fontSize: 13,
          fontWeight: 400,
          color: "var(--text3)",
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          ({count})
        </span>
      )}
    </h2>
  );
}

export function ProgressDistributionBar({ distribution }: {
  distribution: Array<{ day: number; count: number; is_lagging: boolean }>;
}) {
  const max = Math.max(1, ...distribution.map(d => d.count));
  return (
    <div style={{
      padding: 24,
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 16 }}>
        進度分布(D0 → D14)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {distribution.map(d => (
          <div key={d.day} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 32, fontSize: 11, color: "var(--text3)",
              fontFamily: '"JetBrains Mono", monospace', textAlign: "right",
            }}>
              D{d.day}
            </div>
            <div style={{
              flex: 1, height: 18, background: "var(--bg2)", borderRadius: 4,
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                width: `${(d.count / max) * 100}%`,
                height: "100%",
                background: d.is_lagging ? "var(--accent)" : d.count > 0 ? "var(--gold)" : "transparent",
                transition: "width 800ms cubic-bezier(0.16, 1, 0.3, 1)",
                borderRadius: 4,
              }} />
            </div>
            <div style={{
              width: 60, fontSize: 12, color: "var(--text2)",
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              {d.count} 人 {d.is_lagging && <span style={{ color: "var(--accent)" }}>⚠</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthlySummaryRow({ summary }: {
  summary: {
    completion_rate: number;
    completion_rate_change: number;
    avg_practice_score: number;
    stuck_resolution_rate: number;
  };
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 12,
      padding: 20,
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
    }}>
      <SummaryStat label="完訓率"        value={`${summary.completion_rate}%`}
                    delta={summary.completion_rate_change} />
      <SummaryStat label="平均對練分"    value={summary.avg_practice_score} />
      <SummaryStat label="卡關處理率"    value={`${summary.stuck_resolution_rate}%`} />
    </div>
  );
}

function SummaryStat({ label, value, delta }: { label: string; value: number | string; delta?: number }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, letterSpacing: "0.05em" }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 700, color: "var(--text)",
        fontFamily: '"JetBrains Mono", monospace',
      }}>
        {value}
        {typeof delta === "number" && delta !== 0 && (
          <span style={{
            fontSize: 12,
            color: delta > 0 ? "var(--green)" : "var(--accent)",
            marginLeft: 6,
          }}>
            {delta > 0 ? "↑" : "↓"}{Math.abs(delta)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── StuckCard(需介入清單用)────────────────────────────────────────

export interface ClaudeAttempt {
  attempted_at: string;
  action: string;
  result: string;
}

export interface AttentionItem {
  id: string;
  user_name: string;
  user_email: string;
  brand: string;
  current_day: number;
  stuck_days: number;
  title: string;
  description: string | null;
  claude_attempts: ClaudeAttempt[];
  claude_recommendation: string | null;
  category: "urgent" | "normal";
  created_at: string;
  resolved_at: string | null;
}

export type AttentionAction = "self_handle" | "delegate_to_leader" | "voice_memo" | "mark_resolved";

export function StuckCard({ item, onAction, disabled = false }: {
  item: AttentionItem;
  onAction: (id: string, action: AttentionAction) => void;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState<AttentionAction | null>(null);
  const handle = (action: AttentionAction) => {
    setPending(action);
    onAction(item.id, action);
  };

  return (
    <div style={{
      background: "var(--card)",
      borderLeft: `4px solid ${item.category === "urgent" ? "var(--accent)" : "var(--gold)"}`,
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: 24,
      marginBottom: 16,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
          <span style={{ marginRight: 8 }}>{item.category === "urgent" ? "🚨" : "⚠"}</span>
          {item.user_name}
          <span style={{
            fontSize: 12, color: "var(--text3)", fontWeight: 400, marginLeft: 8,
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            ({brandLabel(item.brand)} · D{item.current_day} · 卡了 {item.stuck_days} 天)
          </span>
        </div>
      </div>

      {item.claude_attempts.length > 0 && (
        <div style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, letterSpacing: "0.05em" }}>
            🤖 Claude 嘗試
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "var(--text2)", lineHeight: 1.7 }}>
            {item.claude_attempts.map((a, i) => (
              <li key={i}>
                ✓ {a.action} — <span style={{ color: "var(--text3)" }}>{a.result}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.claude_recommendation && (
        <div style={{
          fontSize: 13, fontStyle: "italic", color: "var(--text2)",
          padding: "8px 0 16px", lineHeight: 1.7,
          fontFamily: '"Noto Serif TC", serif',
        }}>
          「{item.claude_recommendation}」
        </div>
      )}

      {!item.resolved_at && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ActionBtn label="📞 我親自接"       onClick={() => handle("self_handle")}        disabled={disabled || pending !== null} />
          <ActionBtn label="👥 派組長"         onClick={() => handle("delegate_to_leader")} disabled={disabled || pending !== null} />
          <ActionBtn label="📝 留 voice memo"  onClick={() => handle("voice_memo")}          disabled={disabled || pending !== null} />
          <ActionBtn label="✓ 標記已處理"      onClick={() => handle("mark_resolved")}      disabled={disabled || pending !== null} variant="resolved" />
        </div>
      )}
      {item.resolved_at && (
        <div style={{ fontSize: 12, color: "var(--green)" }}>
          ✓ 已處理 ({new Date(item.resolved_at).toLocaleString("zh-TW")})
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, onClick, disabled, variant = "default" }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "resolved";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 14px",
        background: variant === "resolved" ? "var(--card2)" : "var(--card)",
        border: `1px solid ${variant === "resolved" ? "var(--green)" : "var(--border-strong)"}`,
        borderRadius: 6,
        color: variant === "resolved" ? "var(--green)" : "var(--text)",
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "transform 150ms, background 150ms",
      }}
      onMouseDown={e => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
      }}
      onMouseUp={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
    >
      {label}
    </button>
  );
}

// ─── attention 預覽用的 ProgressItem(students 顯示前 3)───────────

export interface AttentionPreview {
  user_id: string;
  name: string;
  brand: string;
  current_day: number;
  stuck_days: number;
  summary: string;
}

export function AttentionPreviewItem({ item }: { item: AttentionPreview }) {
  return (
    <div style={{
      padding: "12px 16px",
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--accent)",
      borderRadius: 8,
      marginBottom: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 2 }}>
        🚨 {item.name}
        <span style={{
          fontSize: 11, color: "var(--text3)", fontWeight: 400, marginLeft: 8,
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          ({brandLabel(item.brand)} · D{item.current_day} · 卡 {item.stuck_days} 天)
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text2)" }}>
        {item.summary}
      </div>
    </div>
  );
}

// ─── DraftPreviewBlock(教材草稿預覽 + 採用)────────────────────────

export interface DraftModule {
  day_offset: number;
  sequence: number;
  module_type: string;
  title: string;
  description: string;
  duration_min: number;
}

const MODULE_TYPE_ICON: Record<string, string> = {
  video:        "📺",
  reading:      "📖",
  quiz:         "📝",
  sparring:     "🎤",
  task:         "✍️",
  reflection:   "💭",
  live_session: "🎥",
};

export function DraftPreviewBlock({ drafts, onAdoptAll, adopting, adoptError }: {
  drafts: DraftModule[];
  onAdoptAll: () => void;
  adopting: boolean;
  adoptError: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const sorted = [...drafts].sort((a, b) =>
    a.day_offset !== b.day_offset ? a.day_offset - b.day_offset : a.sequence - b.sequence
  );

  return (
    <div style={{
      marginTop: 12,
      marginBottom: 24,
      padding: 20,
      background: "var(--card2)",
      border: "1px solid var(--gold)",
      borderRadius: 12,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 12, gap: 12, flexWrap: "wrap",
      }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            color: "var(--text)", fontSize: 14, fontWeight: 600,
          }}
        >
          ✨ Claude 已生成 {drafts.length} 個 module 草稿
          <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 400 }}>
            ({expanded ? "收合 ▲" : "展開預覽 ▼"})
          </span>
        </button>
        <button
          onClick={onAdoptAll}
          disabled={adopting}
          style={{
            padding: "8px 16px",
            background: adopting ? "var(--card)" : "var(--accent)",
            color: adopting ? "var(--text3)" : "var(--bg)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            fontSize: 13, fontWeight: 600,
            cursor: adopting ? "not-allowed" : "pointer",
          }}
        >
          {adopting ? "寫入中…" : `✓ 採用全部 (${drafts.length} 個)`}
        </button>
      </div>

      {adoptError && (
        <div style={{
          padding: 12, marginBottom: 12,
          background: "var(--card)", border: "1px solid var(--accent)",
          borderRadius: 6, color: "var(--accent)", fontSize: 13,
        }}>
          採用失敗:{adoptError}
        </div>
      )}

      {expanded && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 4,
          maxHeight: 400, overflowY: "auto",
          background: "var(--bg2)", padding: 12, borderRadius: 8,
        }}>
          {sorted.map((m, i) => (
            <div key={`${m.day_offset}-${m.sequence}-${i}`} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "6px 8px",
              fontSize: 12,
              borderBottom: i < sorted.length - 1 ? "1px dashed var(--border)" : "none",
            }}>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', color: "var(--text3)",
                width: 60, flexShrink: 0,
              }}>
                D{m.day_offset}#{m.sequence}
              </span>
              <span style={{ width: 24, flexShrink: 0, fontSize: 14 }}>
                {MODULE_TYPE_ICON[m.module_type] ?? "•"}
              </span>
              <span style={{
                width: 80, flexShrink: 0, color: "var(--text3)",
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                {m.module_type}
              </span>
              <span style={{ flex: 1, color: "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {m.title}
              </span>
              <span style={{
                fontSize: 11, color: "var(--text3)", flexShrink: 0,
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                {m.duration_min} min
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── auto_handled 區塊 ────────────────────────────────────────

export function AutoHandledBlock({ total, byBrand }: {
  total: number;
  byBrand: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const brands = Object.entries(byBrand).sort(([, a], [, b]) => b - a);
  return (
    <div style={{
      padding: 20,
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none", border: "none", padding: 0, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          color: "var(--text)", fontSize: 14, fontWeight: 600,
        }}
      >
        <span>✅ Claude 自動處理中</span>
        <span style={{
          fontSize: 12, color: "var(--text3)", fontWeight: 400,
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          ({total} 人)
        </span>
        <span style={{ marginLeft: "auto", color: "var(--text3)", fontSize: 12 }}>
          {expanded ? "收合 ▲" : "展開 ▼"}
        </span>
      </button>
      {expanded && (
        <ul style={{
          marginTop: 12, paddingLeft: 0, listStyle: "none",
          fontSize: 13, color: "var(--text2)", lineHeight: 1.8,
        }}>
          {brands.length === 0 ? (
            <li style={{ color: "var(--text3)" }}>(目前無分布資料)</li>
          ) : brands.map(([brand, count]) => (
            <li key={brand} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span>• {brandLabel(brand)}</span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', color: "var(--text3)" }}>
                {count} 人
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

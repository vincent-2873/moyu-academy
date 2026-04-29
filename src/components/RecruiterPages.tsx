"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@/lib/store";

// ─── Types & Constants ─────────────────────────────────────────────────────

export interface Candidate {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  brand: string;
  source: string | null;
  stage: string;
  notes: string | null;
  created_at: string;
  stage_entered_at: string | null;
  owner_email?: string | null;
}

const STAGES: { id: string; label: string; color: string }[] = [
  { id: "applied", label: "投遞", color: "#94a3b8" },
  { id: "screening", label: "篩選", color: "#3b82f6" },
  { id: "interview_1", label: "一面", color: "#8b5cf6" },
  { id: "interview_2", label: "二面", color: "#a855f7" },
  { id: "offer", label: "Offer", color: "#fbbf24" },
  { id: "onboarded", label: "報到", color: "#22c55e" },
  { id: "probation", label: "試用期", color: "#10b981" },
  { id: "passed", label: "通過", color: "#059669" },
  { id: "dropped", label: "流失", color: "#ef4444" },
  { id: "rejected", label: "拒絕", color: "#dc2626" },
];

const BRAND_OPTIONS = [
  { id: "nschool", label: "nSchool 財經" },
  { id: "xuemi", label: "XUEMI 學米" },
  { id: "ooschool", label: "OOschool 無限" },
  { id: "aischool", label: "AIschool 智能" },
];

const SOURCE_OPTIONS = ["104", "1111", "IG 廣告", "FB 廣告", "LinkedIn", "內部介紹", "其他"];

const ACCENT = "#fb923c";

function stageInfo(id: string) {
  return STAGES.find((s) => s.id === id) || STAGES[0];
}

async function fetchCandidates(ownerEmail: string): Promise<Candidate[]> {
  try {
    const res = await fetch(`/api/recruit-funnel?owner=${encodeURIComponent(ownerEmail)}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.recruits || []) as Candidate[];
  } catch {
    return [];
  }
}

// ─── Recruiter Dashboard ───────────────────────────────────────────────────

export function RecruiterDashboard({
  user,
  onNavigate,
}: {
  user: User;
  onNavigate: (p: string) => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCandidates(user.email).then((c) => {
      setCandidates(c);
      setLoading(false);
    });
  }, [user.email]);

  const total = candidates.length;
  const inFunnel = candidates.filter((c) => !["passed", "dropped", "rejected"].includes(c.stage)).length;
  const passed = candidates.filter((c) => c.stage === "passed").length;
  const dropped = candidates.filter((c) => c.stage === "dropped").length;
  const rejected = candidates.filter((c) => c.stage === "rejected").length;
  const conversionRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const weekAdded = candidates.filter((c) => {
    return Date.now() - new Date(c.created_at).getTime() < 7 * 86400000;
  }).length;

  // 各階段統計
  const byStage: Record<string, number> = {};
  STAGES.forEach((s) => (byStage[s.id] = 0));
  candidates.forEach((c) => (byStage[c.stage] = (byStage[c.stage] || 0) + 1));

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(iv);
  }, []);

  const greeting = (() => {
    const h = now.getHours();
    if (h < 6) return "深夜還在顧漏斗";
    if (h < 12) return "早安，開始今日開發";
    if (h < 14) return "中午了，繼續跟求職者";
    if (h < 18) return "下午面試衝刺";
    if (h < 21) return "晚間最後一波聯繫";
    return "夜深了，明天繼續";
  })();

  return (
    <div className="animate-fade-in">
      {/* HERO */}
      <div
        className="relative overflow-hidden rounded-3xl mb-8 p-6 md:p-8 border border-[var(--border-strong)]"
        style={{
          background: `
            radial-gradient(circle at 12% 20%, rgba(251,146,60,0.25) 0%, transparent 50%),
            radial-gradient(circle at 88% 80%, rgba(124,108,240,0.15) 0%, transparent 50%),
            linear-gradient(135deg, var(--card) 0%, var(--card2) 100%)
          `,
        }}
      >
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="relative z-[1] flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase border backdrop-blur"
                style={{
                  borderColor: `${ACCENT}55`,
                  background: `${ACCENT}15`,
                  color: ACCENT,
                }}
              >
                <span className="status-dot live" />
                墨宇獵頭 · 招聘戰線
              </span>
              <span className="text-xs text-[var(--text3)]">{greeting}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">
              {user.name}
              <span className="text-[var(--text2)] text-lg md:text-xl font-medium"> · 漏斗中 {inFunnel} 人</span>
            </h1>
            <p className="mt-2 text-sm md:text-base text-[var(--text2)]">
              本週新增 <span className="text-[var(--text)] font-bold tabular-nums">{weekAdded}</span> 位求職者 · 轉換率{" "}
              <span className="text-[var(--text)] font-bold tabular-nums">{conversionRate}%</span>
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => onNavigate("add_candidate")}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg hover:scale-105 transition-all"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, #f59e0b)` }}
              >
                ➕ 新增求職者
              </button>
              <button
                onClick={() => onNavigate("candidates")}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--border-strong)] bg-[var(--bg2)]/60 text-[var(--text)] hover:border-[var(--accent)] backdrop-blur"
              >
                👥 我的求職者
              </button>
              <button
                onClick={() => onNavigate("funnel")}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--border-strong)] bg-[var(--bg2)]/60 text-[var(--text)] hover:border-[var(--teal)] backdrop-blur"
              >
                🔻 漏斗追蹤
              </button>
            </div>
          </div>

          {/* 轉換率環 */}
          <div className="relative flex flex-col items-center justify-center">
            <svg width="148" height="148" viewBox="0 0 148 148">
              <defs>
                <linearGradient id="recruitRing" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={ACCENT} />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
              <circle cx="74" cy="74" r="62" fill="none" stroke="var(--border)" strokeWidth="10" />
              <circle
                cx="74" cy="74" r="62"
                fill="none"
                stroke="url(#recruitRing)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(conversionRate / 100) * 389.557} 389.557`}
                style={{ transition: "stroke-dasharray 0.8s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums gradient-text">{conversionRate}%</span>
              <span className="text-[10px] text-[var(--text3)] mt-0.5">漏斗轉換率</span>
              <span className="text-[10px] text-[var(--text2)] mt-0.5 tabular-nums">
                {passed} / {total}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 統計 5 格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {([
          { icon: "🔻", label: "漏斗中", value: inFunnel, sub: "人", color: ACCENT },
          { icon: "✅", label: "已通過", value: passed, sub: "人", color: "#22c55e" },
          { icon: "📥", label: "本週新增", value: weekAdded, sub: "人", color: "#06b6d4" },
          { icon: "💨", label: "流失", value: dropped, sub: "人", color: "#f87171" },
          { icon: "❌", label: "拒絕", value: rejected, sub: "人", color: "#94a3b8" },
        ] as const).map((s) => (
          <div
            key={s.label}
            className="metric-tile"
            style={{ ["--metric-color" as string]: s.color }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-base w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${s.color}20`, color: s.color }}
              >
                {s.icon}
              </span>
              <span className="text-[10px] text-[var(--text3)] uppercase tracking-wider font-bold">{s.label}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-[10px] text-[var(--text3)] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* 漏斗視覺化 */}
      <div className="surface-elevated p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 rounded-full" style={{ background: `linear-gradient(180deg, ${ACCENT}, #f59e0b)` }} />
            <h3 className="text-sm font-bold">招聘漏斗階段分佈</h3>
          </div>
          <button onClick={() => onNavigate("funnel")} className="text-xs text-[var(--accent)] hover:underline">
            完整追蹤 →
          </button>
        </div>
        {loading ? (
          <div className="py-8 text-center text-[var(--text3)] text-sm">載入中...</div>
        ) : total === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-2 opacity-60">🎯</p>
            <p className="text-sm text-[var(--text2)] mb-3">還沒新增任何求職者</p>
            <button
              onClick={() => onNavigate("add_candidate")}
              className="text-xs px-4 py-2 rounded-lg font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, #f59e0b)` }}
            >
              新增第一位求職者
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {STAGES.filter((s) => !["dropped", "rejected"].includes(s.id)).map((s) => {
              const count = byStage[s.id] || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text2)] w-16 flex-shrink-0">{s.label}</span>
                  <div className="flex-1 h-6 bg-[var(--bg2)] rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg transition-all duration-700 flex items-center px-2"
                      style={{
                        width: `${Math.max(pct, count > 0 ? 6 : 0)}%`,
                        background: `linear-gradient(90deg, ${s.color}, ${s.color}80)`,
                      }}
                    >
                      {count > 0 && (
                        <span className="text-[10px] font-bold text-white">{count}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-[var(--text3)] tabular-nums w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 最近求職者 */}
      <div className="surface-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 rounded-full" style={{ background: "linear-gradient(180deg, #06b6d4, var(--accent))" }} />
            <h3 className="text-sm font-bold">最近求職者</h3>
          </div>
          <button onClick={() => onNavigate("candidates")} className="text-xs text-[var(--accent)] hover:underline">
            查看全部 →
          </button>
        </div>
        {candidates.length === 0 ? (
          <div className="text-center py-8 text-[var(--text3)] text-sm">還沒有求職者紀錄</div>
        ) : (
          <div className="space-y-2">
            {candidates.slice(0, 5).map((c) => {
              const si = stageInfo(c.stage);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 bg-[var(--bg2)] rounded-lg border border-[var(--border)]"
                >
                  <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: si.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.name}</p>
                    <p className="text-[10px] text-[var(--text3)]">
                      {BRAND_OPTIONS.find((b) => b.id === c.brand)?.label || c.brand}
                      {c.source && ` · ${c.source}`}
                    </p>
                  </div>
                  <span
                    className="text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap"
                    style={{ background: `${si.color}20`, color: si.color }}
                  >
                    {si.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Candidates Page ───────────────────────────────────────────────────────

export function CandidatesPage({
  user,
  onNavigate,
}: {
  user: User;
  onNavigate: (p: string) => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Candidate | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchCandidates(user.email).then((c) => {
      setCandidates(c);
      setLoading(false);
    });
  }, [user.email]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = candidates.filter((c) => {
    if (stageFilter !== "all" && c.stage !== stageFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.notes || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function moveStage(id: string, newStage: string) {
    try {
      await fetch("/api/recruit-funnel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage: newStage, owner: user.email }),
      });
      load();
      setSelected(null);
    } catch {
      alert("更新失敗");
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">我的求職者</h1>
          <p className="text-[var(--text2)] text-sm">共 {candidates.length} 位 · 顯示 {filtered.length} 位</p>
        </div>
        <button
          onClick={() => onNavigate("add_candidate")}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #f59e0b)` }}
        >
          ➕ 新增求職者
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 搜尋姓名 / 電話 / Email"
          className="flex-1 min-w-[200px] max-w-sm px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-sm outline-none focus:border-[var(--accent)]"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="all">全部階段</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--text3)]">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="surface-elevated py-12 text-center">
          <p className="text-4xl mb-2 opacity-60">🎯</p>
          <p className="text-sm text-[var(--text2)]">
            {candidates.length === 0 ? "尚無求職者" : "沒有符合條件的求職者"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const si = stageInfo(c.stage);
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] transition-all text-left"
              >
                <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ background: si.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold">{c.name}</p>
                    {c.phone && <p className="text-xs text-[var(--text3)]">📞 {c.phone}</p>}
                  </div>
                  <p className="text-[11px] text-[var(--text3)]">
                    {BRAND_OPTIONS.find((b) => b.id === c.brand)?.label || c.brand}
                    {c.source && ` · 來源 ${c.source}`}
                    {` · ${new Date(c.created_at).toLocaleDateString("zh-TW")}`}
                  </p>
                </div>
                <span
                  className="text-[11px] px-2.5 py-1 rounded-md font-bold whitespace-nowrap"
                  style={{ background: `${si.color}20`, color: si.color }}
                >
                  {si.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-t-3xl md:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{selected.name}</h2>
                  <span
                    className="inline-block text-[11px] px-2 py-0.5 rounded font-bold mt-1"
                    style={{
                      background: `${stageInfo(selected.stage).color}20`,
                      color: stageInfo(selected.stage).color,
                    }}
                  >
                    {stageInfo(selected.stage).label}
                  </span>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-8 h-8 rounded-lg hover:bg-[var(--border)] text-[var(--text3)]"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-sm mb-5">
                {selected.phone && <p><span className="text-[var(--text3)]">電話</span> · {selected.phone}</p>}
                {selected.email && <p><span className="text-[var(--text3)]">Email</span> · {selected.email}</p>}
                <p><span className="text-[var(--text3)]">品牌</span> · {BRAND_OPTIONS.find((b) => b.id === selected.brand)?.label || selected.brand}</p>
                {selected.source && <p><span className="text-[var(--text3)]">來源</span> · {selected.source}</p>}
                {selected.notes && (
                  <p className="text-[var(--text2)] text-xs bg-[var(--bg2)] p-3 rounded-lg border border-[var(--border)]">
                    {selected.notes}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-[var(--text3)] mb-2">推進階段</p>
                <div className="grid grid-cols-2 gap-2">
                  {STAGES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => moveStage(selected.id, s.id)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border transition-all"
                      style={{
                        borderColor: selected.stage === s.id ? s.color : "var(--border)",
                        background: selected.stage === s.id ? `${s.color}20` : "var(--bg2)",
                        color: selected.stage === s.id ? s.color : "var(--text2)",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Candidate Page ────────────────────────────────────────────────────

export function AddCandidatePage({ user, onDone }: { user: User; onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [brand, setBrand] = useState(BRAND_OPTIONS[0].id);
  const [source, setSource] = useState(SOURCE_OPTIONS[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) {
      setError("請填姓名");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/recruit-funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          brand,
          source,
          notes: notes.trim() || null,
          owner: user.email,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "新增失敗");
        setSubmitting(false);
        return;
      }
      onDone();
    } catch {
      setError("網路錯誤");
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">新增求職者</h1>
        <p className="text-[var(--text2)] text-sm">把新接觸到的求職者加入漏斗</p>
      </div>

      <div className="surface-elevated p-6 space-y-4">
        <div>
          <label className="block text-xs text-[var(--text2)] mb-1">姓名 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] outline-none focus:border-[var(--accent)]"
            placeholder="求職者姓名"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[var(--text2)] mb-1">電話</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] outline-none focus:border-[var(--accent)]"
              placeholder="09xx-xxx-xxx"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text2)] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] outline-none focus:border-[var(--accent)]"
              placeholder="example@mail.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[var(--text2)] mb-1">目標品牌 *</label>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] outline-none focus:border-[var(--accent)]"
            >
              {BRAND_OPTIONS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--text2)] mb-1">來源</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] outline-none focus:border-[var(--accent)]"
            >
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--text2)] mb-1">備註</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] outline-none focus:border-[var(--accent)]"
            placeholder="求職者背景 / 通電重點 / 意願評估"
          />
        </div>

        {error && <p className="text-[var(--red)] text-sm">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onDone}
            className="flex-1 py-3 rounded-xl font-semibold border border-[var(--border)] text-[var(--text2)]"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-[2] py-3 rounded-xl font-bold text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #f59e0b)` }}
          >
            {submitting ? "送出中..." : "加入漏斗"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Funnel Page ───────────────────────────────────────────────────────────

export function FunnelPage({ user }: { user: User }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCandidates(user.email).then((c) => {
      setCandidates(c);
      setLoading(false);
    });
  }, [user.email]);

  const total = candidates.length;
  const byStage: Record<string, Candidate[]> = {};
  STAGES.forEach((s) => (byStage[s.id] = []));
  candidates.forEach((c) => {
    if (!byStage[c.stage]) byStage[c.stage] = [];
    byStage[c.stage].push(c);
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">漏斗追蹤</h1>
        <p className="text-[var(--text2)] text-sm">按階段查看求職者流向</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--text3)]">載入中...</div>
      ) : total === 0 ? (
        <div className="surface-elevated py-12 text-center">
          <p className="text-4xl mb-2 opacity-60">🔻</p>
          <p className="text-sm text-[var(--text2)]">漏斗還是空的</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {STAGES.filter((s) => !["dropped", "rejected"].includes(s.id)).map((s) => {
              const items = byStage[s.id] || [];
              return (
                <div
                  key={s.id}
                  className="w-60 flex-shrink-0 bg-[var(--bg2)] rounded-xl border border-[var(--border)] flex flex-col max-h-[75vh]"
                >
                  <div
                    className="px-3 py-2 border-b-2 flex items-center justify-between"
                    style={{ borderBottomColor: s.color }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-xs font-bold">{s.label}</span>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white"
                      style={{ background: s.color }}
                    >
                      {items.length}
                    </span>
                  </div>
                  <div className="p-2 flex-1 overflow-y-auto space-y-2">
                    {items.length === 0 && (
                      <p className="text-[10px] text-[var(--text3)] text-center py-4 italic">空</p>
                    )}
                    {items.map((c) => (
                      <div
                        key={c.id}
                        className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2.5 hover:border-[var(--accent)] transition-all"
                      >
                        <p className="text-xs font-bold">{c.name}</p>
                        <p className="text-[10px] text-[var(--text3)] mt-0.5">
                          {BRAND_OPTIONS.find((b) => b.id === c.brand)?.label || c.brand}
                        </p>
                        {c.source && (
                          <p className="text-[10px] text-[var(--text3)] mt-0.5">來源 · {c.source}</p>
                        )}
                        <p className="text-[10px] text-[var(--text3)] mt-0.5">
                          {new Date(c.stage_entered_at || c.created_at).toLocaleDateString("zh-TW")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 已結束區塊 */}
      {(byStage.dropped?.length || byStage.rejected?.length) > 0 && (
        <div className="mt-6 surface-elevated p-5">
          <h3 className="text-sm font-bold mb-3">已結束</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[...(byStage.dropped || []), ...(byStage.rejected || [])].map((c) => {
              const si = stageInfo(c.stage);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2 p-2 bg-[var(--bg2)] rounded-lg border border-[var(--border)]"
                >
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                    style={{ background: `${si.color}20`, color: si.color }}
                  >
                    {si.label}
                  </span>
                  <span className="text-xs">{c.name}</span>
                  <span className="text-[10px] text-[var(--text3)] ml-auto">
                    {BRAND_OPTIONS.find((b) => b.id === c.brand)?.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

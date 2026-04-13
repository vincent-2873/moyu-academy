"use client";

import { useState, useEffect, useCallback } from "react";

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  brand: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
}

interface PipelineSummary {
  totalCandidates: number;
  byStage: Record<string, number>;
  thisWeekOutreach: number;
  thisWeekInterviews: number;
  thisWeekHires: number;
}

interface ClaudeAnalysis {
  analysis?: string;
  recommendation?: string;
  score?: { estimated: number; confidence: string };
  nextSteps?: string[];
  redFlags?: string[];
  greenFlags?: string[];
}

const STAGES = [
  { id: "new", label: "待處理", color: "#94a3b8" },
  { id: "contacted", label: "已發信", color: "#3b82f6" },
  { id: "invited", label: "已邀約", color: "#8b5cf6" },
  { id: "interview_1", label: "一面", color: "#f59e0b" },
  { id: "interview_2", label: "二面", color: "#ea580c" },
  { id: "offer", label: "Offer", color: "#16a34a" },
  { id: "onboarded", label: "報到", color: "#059669" },
  { id: "no_response", label: "未回覆", color: "#9ca3af" },
  { id: "rejected", label: "不合適", color: "#dc2626" },
  { id: "dropped", label: "放棄", color: "#6b7280" },
];

const PIPELINE_STEPS = [
  { num: "\u2460", label: "\u641c\u4eba", desc: "\u5230 104 / IG \u627e\u5230\u5c0d\u7684\u4eba", color: "#3b82f6", bg: "#eff6ff" },
  { num: "\u2461", label: "\u767c\u4fe1", desc: "\u767c\u4fe1\u4ef6\u6216\u81f4\u96fb\u9080\u7d04", color: "#8b5cf6", bg: "#f5f3ff" },
  { num: "\u2462", label: "\u8ffd\u8e64", desc: "\u78ba\u8a8d\u5c0d\u65b9\u662f\u5426\u56de\u8986", color: "#f59e0b", bg: "#fffbeb" },
  { num: "\u2463", label: "\u9762\u8a66", desc: "\u5b89\u6392\u9762\u8a66\u4e26\u8a55\u4f30", color: "#ea580c", bg: "#fff7ed" },
  { num: "\u2464", label: "\u9304\u53d6", desc: "\u767c Offer \u4e26\u5b8c\u6210\u5831\u5230", color: "#16a34a", bg: "#f0fdf4" },
];

export default function RecruitPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pipeline, setPipeline] = useState<{ summary: PipelineSummary; candidates: Candidate[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" | "info" } | null>(null);

  // Quick-add form
  const [qName, setQName] = useState("");
  const [qPhone, setQPhone] = useState("");
  const [qCity, setQCity] = useState("");
  const [qMethod, setQMethod] = useState("\u4fe1\u4ef6\u9080\u7d04");

  // AI analysis
  const [aiName, setAiName] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [aiResult, setAiResult] = useState<ClaudeAnalysis | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 招聘頁面用自己的 key，不跟 /me 衝突
    const stored = localStorage.getItem("moyu_recruit_email");
    if (stored) { setEmail(stored); setSubmitted(true); }
  }, []);

  const loadPipeline = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/recruit-pipeline", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) setPipeline({ summary: d.summary, candidates: d.candidates || [] });
    } finally { setLoading(false); }
  }, [email]);

  useEffect(() => { if (submitted) loadPipeline(); }, [submitted, loadPipeline]);

  const flash = (text: string, type: "ok" | "err" | "info" = "info") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    localStorage.setItem("moyu_recruit_email", email);
    setSubmitted(true);
  };

  // ── Login screen ──
  if (!submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a, #1e1b4b)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 32, maxWidth: 400, width: "100%", boxShadow: "0 20px 60px -20px rgba(0,0,0,0.4)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>墨宇招聘中心</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>輸入工作 Email 開始使用</div>
          </div>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
              style={{ padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#f8fafc" }} />
            <button type="submit" style={{ ...btnStyle, width: "100%" }}>進入招聘中心</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Data ──
  const summary = pipeline?.summary;
  const candidates = pipeline?.candidates || [];
  const recent = [...candidates].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);

  const todaySent = summary?.thisWeekOutreach ?? 0;
  const todayInvite = summary?.byStage?.["invited"] ?? 0;
  const weekInterview = summary?.thisWeekInterviews ?? 0;
  const weekHire = summary?.thisWeekHires ?? 0;

  // ── Actions ──
  const quickAdd = async () => {
    if (!qName) { flash("請填姓名", "err"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/recruit/auto-pipeline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateName: qName, phone: qPhone || null, city: qCity || null, inviteMethod: qMethod, recruiterName: email, jobType: "電銷業務", source: "104" }),
      });
      const d = await r.json();
      if (d.ok || d.success) { flash("已新增紀錄", "ok"); setQName(""); setQPhone(""); setQCity(""); loadPipeline(); }
      else flash(d.error || "新增失敗", "err");
    } catch { flash("網路錯誤", "err"); }
    finally { setBusy(false); }
  };

  const updateStage = async (id: string, stage: string) => {
    await fetch("/api/recruit/report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "candidate_update", recruitId: id, newStage: stage, recruiterEmail: email }),
    });
    loadPipeline();
  };

  const runAnalysis = async () => {
    if (!aiName || !aiNotes) { flash("請填姓名和面試筆記", "err"); return; }
    setBusy(true); setAiResult(null);
    try {
      const r = await fetch("/api/recruit/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze_candidate", candidateName: aiName, interviewNotes: aiNotes, recruiterEmail: email }),
      });
      const d = await r.json();
      if (d.ok) { setAiResult(d.analysis as ClaudeAnalysis); flash("分析完成", "ok"); }
      else flash(d.error || "分析失敗", "err");
    } catch { flash("網路錯誤", "err"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* ═══ Header ═══ */}
      <div style={{ background: "linear-gradient(135deg, #4338ca, #7c3aed)", padding: "20px 24px", color: "#fff" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>招聘工作台</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{email}</div>
          </div>
          <button onClick={() => { localStorage.removeItem("moyu_recruit_email"); setSubmitted(false); setEmail(""); }}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer" }}>
            登出
          </button>
        </div>
      </div>

      {/* ═══ Toast ═══ */}
      {msg && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 999, padding: "10px 20px", borderRadius: 10,
          background: msg.type === "ok" ? "#16a34a" : msg.type === "err" ? "#dc2626" : "#2563eb", color: "#fff", fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {msg.text}
        </div>
      )}

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px" }}>

        {/* ═══ SECTION: Pipeline Steps ═══ */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, overflowX: "auto" }}>
          {PIPELINE_STEPS.map((s) => (
            <div key={s.num} style={{ flex: 1, minWidth: 110, background: s.bg, border: `1.5px solid ${s.color}30`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.num}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* ═══ SECTION: 今天你要做什麼 ═══ */}
        <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "2px solid #f59e0b", borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#92400e", marginBottom: 12 }}>🔥 今天你要做這些事</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TodoItem
              done={todaySent >= 30}
              text={todaySent >= 30 ? `✅ 已發 ${todaySent} 封信 (達標！)` : `📨 發信至少 30 封 — 目前才 ${todaySent} 封，還差 ${Math.max(0, 30 - todaySent)} 封`}
              hint={todaySent < 30 ? "→ 打開 104 搜尋求職者，用信件邀約發出去" : ""}
            />
            <TodoItem
              done={todayInvite >= 3}
              text={todayInvite >= 3 ? `✅ 已邀約 ${todayInvite} 人 (達標！)` : `📞 邀約至少 3 人到面試 — 目前 ${todayInvite} 人`}
              hint={todayInvite < 3 ? "→ 打電話追蹤已發信的人，確認是否願意來面試" : ""}
            />
            <TodoItem
              done={false}
              text="📝 追蹤昨天發信的人有沒有回覆"
              hint="→ 到 104 招募管理 > 聯絡 > 查看昨天發的信有誰已讀/回覆"
            />
            <TodoItem
              done={false}
              text="📋 更新求職者狀態 — 有回覆的改成「已邀約」，沒回的標「未回覆」"
              hint="→ 在下面的紀錄清單裡，用下拉選單更新每個人的狀態"
            />
            {weekInterview > 0 && (
              <TodoItem
                done={false}
                text={`🪑 本週有 ${weekInterview} 場面試要準備`}
                hint="→ 確認面試時間、地點、面試官已通知"
              />
            )}
          </div>
        </div>

        {/* ═══ SECTION: KPI Dashboard ═══ */}
        <SectionHeader title="今日戰績" subtitle="你今天的關鍵數字，一眼看清楚進度" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          <KpiCard label="今日發信" value={todaySent} color="#3b82f6" />
          <KpiCard label="今日邀約" value={todayInvite} color="#8b5cf6" />
          <KpiCard label="本週面試" value={weekInterview} color="#f59e0b" />
          <KpiCard label="本週錄取" value={weekHire} color="#16a34a" />
        </div>

        {/* ═══ SECTION: Quick Add ═══ */}
        <SectionHeader title="✏️ 第二步：記錄你剛邀約的人" subtitle="在 104 發完信或打完電話後，在這裡填姓名和電話，系統會自動幫你記到 Google Sheet + 資料庫" />
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, marginBottom: 28, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="姓名 *" value={qName} onChange={setQName} placeholder="王小明" />
            <Field label="電話" value={qPhone} onChange={setQPhone} placeholder="0912-345-678" />
            <Field label="所在城市" value={qCity} onChange={setQCity} placeholder="台北" />
            <div>
              <div style={labelStyle}>邀約方式</div>
              <select value={qMethod} onChange={(e) => setQMethod(e.target.value)} style={inputStyle}>
                <option value="信件邀約">信件邀約</option>
                <option value="電話邀約">電話邀約</option>
                <option value="主動應徵">主動應徵</option>
                <option value="內推">內推</option>
                <option value="IG">IG</option>
                <option value="FB">FB</option>
              </select>
            </div>
          </div>
          <button onClick={quickAdd} disabled={busy} style={{ ...btnStyle, width: "100%", marginTop: 14 }}>
            {busy ? "新增中..." : "新增這筆邀約紀錄"}
          </button>
        </div>

        {/* ═══ SECTION: Stage Funnel ═══ */}
        {summary && Object.keys(summary.byStage).length > 0 && (
          <>
            <SectionHeader title="各階段人數" subtitle="目前所有求職者分布在哪個階段" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
              {STAGES.map((s) => {
                const count = summary.byStage[s.id] || 0;
                if (count === 0) return null;
                return (
                  <div key={s.id} style={{ padding: "8px 14px", borderRadius: 10, background: `${s.color}12`, border: `1.5px solid ${s.color}30`, fontSize: 13, fontWeight: 700, color: s.color }}>
                    {s.label} <span style={{ fontSize: 18, fontWeight: 900 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ═══ SECTION: Recent Activity ═══ */}
        <SectionHeader title="📋 第三步：追蹤這些人的進度" subtitle="每個人的狀態都要更新！有回覆的改成「已邀約」，面試完的改成「一面完成」，沒回的標「未回覆」" />
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 28, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          {loading && <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 20 }}>載入中...</div>}
          {!loading && recent.length === 0 && (
            <div style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: 32, lineHeight: 1.8 }}>
              還沒有紀錄<br />
              用上面的表單新增第一筆邀約吧
            </div>
          )}
          {recent.map((c, i) => {
            const stage = STAGES.find((s) => s.id === c.stage) || STAGES[0];
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px",
                borderBottom: i < recent.length - 1 ? "1px solid #f1f5f9" : "none", flexWrap: "wrap" }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${stage.color}15`, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 900, color: stage.color, flexShrink: 0 }}>
                  {c.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                    {c.source || ""}{c.source && c.brand ? " / " : ""}{c.brand || ""} {c.phone ? ` / ${c.phone}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>
                  {new Date(c.created_at).toLocaleDateString("zh-TW")}
                </div>
                <select value={c.stage} onChange={(e) => updateStage(c.id, e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${stage.color}`, background: `${stage.color}10`,
                    color: stage.color, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            );
          })}
        </div>

        {/* ═══ SECTION: AI Analysis ═══ */}
        <SectionHeader title="🧠 第四步：面試完讓 AI 幫你判斷" subtitle="把面試筆記或觀察貼進來，AI 會告訴你這個人適不適合、風險在哪、該不該錄取" />
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, marginBottom: 28, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <Field label="求職者姓名" value={aiName} onChange={setAiName} placeholder="王小明" />
          <div style={{ marginTop: 12 }}>
            <div style={labelStyle}>面試筆記 / 觀察重點</div>
            <textarea value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} rows={6}
              placeholder={"例：口條不錯，3 年保險經驗。\n情境模擬：問他怎麼處理客戶拒絕 → 回答有條理。\n但薪資期望偏高，穩定度待確認。"}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }} />
          </div>
          <button onClick={runAnalysis} disabled={busy || !aiName || !aiNotes} style={{ ...btnStyle, width: "100%", marginTop: 14, background: busy ? "#94a3b8" : "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
            {busy ? "AI 分析中，約需 15 秒..." : "開始 AI 分析"}
          </button>

          {aiResult && (
            <div style={{ marginTop: 20, padding: 16, background: "linear-gradient(135deg, #f0f9ff, #ede9fe)", border: "1px solid #a5b4fc", borderRadius: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#312e81", marginBottom: 10 }}>
                分析結果 {aiResult.recommendation ? `\u2014 ${aiResult.recommendation}` : ""}
                {aiResult.score ? ` (${aiResult.score.estimated}/100)` : ""}
              </div>
              {aiResult.analysis && (
                <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.8, marginBottom: 12, whiteSpace: "pre-wrap" }}>{aiResult.analysis}</div>
              )}
              {aiResult.greenFlags && aiResult.greenFlags.length > 0 && (
                <FlagList title="優勢" items={aiResult.greenFlags} color="#16a34a" />
              )}
              {aiResult.redFlags && aiResult.redFlags.length > 0 && (
                <FlagList title="風險警示" items={aiResult.redFlags} color="#dc2626" />
              )}
              {aiResult.nextSteps && aiResult.nextSteps.length > 0 && (
                <FlagList title="建議下一步" items={aiResult.nextSteps} color="#2563eb" />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px 0 40px", fontSize: 12, color: "#cbd5e1" }}>
          墨宇招聘中心 v2
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "16px 12px", textAlign: "center",
      borderTop: `3px solid ${color}`, border: `1px solid #e2e8f0`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function TodoItem({ done, text, hint }: { done: boolean; text: string; hint: string }) {
  return (
    <div style={{ background: done ? "#f0fdf4" : "#fff", border: done ? "1px solid #86efac" : "1px solid #fbbf24", borderRadius: 12, padding: "12px 16px" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: done ? "#16a34a" : "#92400e", lineHeight: 1.5 }}>{text}</div>
      {hint && <div style={{ fontSize: 13, color: "#78716c", marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

function FlagList({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 4 }}>{title}</div>
      {items.map((item, i) => (
        <div key={i} style={{ fontSize: 13, color: "#334155", paddingLeft: 14, lineHeight: 1.8 }}>- {item}</div>
      ))}
    </div>
  );
}

/* ── Shared styles ── */

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0",
  fontSize: 14, background: "#f8fafc", boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  padding: "14px", borderRadius: 12, border: "none",
  background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff",
  fontSize: 14, fontWeight: 700, cursor: "pointer",
  boxShadow: "0 6px 16px -6px rgba(79,70,229,0.4)",
};

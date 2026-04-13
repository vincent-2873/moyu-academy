"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * 招聘員前台 — /recruit
 *
 * moyuhunt brand 的人進來看這個，不是業務的 /me
 *
 * 功能：
 *   1. Pipeline 總覽 (今日/本週/本月 活動量 + 積分)
 *   2. 求職者清單 + 狀態追蹤
 *   3. 新增求職者
 *   4. 每日回報 (發信/邀約/面試/錄取)
 *   5. Claude 分析求職者 (丟筆記或錄音)
 *   6. 面試建議 (問 Claude 該問什麼)
 */

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
  { id: "contacted", label: "已發信/致電", color: "#3b82f6" },
  { id: "invited", label: "已邀約面試", color: "#8b5cf6" },
  { id: "interview_1", label: "一面完成", color: "#f59e0b" },
  { id: "interview_2", label: "二面完成", color: "#ea580c" },
  { id: "offer", label: "已發 Offer", color: "#16a34a" },
  { id: "onboarded", label: "已報到", color: "#059669" },
  { id: "no_response", label: "未回覆", color: "#9ca3af" },
  { id: "rejected", label: "不合適", color: "#dc2626" },
  { id: "dropped", label: "求職者放棄", color: "#6b7280" },
];

export default function RecruitPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pipeline, setPipeline] = useState<{ summary: PipelineSummary; candidates: Candidate[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pipeline" | "add" | "report" | "analyze">("pipeline");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Add candidate form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSource, setNewSource] = useState("104");
  const [newBrand, setNewBrand] = useState("nschool");
  const [newPosition, setNewPosition] = useState("電銷業務");

  // Daily report form
  const [rptSent, setRptSent] = useState(0);
  const [rptCalls, setRptCalls] = useState(0);
  const [rptInvites, setRptInvites] = useState(0);
  const [rptInterviews, setRptInterviews] = useState(0);
  const [rptOffers, setRptOffers] = useState(0);
  const [rptHires, setRptHires] = useState(0);

  // Claude analysis
  const [analyzeTarget, setAnalyzeTarget] = useState("");
  const [analyzeNotes, setAnalyzeNotes] = useState("");
  const [analysisResult, setAnalysisResult] = useState<ClaudeAnalysis | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("moyu_employee_email") || sessionStorage.getItem("moyu_current_user");
    if (stored) {
      setEmail(stored);
      setSubmitted(true);
    }
  }, []);

  const loadPipeline = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/recruit-pipeline", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) setPipeline({ summary: d.summary, candidates: d.candidates || [] });
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (submitted) loadPipeline();
  }, [submitted, loadPipeline]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    localStorage.setItem("moyu_employee_email", email);
    sessionStorage.setItem("moyu_current_user", email);
    setSubmitted(true);
  };

  // ── Login screen ──
  if (!submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a, #1e1b4b)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#ffffff", borderRadius: 20, padding: 32, maxWidth: 400, width: "100%", boxShadow: "0 20px 60px -20px rgba(0,0,0,0.4)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>墨宇戰情中樞 · 招聘</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>輸入你的工作 email，開始招聘</div>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{ padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#f8fafc" }}
              />
              <button
                type="submit"
                style={{ padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                進入招聘中心 →
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Main recruit dashboard ──
  const summary = pipeline?.summary;
  const candidates = pipeline?.candidates || [];

  const addCandidate = async () => {
    if (!newName) { setMsg("請填求職者姓名"); return; }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/recruit-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_candidate",
          name: newName,
          email: newEmail || null,
          phone: newPhone || null,
          source: newSource,
          brand: newBrand,
          position: newPosition,
          owner_email: email,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setMsg("✅ 求職者已新增");
        setNewName(""); setNewEmail(""); setNewPhone("");
        loadPipeline();
      } else {
        setMsg(`❌ ${d.error}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/recruit/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "daily_report",
          recruiterEmail: email,
          sentCount: rptSent,
          callCount: rptCalls,
          inviteCount: rptInvites,
          interviewCount: rptInterviews,
          offerCount: rptOffers,
          hireCount: rptHires,
        }),
      });
      const d = await r.json();
      setMsg(d.message || (d.ok ? "✅ 回報成功" : `❌ ${d.error}`));
    } finally {
      setBusy(false);
    }
  };

  const analyzeCandidate = async () => {
    if (!analyzeTarget || !analyzeNotes) { setMsg("請填求職者名字 + 面試筆記"); return; }
    setBusy(true);
    setMsg(null);
    setAnalysisResult(null);
    try {
      const r = await fetch("/api/recruit/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze_candidate",
          candidateName: analyzeTarget,
          interviewNotes: analyzeNotes,
          recruiterEmail: email,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setAnalysisResult(d.analysis as ClaudeAnalysis);
        setMsg("✅ 分析完成");
      } else {
        setMsg(`❌ ${d.error}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const updateStage = async (id: string, stage: string) => {
    await fetch("/api/recruit/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "candidate_update", recruitId: id, newStage: stage, recruiterEmail: email }),
    });
    loadPipeline();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e1b4b, #4c1d95)", padding: "20px 28px", color: "#fff", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>🎯 墨宇招聘中心</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{email}</div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { localStorage.removeItem("moyu_employee_email"); sessionStorage.removeItem("moyu_current_user"); setSubmitted(false); }}
          style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 12, cursor: "pointer" }}
        >
          登出
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        {([
          { id: "pipeline", label: "📋 邀約紀錄", icon: "" },
          { id: "add", label: "➕ 新增求職者", icon: "" },
          { id: "report", label: "📝 今日回報", icon: "" },
          { id: "analyze", label: "🧠 AI 面試分析", icon: "" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: "14px 16px",
              border: "none",
              borderBottom: activeTab === tab.id ? "3px solid #4f46e5" : "3px solid transparent",
              background: activeTab === tab.id ? "rgba(79,70,229,0.05)" : "transparent",
              color: activeTab === tab.id ? "#4f46e5" : "#64748b",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Message bar */}
      {msg && (
        <div style={{ margin: "16px 20px 0", padding: "10px 14px", background: msg.startsWith("✅") ? "rgba(34,197,94,0.1)" : msg.startsWith("🔴") || msg.startsWith("❌") ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)", borderRadius: 10, fontSize: 13, color: msg.startsWith("✅") ? "#16a34a" : msg.startsWith("❌") || msg.startsWith("🔴") ? "#dc2626" : "#1d4ed8" }}>
          {msg}
        </div>
      )}

      <div style={{ padding: "20px", maxWidth: 1000, margin: "0 auto" }}>
        {/* ═══ Pipeline Tab ═══ */}
        {activeTab === "pipeline" && (
          <>
            {/* Summary cards */}
            {summary && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
                <SummaryCard label="邀約總數" value={summary.totalCandidates} color="#4f46e5" />
                <SummaryCard label="本週發信/致電" value={summary.thisWeekOutreach} color="#3b82f6" />
                <SummaryCard label="本週面試" value={summary.thisWeekInterviews} color="#f59e0b" />
                <SummaryCard label="本週報到" value={summary.thisWeekHires} color="#16a34a" />
              </div>
            )}

            {/* Stage funnel */}
            {summary && Object.keys(summary.byStage).length > 0 && (
              <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>📊 各階段人數</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {STAGES.map((s) => {
                    const count = summary.byStage[s.id] || 0;
                    if (count === 0) return null;
                    return (
                      <div key={s.id} style={{ padding: "6px 12px", borderRadius: 8, background: `${s.color}15`, border: `1px solid ${s.color}33`, fontSize: 12, fontWeight: 700, color: s.color }}>
                        {s.label} {count}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Candidate list */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
                👥 邀約紀錄 ({candidates.length} 筆)
              </div>
              {loading && <div style={{ color: "#94a3b8", fontSize: 13 }}>載入中...</div>}
              {!loading && candidates.length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 20 }}>
                  還沒有邀約紀錄<br />
                  去 104 找到人 → 點上面「➕ 新增求職者」記錄邀約
                </div>
              )}
              {candidates.map((c) => {
                const stage = STAGES.find((s) => s.id === c.stage) || STAGES[0];
                return (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f5f9",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        {c.source || "—"} · {c.brand || "—"} · {new Date(c.created_at).toLocaleDateString("zh-TW")}
                      </div>
                    </div>
                    <select
                      value={c.stage}
                      onChange={(e) => updateStage(c.id, e.target.value)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: `1.5px solid ${stage.color}`,
                        background: `${stage.color}10`,
                        color: stage.color,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {STAGES.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ═══ Add Candidate Tab ═══ */}
        {activeTab === "add" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>➕ 新增邀約紀錄</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
              從 104 找到人之後，在這裡記錄邀約。對應 Google Sheet「招募紀錄表」的格式。
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InputField label="姓名 *" value={newName} onChange={setNewName} placeholder="王小明" />
              <InputField label="電話" value={newPhone} onChange={setNewPhone} placeholder="0912-345-678" />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>經銷據點/組別</div>
                <select value={newBrand} onChange={(e) => setNewBrand(e.target.value)} style={selectStyle}>
                  <option value="nschool">nSchool 財經學院</option>
                  <option value="xuemi">XUEMI 學米</option>
                  <option value="ooschool">無限學院</option>
                  <option value="aischool">AI 未來學院</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>邀約方式</div>
                <select value={newSource} onChange={(e) => setNewSource(e.target.value)} style={selectStyle}>
                  <option value="信件邀約">信件邀約</option>
                  <option value="電話邀約">電話邀約</option>
                  <option value="主動應徵">主動應徵</option>
                  <option value="內推">內推</option>
                  <option value="IG">IG</option>
                  <option value="FB">FB</option>
                </select>
              </div>
              <InputField label="Email" value={newEmail} onChange={setNewEmail} placeholder="email@example.com" />
              <InputField label="應徵職位" value={newPosition} onChange={setNewPosition} placeholder="電銷業務" />
            </div>
            <button onClick={addCandidate} disabled={busy} style={{ ...btnPrimary, marginTop: 16, width: "100%" }}>
              {busy ? "新增中..." : "新增邀約紀錄"}
            </button>
          </div>
        )}

        {/* ═══ Daily Report Tab ═══ */}
        {activeTab === "report" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>📝 今日活動量回報</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
              每日最低積分 6 分 · 邀約 0.5 · 面試 1.0 · 錄取 0.5 · 報到 2.0
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <NumField label="📨 發信數" value={rptSent} onChange={setRptSent} />
              <NumField label="📞 致電數" value={rptCalls} onChange={setRptCalls} />
              <NumField label="📅 邀約成功" value={rptInvites} onChange={setRptInvites} />
              <NumField label="🪑 面試出席" value={rptInterviews} onChange={setRptInterviews} />
              <NumField label="✅ 錄取" value={rptOffers} onChange={setRptOffers} />
              <NumField label="🎓 報到" value={rptHires} onChange={setRptHires} />
            </div>
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 10, fontSize: 13, color: "#475569" }}>
              預估積分: <strong>{(rptInvites * 0.5 + rptInterviews * 1.0 + rptOffers * 0.5 + rptHires * 2.0).toFixed(1)}</strong> / 6.0
              {(rptInvites * 0.5 + rptInterviews * 1.0 + rptOffers * 0.5 + rptHires * 2.0) >= 6 ? " ✅ 達標" : " 🔴 未達標"}
            </div>
            <button onClick={submitReport} disabled={busy} style={{ ...btnPrimary, marginTop: 16, width: "100%" }}>
              {busy ? "回報中..." : "送出今日回報"}
            </button>
          </div>
        )}

        {/* ═══ Claude Analysis Tab ═══ */}
        {activeTab === "analyze" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>🧠 AI 面試分析</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
              面試完把筆記貼進來 → AI 幫你判斷這個人適不適合 + 要注意什麼 + 建議錄取/不錄取
            </div>
            <InputField label="求職者姓名" value={analyzeTarget} onChange={setAnalyzeTarget} placeholder="王小明" />
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>面試筆記 / 通話內容</div>
              <textarea
                value={analyzeNotes}
                onChange={(e) => setAnalyzeNotes(e.target.value)}
                placeholder="口條不錯，3年保險經驗。情境模擬：賣梳子給和尚 → 想了10秒說不出來..."
                rows={8}
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, resize: "vertical", background: "#f8fafc", boxSizing: "border-box" }}
              />
            </div>
            <button onClick={analyzeCandidate} disabled={busy || !analyzeTarget || !analyzeNotes} style={{ ...btnPrimary, marginTop: 16, width: "100%" }}>
              {busy ? "AI 分析中 (約 15 秒)..." : "🧠 分析這個人適不適合"}
            </button>

            {/* Analysis result */}
            {analysisResult && (
              <div style={{ marginTop: 20, padding: 16, background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)", border: "1px solid #7dd3fc", borderRadius: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#0c4a6e", marginBottom: 8 }}>
                  分析結果 — {analysisResult.recommendation || ""}
                  {analysisResult.score && ` · ${analysisResult.score.estimated}/100 (${analysisResult.score.confidence})`}
                </div>
                {analysisResult.analysis && (
                  <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.7, marginBottom: 10, whiteSpace: "pre-wrap" }}>
                    {analysisResult.analysis}
                  </div>
                )}
                {analysisResult.greenFlags && analysisResult.greenFlags.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>🟢 優勢</div>
                    {analysisResult.greenFlags.map((f, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#166534", paddingLeft: 12 }}>· {f}</div>
                    ))}
                  </div>
                )}
                {analysisResult.redFlags && analysisResult.redFlags.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>🔴 風險</div>
                    {analysisResult.redFlags.map((f, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#991b1b", paddingLeft: 12 }}>· {f}</div>
                    ))}
                  </div>
                )}
                {analysisResult.nextSteps && analysisResult.nextSteps.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>📋 下一步</div>
                    {analysisResult.nextSteps.map((s, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#1e40af", paddingLeft: 12 }}>· {s}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small components ──

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${color}33`, borderRadius: 14, padding: "14px 16px", borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, background: "#f8fafc", boxSizing: "border-box" }}
      />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 16, fontWeight: 700, background: "#f8fafc", textAlign: "center", boxSizing: "border-box" }}
      />
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "14px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 8px 20px -8px rgba(79,70,229,0.4)",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1.5px solid #e2e8f0",
  fontSize: 13,
  background: "#f8fafc",
  boxSizing: "border-box",
};

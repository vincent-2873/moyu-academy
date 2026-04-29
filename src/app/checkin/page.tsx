"use client";

import { useState, useEffect } from "react";

/**
 * 強制 daily check-in 頁面
 *
 * 違反人性原則：
 * - 不能跳過
 * - 量化分數 1-10（不接受「還可以」）
 * - 必填「最逃避的事」「今天會做的具體動作」
 */

interface User {
  email: string;
  name: string;
}

export default function CheckinPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<string | null>(null);

  // Form state
  const [energy, setEnergy] = useState(5);
  const [mood, setMood] = useState(5);
  const [comfort, setComfort] = useState(5);
  const [avoidance, setAvoidance] = useState("");
  const [todayCommit, setTodayCommit] = useState("");
  const [breakthroughAction, setBreakthroughAction] = useState("");

  useEffect(() => {
    const userData = sessionStorage.getItem("user") || localStorage.getItem("user");
    if (!userData) {
      setLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(userData);
      setUser({ email: parsed.email, name: parsed.name });
      // Check if already checked in today
      fetch(`/api/human-state?email=${encodeURIComponent(parsed.email)}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.has_checked_in) setHasCheckedIn(true);
        })
        .finally(() => setLoading(false));
    } catch {
      setLoading(false);
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (avoidance.length < 5) {
      setError("「最逃避的事」至少寫 5 個字 — 系統不接受敷衍");
      return;
    }
    if (todayCommit.length < 5) {
      setError("「今天會做的事」必須具體 — 不能寫「努力」「加油」這種空話");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/human-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: user.email,
          energy,
          mood,
          comfort_level: comfort,
          avoidance,
          today_commit: todayCommit,
          breakthrough_action: breakthroughAction || null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setAiScore(json.ai_score);
      setHasCheckedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失敗");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Center><div style={{ color: "#888" }}>載入中...</div></Center>;
  }

  if (!user) {
    return (
      <Center>
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 12, padding: 24, color: "#ef4444", maxWidth: 400 }}>
          需要先登入才能 check-in
          <br />
          <a href="/" style={{ color: "#fbbf24", marginTop: 8, display: "inline-block" }}>← 回登入頁</a>
        </div>
      </Center>
    );
  }

  if (hasCheckedIn) {
    return (
      <Center>
        <div style={{ background: "var(--card, #1a1f2e)", border: "1px solid var(--border, #2a2f3e)", borderRadius: 16, padding: 32, maxWidth: 500, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>今天已 check-in</div>
          {aiScore && (
            <div style={{
              marginTop: 12,
              padding: "12px 16px",
              background: aiScore.startsWith("red") ? "rgba(239,68,68,0.13)" : aiScore.startsWith("yellow") ? "rgba(251,191,36,0.13)" : "rgba(34,197,94,0.13)",
              border: `1px solid ${aiScore.startsWith("red") ? "#ef4444" : aiScore.startsWith("yellow") ? "#fbbf24" : "#22c55e"}`,
              borderRadius: 10,
              fontSize: 13,
              color: "#fff",
            }}>
              {aiScore === "red_too_comfortable" && "🔴 系統判定：太舒適了，今天必須做一件痛但有效的事"}
              {aiScore === "red_no_real_avoidance" && "🔴 系統判定：你沒有誠實面對逃避，重新填寫"}
              {aiScore === "yellow_low_energy" && "🟡 能量偏低 — 但這不是擺爛的理由"}
              {aiScore === "green" && "🟢 狀態正常 — 繼續執行今天承諾的動作"}
            </div>
          )}
          <a href="/" style={{ display: "inline-block", marginTop: 20, padding: "10px 20px", background: "#667eea", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
            進入系統
          </a>
        </div>
      </Center>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #0a0e1a)", color: "var(--text, #fff)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: "var(--color-clay)", fontFamily: "var(--font-jetbrains-mono), monospace", fontWeight: 600, marginBottom: 8 }}>
            DAILY · CHECK-IN
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--color-ink)", fontFamily: "var(--font-noto-serif-tc), serif", letterSpacing: "0.02em" }}>
            每日狀態盤查
          </div>
          <div style={{ color: "var(--color-ink-2)", fontSize: 14, marginTop: 8 }}>
            不填完不能進系統 · 不接受敷衍 · 不接受「還可以」
          </div>
          <div style={{ marginTop: 16, height: 1, width: "100%", background: "linear-gradient(90deg, var(--color-paper-3) 0%, var(--color-paper-3) 30%, var(--color-gold) 30%, var(--color-gold) 35%, var(--color-paper-3) 35%, var(--color-paper-3) 100%)" }} />
        </div>

        <form onSubmit={submit} style={{ background: "var(--card, #1a1f2e)", border: "1px solid var(--border, #2a2f3e)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 22 }}>
          <ScoreSlider label="能量（1=瀕死，10=爆滿）" value={energy} onChange={setEnergy} />
          <ScoreSlider label="心情（1=爛透，10=超好）" value={mood} onChange={setMood} />
          <ScoreSlider label="舒適度（1=很痛苦，10=躺著爽）⚠️ 越高越糟" value={comfort} onChange={setComfort} warningHigh />

          <div>
            <label style={{ fontSize: 13, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
              ❌ 你今天最想逃避的事是什麼？（誠實寫，至少 5 字）
            </label>
            <textarea
              value={avoidance}
              onChange={(e) => setAvoidance(e.target.value)}
              required
              minLength={5}
              rows={2}
              placeholder="例如：打給上週拒絕的客戶、跟主管報告失敗的案子"
              style={{ width: "100%", background: "#0a0e1a", border: "1px solid #2a2f3e", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
              ✅ 今天會做的具體動作（寫具體不要寫「努力」這種廢話）
            </label>
            <textarea
              value={todayCommit}
              onChange={(e) => setTodayCommit(e.target.value)}
              required
              minLength={5}
              rows={2}
              placeholder="例如：12 點前打 10 通、下午跟 A 客戶面談、晚上交對練錄音"
              style={{ width: "100%", background: "#0a0e1a", border: "1px solid #2a2f3e", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: "#cbd5e1", display: "block", marginBottom: 6 }}>
              🚀 一件突破舒適圈的事（可選）
            </label>
            <input
              value={breakthroughAction}
              onChange={(e) => setBreakthroughAction(e.target.value)}
              placeholder="例如：第一次主動 cold call 大客戶"
              style={{ width: "100%", background: "#0a0e1a", border: "1px solid #2a2f3e", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.13)", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 12px", color: "#ef4444", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-ink-fill"
            style={{
              background: submitting ? "var(--color-paper-2)" : "var(--color-paper-2)",
              color: submitting ? "var(--color-ink-3)" : "var(--color-ink)",
              border: "1px solid var(--color-ink)",
              borderRadius: 4,
              padding: 14,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              cursor: submitting ? "wait" : "pointer",
              marginTop: 4,
              letterSpacing: "0.05em",
            }}
          >
            {submitting ? "提交中..." : "提交盤查"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ScoreSlider({ label, value, onChange, warningHigh }: { label: string; value: number; onChange: (v: number) => void; warningHigh?: boolean }) {
  const color = warningHigh
    ? value >= 8 ? "#ef4444" : value >= 6 ? "#f97316" : "#22c55e"
    : value <= 3 ? "#ef4444" : value <= 5 ? "#f97316" : "#22c55e";
  return (
    <div>
      <label style={{ fontSize: 13, color: "#cbd5e1", display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span>{label}</span>
        <span style={{ color, fontWeight: 700, fontSize: 18 }}>{value}</span>
      </label>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color }}
      />
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #0a0e1a)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {children}
    </div>
  );
}

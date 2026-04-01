"use client";

import React, { useState, useMemo, CSSProperties } from "react";

interface MentorFeedbackFormProps {
  traineeEmail: string;
  traineeName: string;
  mentorEmail: string;
  day: number;
  callTarget: number;
  onSubmit?: () => void;
}

export default function MentorFeedbackForm({
  traineeEmail,
  traineeName,
  mentorEmail,
  day,
  callTarget,
  onSubmit,
}: MentorFeedbackFormProps) {
  const [actualCalls, setActualCalls] = useState("");
  const [invites, setInvites] = useState("");
  const [demos, setDemos] = useState("");
  const [strength1, setStrength1] = useState("");
  const [strength2, setStrength2] = useState("");
  const [improvement, setImprovement] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const targetRate = useMemo(() => {
    const calls = Number(actualCalls) || 0;
    if (callTarget <= 0) return 0;
    return Math.round((calls / callTarget) * 100);
  }, [actualCalls, callTarget]);

  const hitTarget = targetRate >= 100;

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        trainee_email: traineeEmail,
        mentor_email: mentorEmail,
        day,
        date: today,
        call_target: callTarget,
        actual_calls: Number(actualCalls) || 0,
        target_rate: targetRate,
        invites: Number(invites) || 0,
        demos: Number(demos) || 0,
        strength_1: strength1,
        strength_2: strength2,
        improvement,
      };

      const res = await fetch("/api/mentor-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "提交失敗");
      }

      setToast("回饋已成功提交！");
      setTimeout(() => setToast(null), 3000);
      onSubmit?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "提交失敗，請重試";
      setToast(message);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  // ── Styles ──────────────────────────────────────────

  const card: CSSProperties = {
    background: "var(--card, #1e1e2e)",
    border: "1px solid var(--border, #2e2e3e)",
    borderRadius: 12,
    padding: 28,
    maxWidth: 520,
    width: "100%",
    margin: "0 auto",
    color: "var(--text, #e0e0e0)",
    fontFamily: "inherit",
  };

  const header: CSSProperties = {
    marginBottom: 24,
  };

  const title: CSSProperties = {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--text, #e0e0e0)",
    margin: 0,
  };

  const subtitle: CSSProperties = {
    fontSize: 14,
    color: "var(--text2, #a0a0b0)",
    marginTop: 6,
  };

  const sectionLabel: CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text, #e0e0e0)",
    marginBottom: 10,
    marginTop: 20,
  };

  const grid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  };

  const inputGroup: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };

  const label: CSSProperties = {
    fontSize: 12,
    color: "var(--text3, #808090)",
    fontWeight: 500,
  };

  const input: CSSProperties = {
    background: "var(--bg2, #16161e)",
    border: "1px solid var(--border, #2e2e3e)",
    borderRadius: 8,
    padding: "8px 12px",
    color: "var(--text, #e0e0e0)",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  const textarea: CSSProperties = {
    ...input,
    minHeight: 72,
    resize: "vertical",
    lineHeight: 1.5,
  };

  const rateChip: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    background: hitTarget
      ? "rgba(74,222,128,0.12)"
      : "rgba(248,113,113,0.12)",
    color: hitTarget
      ? "var(--green, #4ade80)"
      : "var(--red, #f87171)",
    marginTop: 8,
  };

  const btn: CSSProperties = {
    marginTop: 24,
    width: "100%",
    padding: "12px 0",
    borderRadius: 8,
    border: "none",
    background: loading
      ? "var(--border, #2e2e3e)"
      : "var(--accent, #6366f1)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    transition: "background 0.2s",
  };

  const toastStyle: CSSProperties = {
    position: "fixed",
    bottom: 24,
    right: 24,
    background: "var(--teal, #2dd4bf)",
    color: "#000",
    padding: "12px 20px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    zIndex: 9999,
    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
  };

  // ── Render ──────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} style={card}>
      {/* Header */}
      <div style={header}>
        <h2 style={title}>每日 1:1 輔導紀錄</h2>
        <div style={subtitle}>
          Day {day} &middot; 新人: {traineeName} &middot; 導師: {mentorEmail}
        </div>
      </div>

      {/* Data section */}
      <div style={sectionLabel}>📊 數據</div>
      <div style={grid}>
        <div style={inputGroup}>
          <span style={label}>通次（實際）</span>
          <input
            type="number"
            min={0}
            style={input}
            value={actualCalls}
            onChange={(e) => setActualCalls(e.target.value)}
            placeholder="0"
          />
        </div>
        <div style={inputGroup}>
          <span style={label}>目標</span>
          <div
            style={{
              ...input,
              background: "transparent",
              border: "1px solid var(--border, #2e2e3e)",
              color: "var(--text3, #808090)",
            }}
          >
            {callTarget}
          </div>
        </div>
        <div style={inputGroup}>
          <span style={label}>邀約</span>
          <input
            type="number"
            min={0}
            style={input}
            value={invites}
            onChange={(e) => setInvites(e.target.value)}
            placeholder="0"
          />
        </div>
        <div style={inputGroup}>
          <span style={label}>Demo</span>
          <input
            type="number"
            min={0}
            style={input}
            value={demos}
            onChange={(e) => setDemos(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Target rate indicator */}
      <div style={rateChip}>
        <span>{hitTarget ? "●" : "●"}</span>
        達標率 {targetRate}%
      </div>

      {/* Strengths */}
      <div style={sectionLabel}>✅ 優點 1（具體行為）</div>
      <textarea
        style={textarea}
        value={strength1}
        onChange={(e) => setStrength1(e.target.value)}
        placeholder="例：開場白語氣自然，客戶沒有馬上掛電話"
      />

      <div style={sectionLabel}>✅ 優點 2（心態/細節）</div>
      <textarea
        style={textarea}
        value={strength2}
        onChange={(e) => setStrength2(e.target.value)}
        placeholder="例：被拒絕後仍保持正面態度，馬上撥下一通"
      />

      {/* Improvement */}
      <div style={sectionLabel}>💡 改善建議（限 1 項）</div>
      <textarea
        style={textarea}
        value={improvement}
        onChange={(e) => setImprovement(e.target.value)}
        placeholder="例：結尾可以更明確邀約時間，改成「您看週三或週四哪天方便？」"
      />

      {/* Submit */}
      <button type="submit" style={btn} disabled={loading}>
        {loading ? "提交中..." : "提交回饋"}
      </button>

      {/* Toast */}
      {toast && <div style={toastStyle}>{toast}</div>}
    </form>
  );
}

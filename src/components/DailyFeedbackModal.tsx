"use client";

import React, { useState, useEffect, useCallback } from "react";

interface DailyFeedbackModalProps {
  userEmail: string;
  userName: string;
  brandId: string;
  onSubmitted: () => void;
  onSkip: () => void;
  /** Work schedule from system settings */
  workEndTime: string; // e.g. "18:00"
}

interface FeedbackForm {
  actual_calls: string;
  valid_calls: string;
  invites: string;
  demos: string;
  closures: string;
  call_target: string;
  strength_1: string;
  strength_2: string;
  improvement: string;
  mood: number; // 1-5
  notes: string;
}

const MOODS = [
  { emoji: "😫", label: "很差" },
  { emoji: "😕", label: "不太好" },
  { emoji: "😐", label: "普通" },
  { emoji: "🙂", label: "不錯" },
  { emoji: "🔥", label: "超棒" },
];

export default function DailyFeedbackModal({
  userEmail,
  userName,
  brandId,
  onSubmitted,
  onSkip,
  workEndTime,
}: DailyFeedbackModalProps) {
  const [form, setForm] = useState<FeedbackForm>({
    actual_calls: "",
    valid_calls: "",
    invites: "",
    demos: "",
    closures: "",
    call_target: "",
    strength_1: "",
    strength_2: "",
    improvement: "",
    mood: 3,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 2 steps: data + reflection

  const today = new Date().toISOString().slice(0, 10);
  const dayOfTraining = Math.ceil(
    (Date.now() - new Date(today).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
  );

  const handleSubmit = async () => {
    if (!form.actual_calls) return;
    setSubmitting(true);
    try {
      await fetch("/api/mentor-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainee_email: userEmail,
          mentor_email: "",
          day: dayOfTraining,
          date: today,
          call_target: Number(form.call_target) || 0,
          actual_calls: Number(form.actual_calls) || 0,
          target_rate: Number(form.valid_calls) || 0,
          invites: Number(form.invites) || 0,
          demos: Number(form.demos) || 0,
          strength_1: form.strength_1,
          strength_2: form.strength_2,
          improvement: form.improvement,
          mood: form.mood,
          notes: form.notes,
        }),
      });
      // Mark as submitted today in localStorage
      localStorage.setItem(`feedback_${userEmail}_${today}`, "submitted");
      onSubmitted();
    } catch {
      alert("提交失敗，請稍後再試");
    }
    setSubmitting(false);
  };

  const update = (field: keyof FeedbackForm, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          width: "90%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflow: "auto",
          padding: 28,
          position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📝</div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>
            {userName}，辛苦了！
          </h2>
          <p style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>
            下班前請填寫今日工作回饋 — {today}
          </p>
        </div>

        {step === 1 ? (
          <>
            {/* Step 1: Data Entry */}
            <div style={{ marginBottom: 20 }}>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: "var(--accent)",
                }}
              >
                今日數據
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {([
                  { key: "actual_calls" as const, label: "撥打通數 *", placeholder: "0" },
                  { key: "valid_calls" as const, label: "有效通數", placeholder: "0" },
                  { key: "call_target" as const, label: "目標通數", placeholder: "100" },
                  { key: "invites" as const, label: "邀約數", placeholder: "0" },
                  { key: "demos" as const, label: "DEMO 數", placeholder: "0" },
                  { key: "closures" as const, label: "成交數", placeholder: "0" },
                ]).map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 4 }}>{f.label}</label>
                    <input type="number" value={form[f.key]} onChange={(e) => update(f.key, e.target.value)} placeholder={f.placeholder}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)", fontSize: 16, fontWeight: 700, textAlign: "center" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div style={{ marginBottom: 20 }}>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: "var(--accent)",
                }}
              >
                今天心情如何？
              </h3>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                {MOODS.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => update("mood", i + 1)}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 12,
                      border:
                        form.mood === i + 1
                          ? "2px solid var(--accent)"
                          : "1px solid var(--border)",
                      background:
                        form.mood === i + 1 ? "var(--bg2)" : "transparent",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ fontSize: 24 }}>{m.emoji}</div>
                    <div
                      style={{
                        fontSize: 10,
                        color:
                          form.mood === i + 1
                            ? "var(--accent)"
                            : "var(--text3)",
                        marginTop: 2,
                      }}
                    >
                      {m.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!form.actual_calls}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                background: form.actual_calls
                  ? "linear-gradient(135deg, var(--accent), var(--teal))"
                  : "var(--border)",
                color: form.actual_calls ? "white" : "var(--text3)",
                fontWeight: 700,
                fontSize: 15,
                border: "none",
                cursor: form.actual_calls ? "pointer" : "not-allowed",
              }}
            >
              下一步 →
            </button>
          </>
        ) : (
          <>
            {/* Step 2: Reflection */}
            <div style={{ marginBottom: 16 }}>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: "var(--accent)",
                }}
              >
                今日反思
              </h3>

              <label
                style={{
                  fontSize: 12,
                  color: "var(--text3)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                今天做得好的地方（優點 1）
              </label>
              <input
                type="text"
                value={form.strength_1}
                onChange={(e) => update("strength_1", e.target.value)}
                placeholder="例：開場白很自然，客戶有被吸引"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg2)",
                  color: "var(--text)",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              />

              <label
                style={{
                  fontSize: 12,
                  color: "var(--text3)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                今天做得好的地方（優點 2）
              </label>
              <input
                type="text"
                value={form.strength_2}
                onChange={(e) => update("strength_2", e.target.value)}
                placeholder="例：成功處理了價格異議"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg2)",
                  color: "var(--text)",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              />

              <label
                style={{
                  fontSize: 12,
                  color: "var(--text3)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                明天要改善的地方
              </label>
              <input
                type="text"
                value={form.improvement}
                onChange={(e) => update("improvement", e.target.value)}
                placeholder="例：邀約話術要更直接"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg2)",
                  color: "var(--text)",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              />

              <label
                style={{
                  fontSize: 12,
                  color: "var(--text3)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                其他備註（選填）
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="今天遇到什麼特別的狀況嗎？"
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg2)",
                  color: "var(--text)",
                  fontSize: 13,
                  resize: "none",
                  marginBottom: 16,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: "14px 0",
                  borderRadius: 12,
                  background: "var(--bg2)",
                  color: "var(--text2)",
                  fontWeight: 600,
                  fontSize: 14,
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                ← 上一步
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  flex: 2,
                  padding: "14px 0",
                  borderRadius: 12,
                  background:
                    "linear-gradient(135deg, var(--accent), var(--teal))",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 15,
                  border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? "提交中..." : "提交今日回饋 ✓"}
              </button>
            </div>
          </>
        )}

        {/* Skip link - small, not prominent */}
        <button
          onClick={onSkip}
          style={{
            display: "block",
            margin: "16px auto 0",
            background: "none",
            border: "none",
            color: "var(--text3)",
            fontSize: 11,
            cursor: "pointer",
            textDecoration: "underline",
            opacity: 0.6,
          }}
        >
          稍後再填（下次開啟仍會提醒）
        </button>
      </div>
    </div>
  );
}

/**
 * Check if user should see the feedback modal
 * - Must be after work end time
 * - Must not have submitted today
 * - Must be a working day
 */
export function shouldShowFeedback(
  userEmail: string,
  workEndTime: string,
  workDays: number[] // 0=Sun, 1=Mon, ..., 6=Sat
): boolean {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dayOfWeek = now.getDay();

  // Not a work day
  if (!workDays.includes(dayOfWeek)) return false;

  // Already submitted today
  if (localStorage.getItem(`feedback_${userEmail}_${today}`) === "submitted") {
    return false;
  }

  // Check if current time is past work end time
  const [endHour, endMin] = workEndTime.split(":").map(Number);
  const endMinutes = endHour * 60 + endMin;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return currentMinutes >= endMinutes;
}

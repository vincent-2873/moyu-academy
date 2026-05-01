"use client";

import { useEffect, useState } from "react";

interface Module {
  id: string;
  day_offset: number;
  sequence: number;
  module_type: string;
  title: string;
  description: string | null;
  duration_min: number | null;
  required: boolean;
  content: Record<string, unknown> | null;
}

export default function SalesTraining() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("moyu_user_email") : null;
    setEmail(stored);
    if (stored) {
      fetch(`/api/me/training?email=${encodeURIComponent(stored)}`)
        .then((r) => r.json())
        .then((d) => setModules(d?.modules || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // 按 day_offset 分組
  const byDay = modules.reduce<Record<number, Module[]>>((acc, m) => {
    const d = m.day_offset;
    if (!acc[d]) acc[d] = [];
    acc[d].push(m);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>我的訓練</h1>
        <p style={{ fontSize: 14, opacity: 0.7, marginTop: 6 }}>
          業務 14 天養成 + nSchool 真實 8 步驟開發檢核 + 4 本銷售方法論(GROW / 黃金圈 / OKR / SPIN)
        </p>
      </div>

      {!email && <div style={infoBox}>請先登入</div>}
      {loading && <div style={infoBox}>載入中…</div>}
      {!loading && email && modules.length === 0 && (
        <div style={infoBox}>還沒分配訓練 path,請主管派 path(預設 business_default 14 天)</div>
      )}

      {Object.keys(byDay)
        .map(Number)
        .sort((a, b) => a - b)
        .map((day) => (
          <section key={day} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Day {day}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {byDay[day].map((m) => (
                <a key={m.id} href={`/sales/module/${m.id}`} style={moduleCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, opacity: 0.6 }}>{moduleTypeLabel(m.module_type)}</span>
                    {m.required && <span style={{ fontSize: 11, color: "#C8102E" }}>必修</span>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{m.title}</div>
                  {m.description && (
                    <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>{m.description}</div>
                  )}
                  <div style={{ marginTop: 10, fontSize: 11, opacity: 0.5 }}>
                    {m.duration_min ? `${m.duration_min} 分鐘` : ""}
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

function moduleTypeLabel(type: string): string {
  const map: Record<string, string> = {
    video: "🎬 影片",
    reading: "📖 閱讀",
    sparring: "🎯 對練",
    task: "✅ 任務",
    reflection: "✍️ 反思",
    quiz: "❓ 測驗",
  };
  return map[type] || type;
}

const infoBox: React.CSSProperties = {
  padding: 14,
  background: "var(--ink-mist, #F0EFEA)",
  borderRadius: 6,
  fontSize: 14,
};

const moduleCardStyle: React.CSSProperties = {
  display: "block",
  padding: 16,
  background: "var(--ink-paper, #FAFAF7)",
  border: "1px solid var(--ink-line, #E5E2DA)",
  borderRadius: 8,
  textDecoration: "none",
  color: "inherit",
  transition: "transform 150ms, box-shadow 150ms",
};

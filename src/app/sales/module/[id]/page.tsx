"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

export default function ModuleDetail() {
  const params = useParams();
  const moduleId = params?.id as string;
  const [module, setModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const email = typeof window !== "undefined" ? localStorage.getItem("moyu_user_email") : null;
    if (!email || !moduleId) return;
    fetch(`/api/me/training?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((d) => {
        const found = d?.modules?.find((m: Module) => m.id === moduleId);
        setModule(found || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [moduleId]);

  if (loading) return <div style={infoBox}>載入中…</div>;
  if (!module) return <div style={infoBox}>找不到此 module</div>;

  const content = module.content || {};
  const sourceRefs = (content.source_refs as string[]) || [];
  const audioSourceRefs = (content.audio_source_refs as string[]) || [];
  const framework = (content.framework as string[]) || [];
  const book = content.book as string | undefined;

  return (
    <div>
      <a href="/sales/training" style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>
        ← 回到我的訓練
      </a>

      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          Day {module.day_offset} · {moduleTypeLabel(module.module_type)} · {module.duration_min} 分鐘
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "6px 0 10px" }}>{module.title}</h1>
        {module.description && <p style={{ fontSize: 15, opacity: 0.8 }}>{module.description}</p>}
      </div>

      {book && (
        <section style={cardSection}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>📕 銷售方法論:{book}</h2>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>
            {(content.summary as string) || ""}
          </div>
          {framework.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {framework.map((f) => (
                <span key={f} style={chipStyle}>
                  {f}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {framework.length > 0 && !book && (
        <section style={cardSection}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>🎯 8 步驟對練架構(對齊 nSchool 開發檢核)</h2>
          <ol style={{ paddingLeft: 20, lineHeight: 1.9 }}>
            {framework.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ol>
        </section>
      )}

      {sourceRefs.length > 0 && (
        <section style={cardSection}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>📚 對應 nSchool source</h2>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>
            這個 module 對齊 nSchool 訓練中心的這些檔案,Claude 戰情官會引用真內容回答你問題:
          </div>
          <ul style={{ paddingLeft: 20, fontSize: 12, lineHeight: 1.8, opacity: 0.8 }}>
            {sourceRefs.map((ref, i) => (
              <li key={i}>
                <code>{ref.split("/").slice(-1)[0]}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      {audioSourceRefs.length > 0 && (
        <section style={cardSection}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>🎙️ 對應 nSchool 業務開發 Call 逐字稿(8 個)</h2>
          <ul style={{ paddingLeft: 20, fontSize: 12, lineHeight: 1.8, opacity: 0.8 }}>
            {audioSourceRefs.map((ref, i) => (
              <li key={i}>
                <code>{ref.split("/").slice(-1)[0]}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={cardSection}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>💡 問 Claude 戰情官</h2>
        <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.7 }}>
          點右下角「墨」字打開戰情官,問它這個 module 的細節,它會引用上面 nSchool source 真內容回答。
        </p>
      </section>
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

const cardSection: React.CSSProperties = {
  background: "var(--ink-paper, #FAFAF7)",
  border: "1px solid var(--ink-line, #E5E2DA)",
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
};

const chipStyle: React.CSSProperties = {
  padding: "4px 10px",
  background: "rgba(200, 16, 46, 0.08)",
  color: "#C8102E",
  borderRadius: 999,
  fontSize: 12,
};

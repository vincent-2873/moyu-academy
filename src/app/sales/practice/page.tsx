"use client";

import { useEffect, useState } from "react";

interface Persona {
  id: string;
  name: string;
  archetype: string | null;
  description: string | null;
  difficulty: number;
}

export default function SalesPractice() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selected, setSelected] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/personas`)
      .then((r) => r.json())
      .then((d) => setPersonas(d?.personas || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>AI 對練</h1>
        <p style={{ fontSize: 14, opacity: 0.7, marginTop: 6 }}>
          選一個對練角色 → 撥打語音 → Claude 評三點(順暢 / 邏輯 / 語氣)+ 8 步驟架構命中率
        </p>
      </div>

      {loading && <div style={infoBox}>載入中…</div>}
      {!loading && personas.length === 0 && (
        <div style={infoBox}>
          還沒 persona seed。下一步:基於 nSchool 8 個業務開發 Call 逐字稿建 persona(Phase B-2 後續迭代)。
        </div>
      )}

      {personas.length > 0 && !selected && (
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>選一個 Persona</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {personas.map((p) => (
              <button key={p.id} onClick={() => setSelected(p)} style={cardButton}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                {p.archetype && (
                  <div style={{ fontSize: 12, opacity: 0.6, margin: "4px 0 8px" }}>{p.archetype}</div>
                )}
                {p.description && (
                  <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>{p.description}</div>
                )}
                <div style={{ marginTop: 10, fontSize: 11, opacity: 0.6 }}>
                  難度 {"★".repeat(p.difficulty)}{"☆".repeat(5 - p.difficulty)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div>
          <button onClick={() => setSelected(null)} style={{ marginBottom: 16, ...backButton }}>
            ← 換 Persona
          </button>
          <div style={{ background: "var(--ink-mist, #F0EFEA)", borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>正在練:{selected.name}</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>{selected.description}</div>
          </div>

          <div style={infoBox}>
            🎙️ 語音對練 UI 開發中。當前可用「個人戰情」上的 RecordingUploader 上傳整段錄音給 Claude 評估。
            <br />
            <br />
            未來:這頁會直接連麥克風 → Claude 即時扮演 Persona 回應 → 結束後三點評估。
          </div>
        </div>
      )}
    </div>
  );
}

const infoBox: React.CSSProperties = {
  padding: 14,
  background: "var(--ink-mist, #F0EFEA)",
  borderRadius: 6,
  fontSize: 14,
  lineHeight: 1.6,
};

const cardButton: React.CSSProperties = {
  padding: 18,
  background: "var(--ink-paper, #FAFAF7)",
  border: "1px solid var(--ink-line, #E5E2DA)",
  borderRadius: 8,
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
};

const backButton: React.CSSProperties = {
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid var(--ink-line, #E5E2DA)",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
};

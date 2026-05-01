"use client";

import { useEffect, useState } from "react";

interface Persona {
  id: string;
  name: string;
  archetype: string | null;
  description: string | null;
  difficulty: number;
}

export default function AdminClaudePersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/personas", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setPersonas(j?.personas || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🎭 對練 Persona 庫</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          管理對練角色(基於 nSchool 業務開發 8 個逐字 / 楊嘉瑜 / 鄭繁星 等)
        </p>
      </div>

      {loading && <div style={infoBox}>載入中…</div>}
      {!loading && personas.length === 0 && (
        <div style={infoBox}>
          還沒 persona seed。下一步 Phase B-4:基於 nSchool 8 個業務開發 Call 逐字稿建 persona
        </div>
      )}

      {personas.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {personas.map((p) => (
            <div key={p.id} style={{ background: "var(--ink-paper, #FAFAF7)", border: "1px solid var(--ink-line, #E5E2DA)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
              {p.archetype && <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 4 }}>{p.archetype}</div>}
              {p.description && <div style={{ fontSize: 12, color: "var(--text2, #666)", marginTop: 8, lineHeight: 1.5 }}>{p.description}</div>}
              <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 10 }}>
                難度 {"★".repeat(p.difficulty)}{"☆".repeat(5 - p.difficulty)}
              </div>
            </div>
          ))}
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
};

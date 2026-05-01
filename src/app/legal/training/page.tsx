"use client";

import { useEffect, useState } from "react";

interface LegalChunk {
  id: string;
  title: string;
  pillar: string;
  content_preview: string;
}

const STAGES = [
  {
    code: "L1",
    title: "📚 階段 1:法律基礎",
    days: "D1-3",
    items: ["民法概論", "民事訴訟法基礎", "契約法核心", "消保法 / 個資法"],
    blocked: "等 Vincent 給法律基礎教材(教科書 / 整理筆記 .md)",
  },
  {
    code: "L2",
    title: "⚖️ 階段 2:案件處理 SOP",
    days: "D4-7",
    items: ["收案評估", "對方背景調查", "答辯架構撰寫", "回函格式"],
    blocked: "等 Vincent 給案件 SOP 文件(過去案件流程整理)",
  },
  {
    code: "L3",
    title: "📜 階段 3:判例研讀",
    days: "D8-14",
    items: ["消費爭議判例", "勞動爭議判例", "智財糾紛判例", "合約糾紛判例"],
    blocked: "等 Vincent 給過去判例 .docx / .pdf(可走 Whisper 上傳介面 ingest)",
  },
  {
    code: "L4",
    title: "🎭 階段 4:Claude 對練",
    days: "D15+",
    items: ["Claude 扮演對方律師", "push back 答辯邏輯", "庭審模擬"],
    blocked: "等 LEGAL_MODULE_SPEC.md + persona seed",
  },
];

export default function LegalTrainingPage() {
  const [chunks, setChunks] = useState<LegalChunk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 撈 RAG legal pillar 看現有素材
    fetch("/api/admin/rag/list?pillar=legal&limit=50", { cache: "no-store" })
      .then(r => r.json())
      .then((j: { chunks?: LegalChunk[] }) => { if (j.chunks) setChunks(j.chunks); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📖 法務訓練</h1>
        <p style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
          法務 N 天養成路徑 — 對齊 system-tree v2 §法務工作台 + 鐵則「等 Vincent 給法務 source」
        </p>
      </div>

      <div style={statusBox}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ fontSize: 26 }}>{chunks.length === 0 ? "⏳" : "✅"}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              法務 RAG 知識庫:{loading ? "載入中…" : `${chunks.length} chunks`}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              {chunks.length === 0
                ? "目前法務 pillar 沒素材。請走 /admin/legal/knowledge 上傳契約 / 律師信 / 庭審錄音 / 判例。"
                : `已 ingest ${chunks.length} 份法務文件,可作為 RAG 對練 source。`}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginTop: 20 }}>
        {STAGES.map(s => (
          <div key={s.code} style={stageCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{s.title}</div>
              <span style={{ fontSize: 11, color: "#888", background: "#F0EFEA", padding: "3px 8px", borderRadius: 4 }}>
                {s.days}
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#555", lineHeight: 1.7 }}>
              {s.items.map(i => <li key={i}>{i}</li>)}
            </ul>
            <div style={blockedTag}>
              🚧 {s.blocked}
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...statusBox, marginTop: 20, background: "#FFF7E5", borderColor: "#F2C66E" }}>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: "#666" }}>
          <strong>📋 鐵則 reminder</strong>(2026-05-01 Vincent 拍板):<br/>
          做 LEGAL 訓練體系前,先收齊:律師信 / 答辯狀範本、過去判例 (.docx / .pdf)、法律訓練教材、法務 N 天養成路徑定義。<br/>
          收齊後走 <code>/admin/legal/knowledge</code> 上傳 → ingest 進 pillar=legal → 開始對齊 BIZ 8 步驟 pattern 寫 LEGAL_MODULE_SPEC。
        </div>
      </div>
    </div>
  );
}

const statusBox: React.CSSProperties = {
  background: "#FAFAF7", border: "1px solid #E5E2DA", borderRadius: 10, padding: 16,
};
const stageCard: React.CSSProperties = {
  background: "white", border: "1px solid #E5E2DA", borderRadius: 10, padding: 16,
};
const blockedTag: React.CSSProperties = {
  marginTop: 12, padding: "8px 12px", fontSize: 12, color: "#8B5A00",
  background: "#FFF7E5", borderRadius: 6, lineHeight: 1.5,
};

"use client";

import { useEffect, useState } from "react";

interface CaseRow {
  id: string;
  case_no_internal: string | null;
  case_no_external: string | null;
  title: string;
  kind: string;
  brand_code: string | null;
  primary_party_name: string | null;
  stage: string;
  response_deadline: string | null;
}

const DOC_TYPES = [
  { id: "answer", label: "📄 民事答辯狀" },
  { id: "reply", label: "📨 回函" },
  { id: "letter", label: "📜 律師函 / 存證信函" },
];

export default function LegalDraftPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [docType, setDocType] = useState("answer");
  const [caseId, setCaseId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState("");
  const [edit, setEdit] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/legal/cases?status=open&limit=50", { cache: "no-store" })
      .then(r => r.json())
      .then((j: { ok?: boolean; cases?: CaseRow[] }) => {
        if (j.ok && j.cases) setCases(j.cases);
      })
      .catch(() => {})
      .finally(() => setLoadingCases(false));
  }, []);

  const handleGenerate = async () => {
    if (!caseId) { setError("請先選擇案件"); return; }
    setGenerating(true); setError(""); setDraft(""); setEdit("");
    try {
      const res = await fetch("/api/legal/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, doc_type: docType, instruction }),
      });
      const j = await res.json();
      if (!j.ok) { setError(j.error || "起草失敗"); return; }
      setDraft(j.draft || "");
      setEdit(j.draft || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const selectedCase = cases.find(c => c.id === caseId);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📝 Claude 起草助手</h1>
        <p style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
          答辯狀 / 回函 / 律師函 — Claude 自動讀案件 + RAG 法務 pillar + 過去類似案件
        </p>
      </div>

      <div style={controlPanel}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>📋 文件類型</label>
            <select value={docType} onChange={e => setDocType(e.target.value)} style={selectStyle}>
              {DOC_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>⚖️ 選擇案件 {loadingCases && "(載入中…)"}</label>
            <select value={caseId} onChange={e => setCaseId(e.target.value)} style={selectStyle}>
              <option value="">— 選擇案件 —</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.case_no_internal || c.case_no_external || c.id.slice(0, 8)} · {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCase && (
          <div style={caseDetailBox}>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>
              <strong>案件編號:</strong>{selectedCase.case_no_internal || "—"}
              <strong>類型:</strong>{selectedCase.kind}
              <strong>對方:</strong>{selectedCase.primary_party_name || "—"}
              <strong>階段:</strong>{selectedCase.stage}
              <strong>回應期限:</strong>{selectedCase.response_deadline || "—"}
            </div>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <label style={lbl}>💬 額外指示(optional)</label>
          <textarea value={instruction} onChange={e => setInstruction(e.target.value)}
            placeholder="例:對方主張違約金 50 萬,我方需要主張過高請酌減..."
            style={textareaStyle} rows={2}/>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={handleGenerate} disabled={generating || !caseId} style={primaryBtn}>
            {generating ? "🤖 Claude 起草中…" : "🤖 Claude 起草"}
          </button>
          {error && <span style={{ color: "#C03A2B", fontSize: 13 }}>⚠ {error}</span>}
        </div>
      </div>

      {draft && (
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={panel}>
            <h3 style={panelHead}>🤖 Claude 草稿</h3>
            <pre style={preStyle}>{draft}</pre>
          </div>
          <div style={panel}>
            <h3 style={panelHead}>✍️ 法務修改</h3>
            <textarea value={edit} onChange={e => setEdit(e.target.value)} style={editArea}/>
            <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>
              💾 儲存後送簽核鏈(法務 → 主管 → 寄出)— 待 D28 schema 接 review_chains table
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const controlPanel: React.CSSProperties = {
  background: "#FAFAF7", border: "1px solid #E5E2DA",
  borderRadius: 10, padding: 18,
};
const caseDetailBox: React.CSSProperties = {
  marginTop: 12, padding: 12, background: "#F0EFEA", borderRadius: 6,
};
const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#555" };
const selectStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #E5E2DA",
  borderRadius: 6, background: "white",
};
const textareaStyle: React.CSSProperties = {
  width: "100%", padding: 10, fontSize: 13, border: "1px solid #E5E2DA",
  borderRadius: 6, fontFamily: "inherit", resize: "vertical",
};
const primaryBtn: React.CSSProperties = {
  padding: "10px 22px", fontSize: 14, fontWeight: 700, background: "#C03A2B",
  color: "white", border: "none", borderRadius: 6, cursor: "pointer",
};
const panel: React.CSSProperties = {
  background: "#FAFAF7", border: "1px solid #E5E2DA",
  borderRadius: 10, padding: 16,
};
const panelHead: React.CSSProperties = { margin: 0, marginBottom: 12, fontSize: 15, fontWeight: 700 };
const preStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.7, fontFamily: "inherit",
  background: "#F0EFEA", padding: 14, borderRadius: 6, minHeight: 300,
};
const editArea: React.CSSProperties = {
  width: "100%", minHeight: 300, padding: 14, fontSize: 13, lineHeight: 1.7, fontFamily: "inherit",
  border: "1px solid #E5E2DA", borderRadius: 6, resize: "vertical",
};

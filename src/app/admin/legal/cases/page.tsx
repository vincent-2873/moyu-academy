"use client";

import { useEffect, useState } from "react";

interface LegalCase {
  id: string;
  case_no?: string | null;
  brand?: string | null;
  type?: string | null;
  status?: string | null;
  party?: string | null;
  next_action?: string | null;
  next_deadline?: string | null;
  created_at: string;
}

export default function AdminLegalCasesPage() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/legal-cases", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setCases(j.cases || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>⚖️ 法務案件中心</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          全集團案件總覽 / 按類型品牌分類 / 逾期警示 / Aging 分佈
        </p>
      </div>

      {loading && <div style={infoBox}>載入中…</div>}
      {!loading && cases.length === 0 && (
        <div style={infoBox}>還沒有案件資料 — 新增第一筆從 /legal/cases(法務人員)</div>
      )}
      {cases.length > 0 && (
        <div style={{ background: "var(--ink-paper, #FAFAF7)", border: "1px solid var(--ink-line, #E5E2DA)", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--ink-mist, #F0EFEA)" }}>
                <Th>案號</Th>
                <Th>品牌</Th>
                <Th>類型</Th>
                <Th>狀態</Th>
                <Th>對方</Th>
                <Th>下一步</Th>
                <Th>下次 deadline</Th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--ink-line, #E5E2DA)" }}>
                  <Td>{c.case_no || "—"}</Td>
                  <Td>{c.brand || "—"}</Td>
                  <Td>{c.type || "—"}</Td>
                  <Td>{c.status || "—"}</Td>
                  <Td>{c.party || "—"}</Td>
                  <Td>{c.next_action || "—"}</Td>
                  <Td>{c.next_deadline ? new Date(c.next_deadline).toLocaleDateString("zh-TW") : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text2, #666)" }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 12px" }}>{children}</td>;
}

const infoBox: React.CSSProperties = {
  padding: 14,
  background: "var(--ink-mist, #F0EFEA)",
  borderRadius: 6,
  fontSize: 14,
};

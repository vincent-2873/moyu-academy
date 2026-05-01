"use client";

import { useEffect, useState } from "react";

interface Inquiry {
  id: string;
  asker_email: string | null;
  asker_role: string | null;
  question: string;
  claude_answer: string | null;
  asked_at: string;
  answered_at: string | null;
  exported_pdf_url: string | null;
}

interface Data {
  ok: boolean;
  hint?: string;
  count?: number;
  records?: Inquiry[];
}

const SUGGESTED_QUESTIONS = [
  "本季最大的營收風險是什麼?",
  "5 個品牌(學米/無限/nSchool/職能/XLAB)橫向對比,哪個 ROI 最高?",
  "新人 14 天訓練的完訓率與後續業績相關嗎?",
  "Claude 自我評估的決策成功率是怎麼算的?",
  "上一季 Vincent 拍板的策略,執行後結果驗證如何?",
];

export default function AdminBoardInquiryPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/board/inquiry", { cache: "no-store" })
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ ok: false }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!question.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/board/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), asker_role: "investor" }),
      });
      const j = await res.json();
      if (j.ok) {
        setQuestion("");
        load();
      } else {
        alert(j.error || "提問失敗");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>💬 質詢 Claude</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          投資人問,Claude 答 — 對話介面 + 推薦問題 + 對話歷史 · 資料來源:D26 `board_inquiries`
        </p>
      </div>

      {/* 提問框 */}
      <div style={{
        background: "linear-gradient(135deg, #FAF7E8 0%, #F0EFEA 100%)",
        border: "1px solid #D4C896",
        borderRadius: 10, padding: 16, marginBottom: 20,
      }}>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="向 Claude 提問(營收 / 風險 / 策略 / 訓練成效…)"
          style={{
            width: "100%", minHeight: 80, padding: 10,
            border: "1px solid var(--ink-line, #E5E2DA)",
            borderRadius: 6, fontSize: 14, fontFamily: "inherit",
            resize: "vertical", boxSizing: "border-box",
          }}
        />
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "var(--text3, #888)" }}>
            提問會記錄,Claude 回答透過右下角戰情官側欄即時答覆
          </div>
          <button
            onClick={submit}
            disabled={!question.trim() || submitting}
            style={{
              padding: "8px 18px",
              background: question.trim() && !submitting ? "#2A2622" : "#B0AEA8",
              color: "#fff", border: "none", borderRadius: 6,
              fontSize: 13, fontWeight: 700,
              cursor: question.trim() && !submitting ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            {submitting ? "送出中…" : "📤 送出質詢"}
          </button>
        </div>
      </div>

      {/* 推薦問題 */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--text2, #555)" }}>💡 推薦問題</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SUGGESTED_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              style={{
                padding: "6px 12px",
                border: "1px solid var(--ink-line, #E5E2DA)",
                borderRadius: 16,
                background: "var(--ink-paper, #FAFAF7)",
                color: "var(--text2, #555)",
                fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      {/* 歷史 */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📜 質詢歷史</h2>

      {loading && <div style={infoBox}>載入中…</div>}
      {data && !data.ok && (
        <div style={{ ...infoBox, color: "#B89968" }}>
          🟡 D26 Phase 4 schema 還沒 apply。Apply Migration workflow 跑 D26 SQL 後本頁有資料。
        </div>
      )}
      {data?.ok && (data.records?.length ?? 0) === 0 && (
        <div style={infoBox}>📭 還沒有質詢紀錄。上面提問框送出第一題後會出現在這裡。</div>
      )}
      {data?.ok && (data.records ?? []).map(r => (
        <div key={r.id} style={{
          background: "var(--ink-paper, #FAFAF7)",
          border: "1px solid var(--ink-line, #E5E2DA)",
          borderRadius: 8,
          padding: 14, marginBottom: 10,
        }}>
          <div style={{ fontSize: 11, color: "var(--text3, #888)", marginBottom: 4 }}>
            {r.asker_role}{r.asker_email && ` · ${r.asker_email}`} · 問於 {new Date(r.asked_at).toLocaleString("zh-TW")}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Q:{r.question}</div>
          {r.claude_answer ? (
            <div style={{ padding: 10, background: "var(--ink-mist, #F0EFEA)", borderRadius: 6, fontSize: 13, lineHeight: 1.7 }}>
              <strong>Claude:</strong>{r.claude_answer}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#B89968" }}>⏳ Claude 答覆中(請開戰情官側欄繼續對話)</div>
          )}
        </div>
      ))}
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

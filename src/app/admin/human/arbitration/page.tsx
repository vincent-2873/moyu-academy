export default function AdminHumanArbitrationPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>⚖️ 仲裁紀錄</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          原始衝突 / 處理過程 / 結論 / Claude 從中學什麼
        </p>
      </div>
      <div style={placeholderBox}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>⚖️ 待 Phase 4 W2 後續迭代</div>
        <div style={{ fontSize: 13, color: "var(--text2, #666)", lineHeight: 1.7 }}>
          資料來源:`arbitration_records` table(Phase 4 W2 加)
          <ul style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>原始衝突</li>
            <li>處理過程</li>
            <li>結論</li>
            <li>Claude 從中學什麼(寫進 RAG common pillar)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const placeholderBox: React.CSSProperties = {
  background: "var(--ink-paper, #FAFAF7)",
  border: "1px dashed var(--ink-line, #E5E2DA)",
  borderRadius: 10,
  padding: 24,
};

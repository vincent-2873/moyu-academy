export default function AdminBoardQuarterlyPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🏛️ 季度成績單</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          給投資人 / 董事 / 財務長 — Claude 自評 + 4 大 KPI + 風險揭露
        </p>
      </div>
      <div style={placeholderBox}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>📊 待 Phase B 後續迭代</div>
        <div style={{ fontSize: 13, color: "var(--text2, #666)", lineHeight: 1.7 }}>
          system-tree v2 §投資人中心 規格:
          <ul style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>Claude 自評分數(0-100)</li>
            <li>4 大 KPI(季營收 / 預測準度 / 決策成功率 / ROI)</li>
            <li>Claude 給董事會的話(AI 訊息)</li>
            <li>主動揭露的風險清單</li>
            <li>對標基準(vs 上季 / 去年)</li>
            <li>PDF 下載 + 分享連結</li>
          </ul>
          資料來源:`claude_self_assessments` table(Phase 4 W1 加)
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

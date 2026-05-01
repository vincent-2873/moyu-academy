export default function AdminHumanSosPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🆘 Claude 求救清單</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          給 Vincent only — Claude 卡住的事 / 緊急(紅) / 一般(黃) / 已處理(綠)
        </p>
      </div>
      <div style={placeholderBox}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🚨 待 Phase 4 W2 後續迭代</div>
        <div style={{ fontSize: 13, color: "var(--text2, #666)", lineHeight: 1.7 }}>
          資料來源:`claude_help_requests` table(D18 schema 已建)
          <ul style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>緊急(紅色)— Claude 嘗試紀錄 + 判斷 + 動作按鈕</li>
            <li>一般(黃色)</li>
            <li>已處理(綠色)</li>
            <li>動作:我來談 / 派組長 / 留 voice memo / 暫不處理 / 已私下處理</li>
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

export default function AdminBoardStrategyPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🏛️ Claude 戰略報告</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          三情境模擬(保守 / 中性 / 樂觀)+ 推薦策略 + 執行甘特圖
        </p>
      </div>
      <div style={placeholderBox}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🎯 待 Phase B 後續迭代</div>
        <div style={{ fontSize: 13, color: "var(--text2, #666)", lineHeight: 1.7 }}>
          system-tree v2 §投資人中心 規格:
          <ul style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>三情境模擬(保守 / 中性 / 樂觀)</li>
            <li>Claude 推薦策略(3-5 個):策略名稱 / 數據依據 / 預期成效 / 預算需求 / 簽核按鈕</li>
            <li>執行時間軸(甘特圖)</li>
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

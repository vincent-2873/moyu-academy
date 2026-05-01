export default function AdminHumanSignOffPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>✍️ 我必須拍板</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          Claude 寫好的草稿 / 等簽核合約 / 人事異動 / 報告 sign-off
        </p>
      </div>
      <div style={placeholderBox}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>📋 待 Phase 4 W2 後續迭代</div>
        <div style={{ fontSize: 13, color: "var(--text2, #666)", lineHeight: 1.7 }}>
          資料來源:`decision_records` table(Phase 4 W1 加)
          <ul style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>今天必拍板(紅色)</li>
            <li>本週必拍板</li>
            <li>已拍板歷史</li>
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

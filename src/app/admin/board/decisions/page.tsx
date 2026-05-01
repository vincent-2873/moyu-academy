export default function AdminBoardDecisionsPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🏛️ 拍板紀錄</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          類訴訟卷宗格式 — 篩選 / 時間軸列表 / 詳細查看 / 簽核鏈追蹤
        </p>
      </div>
      <div style={placeholderBox}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>⚖️ 待 Phase 4 W1 後續迭代</div>
        <div style={{ fontSize: 13, color: "var(--text2, #666)", lineHeight: 1.7 }}>
          資料來源:`decision_records` table(Phase 4 W1 加)
          <ul style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>篩選器(時間 / 類型 / 拍板人)</li>
            <li>時間軸列表</li>
            <li>詳細查看(原始衝突 / Claude 建議 / Vincent 拍板 / 結果驗證)</li>
            <li>簽核鏈追蹤</li>
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

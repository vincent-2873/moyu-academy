export default function LegalKnowledgePage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📚 法律知識</h1>
        <p style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
          法務 pillar RAG 對話 — 走右下角戰情官常駐側欄
        </p>
      </div>
      <div style={infoBox}>
        <p style={{ margin: 0, fontWeight: 600, marginBottom: 12 }}>👉 點右下角「墨」字打開戰情官對話</p>
        <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
          範例問題:
        </p>
        <ul style={{ marginTop: 8, paddingLeft: 20, fontSize: 13, color: "#666" }}>
          <li>「對方寄了存證信函,我該怎麼回?」</li>
          <li>「合約違約金怎麼計算合理範圍?」</li>
          <li>「這個案件適用哪一條法規?」</li>
          <li>「過去類似 case 的判決結果?」</li>
        </ul>
        <p style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
          Claude 引用 Notion 法務 DB + 過往判例(法務 pillar)回答(待 Vincent 開 Notion legal DB)
        </p>
      </div>
    </div>
  );
}

const infoBox: React.CSSProperties = {
  padding: 24,
  background: "#fff",
  border: "1px solid #E5E2DA",
  borderRadius: 10,
  fontSize: 14,
  lineHeight: 1.7,
};

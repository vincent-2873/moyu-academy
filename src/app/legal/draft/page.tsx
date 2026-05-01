export default function LegalDraftPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📝 Claude 起草助手</h1>
        <p style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
          答辯狀 / 回函 / 律師函 — Claude 自動讀案件 + RAG 法務 pillar + 過去類似案件
        </p>
      </div>
      <div style={placeholderBox}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🎯 待 Phase 4 後續迭代</div>
        <div style={{ fontSize: 13, color: "#666", lineHeight: 1.7 }}>
          system-tree v2 §法務工作台 規格:
          <ul style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>文件類型選擇(答辯狀 / 回函 / 律師函)</li>
            <li>案件選擇器</li>
            <li>Claude 自動讀取(案件描述 + RAG 法務 pillar + 過去類似案件)</li>
            <li>雙欄編輯(左:Claude 草稿 / 右:法務修改)</li>
            <li>簽核鏈(法務 → 主管 → 寄出)</li>
          </ul>
          資料來源:`legal_drafts` table(Phase 4 加)+ `knowledge_chunks` pillar=&apos;legal&apos;
        </div>
      </div>
    </div>
  );
}

const placeholderBox: React.CSSProperties = {
  background: "#fff",
  border: "1px dashed #E5E2DA",
  borderRadius: 10,
  padding: 24,
};

export default function AdminBoardInquiryPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>🏛️ 質詢 Claude</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          投資人問,Claude 答 — 對話介面 + 推薦問題 + 對話歷史 + 匯出 PDF
        </p>
      </div>
      <div style={placeholderBox}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>💬 走右下角戰情官常駐側欄</div>
        <div style={{ fontSize: 13, color: "var(--text2, #666)", lineHeight: 1.7 }}>
          目前 Claude 戰情官常駐側欄已 ready(右下朱紅「墨」字)。投資人可以打開直接問。
          <br /><br />
          後續迭代:
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>進入 /admin/board/inquiry 頁直接渲染專屬對話介面(不需點側欄)</li>
            <li>推薦問題列表(常見董事會問題)</li>
            <li>對話歷史檢索 + 匯出 PDF</li>
            <li>資料來源:`board_inquiries` table(Phase 4 W1 加)</li>
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

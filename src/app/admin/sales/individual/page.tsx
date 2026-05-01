export default function AdminSalesIndividualPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>👤 個人戰況(主管視角)</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          看下屬個人狀況 / 通數 / 邀約 / 成交 / 卡關偵測
        </p>
      </div>
      <div style={placeholderBox}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>👁️ 待 Phase B 後續迭代</div>
        <div style={{ fontSize: 13, color: "var(--text2, #666)", lineHeight: 1.7 }}>
          資料來源:`sales_metrics_daily`(Metabase 同步,2122+ rows)
          <ul style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>下屬列表(按品牌 / 組別篩)</li>
            <li>個人 KPI 卡(通數 / 邀約 / 成交 / 達成率)</li>
            <li>連勝 / 連敗追蹤</li>
            <li>Claude 偵測卡關 → 介入建議</li>
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

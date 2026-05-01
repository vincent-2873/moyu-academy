export default function LegalTrainingPage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📖 法務訓練</h1>
        <p style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
          法務 N 天養成路徑 / 法律邏輯練習 / 跟 Claude 對練法律推論 / 過去判例研讀
        </p>
      </div>
      <div style={placeholderBox}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🎯 待 Phase 5 後續迭代</div>
        <div style={{ fontSize: 13, color: "#666", lineHeight: 1.7 }}>
          system-tree v2 §法務工作台 規格(LEGAL 訓練體系待定義):
          <ul style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>法務 N 天養成路徑(待 Vincent 給天數 + 內容)</li>
            <li>法律邏輯練習</li>
            <li>跟 Claude 對練法律推論(檢方 vs 辯方)</li>
            <li>過去判例研讀</li>
          </ul>
          資料來源:`training_paths` 內 LEGAL 路徑(待 D21 之後 D22 SQL 建)
          <br /><br />
          鐵則:基於 Vincent 既有法務 source 延伸,不從零生(同 BIZ 處理)
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

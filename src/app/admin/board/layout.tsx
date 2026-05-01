/**
 * /admin/board layout — 投資人中心
 *
 * 對齊 system-tree v2 §視覺氛圍對照「米白+米黃,年報莊重感」
 *
 * Phase 5 v2(2026-05-01):**僅加區域徽章 + 極淡漸層**,不改主底色,確保既有 component 可讀
 */
export default function AdminBoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100%",
      background: "linear-gradient(180deg, rgba(212, 200, 150, 0.12) 0%, transparent 240px)",
      borderRadius: 8,
      padding: "0 0 12px 0",
      margin: "-4px -4px 0 -4px",
    }}>
      <div style={{
        display: "inline-block",
        fontSize: 10, letterSpacing: 1.5,
        padding: "3px 10px",
        background: "rgba(212, 200, 150, 0.4)",
        color: "#806848",
        border: "1px solid rgba(212, 200, 150, 0.7)",
        borderRadius: 4,
        marginBottom: 12,
        fontWeight: 700,
      }}>
        🏛️ INVESTOR · 年報莊重
      </div>
      {children}
    </div>
  );
}

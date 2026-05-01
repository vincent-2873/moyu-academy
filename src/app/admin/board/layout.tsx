/**
 * /admin/board layout — 投資人中心
 *
 * 對齊 system-tree v2 §視覺氛圍對照:
 *   米白+米黃,年報莊重感
 *
 * 4 子頁:quarterly / strategy / inquiry / decisions
 */
export default function AdminBoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100%",
      background: "linear-gradient(180deg, var(--zone-board-bg, #FAF7E8) 0%, var(--ink-paper, #FAFAF7) 100%)",
      padding: "0 4px",
    }}>
      <div style={{
        display: "inline-block",
        fontSize: 11,
        letterSpacing: 1.5,
        padding: "4px 10px",
        background: "var(--zone-board-accent, #D4C896)",
        color: "var(--ink-deep, #2A2622)",
        borderRadius: 4,
        marginBottom: 14,
        fontWeight: 700,
      }}>
        🏛️ INVESTOR · 年報莊重
      </div>
      {children}
    </div>
  );
}

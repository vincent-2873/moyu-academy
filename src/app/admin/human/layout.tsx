/**
 * /admin/human layout — 人類工作區
 *
 * 對齊 system-tree v2 §視覺氛圍對照「米白+紙感,便利貼即時感」
 * 哲學:Claude 是常態,人類介入是例外
 *
 * Phase 5 v2(2026-05-01):僅加徽章 + 極淡橫條紋(信紙感),不改主底色
 */
export default function AdminHumanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100%",
      backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(184, 153, 104, 0.04) 27px, rgba(184, 153, 104, 0.04) 28px)`,
      borderRadius: 8,
      padding: "0 0 12px 0",
      margin: "-4px -4px 0 -4px",
    }}>
      <div style={{
        display: "inline-block",
        fontSize: 10, letterSpacing: 1.5,
        padding: "3px 10px",
        background: "rgba(184, 153, 104, 0.2)",
        color: "#806848",
        border: "1px solid rgba(184, 153, 104, 0.5)",
        borderRadius: 4,
        marginBottom: 12,
        fontWeight: 700,
      }}>
        🤝 HUMAN · 紙感便利貼
      </div>
      {children}
    </div>
  );
}

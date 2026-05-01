/**
 * /admin/human layout — 人類工作區
 *
 * 對齊 system-tree v2 §視覺氛圍對照:
 *   米白+紙感,便利貼即時感
 *
 * 哲學:Claude 是常態,人類介入是例外
 *
 * 3 子頁:sos / sign-off / arbitration
 */
export default function AdminHumanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100%",
      background: "var(--zone-human-bg, #FBF8F3)",
      backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(184, 153, 104, 0.05) 23px, rgba(184, 153, 104, 0.05) 24px)`,
      padding: "0 4px",
      borderRadius: 8,
    }}>
      <div style={{
        display: "inline-block",
        fontSize: 11,
        letterSpacing: 1.5,
        padding: "4px 10px",
        background: "var(--zone-human-accent, #B89968)",
        color: "#fff",
        borderRadius: 4,
        marginBottom: 14,
        fontWeight: 700,
      }}>
        🤝 HUMAN · 紙感便利貼
      </div>
      {children}
    </div>
  );
}

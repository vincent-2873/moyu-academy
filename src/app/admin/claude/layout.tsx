/**
 * /admin/claude layout — AI 工作台
 *
 * 對齊 system-tree v2 §視覺氛圍對照:
 *   深炭+紫光,終端機科技感
 *
 * 5 子頁:live / log / knowledge / rules / personas
 */
export default function AdminClaudeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100%",
      background: "linear-gradient(180deg, var(--zone-claude-bg, #1F1B17) 0%, #2A2622 100%)",
      color: "var(--zone-claude-text, #E8E5DD)",
      padding: "0 4px",
      borderRadius: 8,
    }}>
      <div style={{
        display: "inline-block",
        fontSize: 11,
        letterSpacing: 1.5,
        padding: "4px 10px",
        background: "var(--zone-claude-accent, #9B8AA8)",
        color: "#fff",
        borderRadius: 4,
        marginBottom: 14,
        fontWeight: 700,
      }}>
        🤖 AI WORKBENCH · 終端機
      </div>
      {children}
    </div>
  );
}

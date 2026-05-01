import Link from "next/link";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--ink-paper, #FAFAF7)", color: "var(--ink-black, #1A1A1A)" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "var(--ink-black, #1A1A1A)",
          color: "var(--ink-paper, #FAFAF7)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <Link
          href="/sales/dashboard"
          style={{ color: "inherit", textDecoration: "none", fontWeight: 700, fontSize: 18, letterSpacing: 1 }}
        >
          📊 業務戰場
        </Link>
        <nav style={{ display: "flex", gap: 18, fontSize: 14 }}>
          <Link href="/sales/dashboard" style={navLinkStyle}>戰況</Link>
          <Link href="/sales/training" style={navLinkStyle}>訓練</Link>
          <Link href="/sales/practice" style={navLinkStyle}>對練</Link>
          <Link href="/sales/knowledge" style={navLinkStyle}>問 Claude</Link>
        </nav>
        <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>
          基於 nSchool 真實架構 · Phase B Week 1
        </div>
      </header>
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>{children}</main>
    </div>
  );
}

const navLinkStyle: React.CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  padding: "6px 12px",
  borderRadius: 6,
  transition: "background 150ms",
};

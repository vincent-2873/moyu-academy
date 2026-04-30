"use client";

/**
 * 共用 UI 元件給 /admin/training-ops/* 4 個子頁
 * 下劃線開頭 = Next.js App Router 不把此檔當 route
 */

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header style={{ marginBottom: 28 }}>
      <h1 style={{
        fontSize: 28,
        fontWeight: 600,
        color: "var(--text)",
        margin: 0,
        fontFamily: '"Noto Serif TC", serif',
        letterSpacing: "-0.01em",
      }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{
          color: "var(--text3)",
          marginTop: 6,
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          {subtitle}
        </p>
      )}
    </header>
  );
}

export function KPICard({ label, value, accent = "default" }: {
  label: string;
  value: number | string;
  accent?: "default" | "ruby" | "amber";
}) {
  const accentColor = accent === "ruby"  ? "var(--accent)"
                    : accent === "amber" ? "var(--gold)"
                    : "var(--text)";
  return (
    <div style={{
      padding: 24,
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      transition: "transform 150ms ease-out, box-shadow 150ms",
    }}>
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10, letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{
        fontSize: 36,
        fontWeight: 700,
        color: accentColor,
        fontFamily: '"JetBrains Mono", monospace',
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  );
}

export function StubNotice({ tasks }: { tasks: string[] }) {
  return (
    <div style={{
      padding: 20,
      background: "var(--card2)",
      border: "1px dashed var(--border-strong)",
      borderRadius: 8,
      color: "var(--text2)",
      fontSize: 13,
      lineHeight: 1.7,
    }}>
      <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
        待實作 (Task chain)
      </div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {tasks.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      padding: 16,
      background: "var(--card)",
      border: "1px solid var(--accent)",
      borderRadius: 8,
      color: "var(--accent)",
      marginBottom: 16,
      fontSize: 13,
    }}>
      載入錯誤:{message}
    </div>
  );
}

export function LoadingBox() {
  return <div style={{ color: "var(--text3)", padding: 24, fontSize: 13 }}>載入中…</div>;
}

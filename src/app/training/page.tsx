import Link from "next/link";

export const metadata = { title: "新訓區域 · 墨凡學院" };

const series = [
  {
    id: "hrbp",
    title: "HRBP 招募訓練系列",
    subtitle: "新進 HRBP 入職 14 天內的核心能力訓練",
    units: 4,
    totalMinutes: 55,
    prerequisite: "HR-051 公司與品牌故事 · HR-052 電訪話術基礎",
    href: "/training/hrbp",
  },
];

export default function TrainingHomePage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
      <header style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: "#F59E0B", fontWeight: 600 }}>
          MOYU · TRAINING
        </div>
        <h1 style={{ fontSize: 32, color: "#1E3A5F", fontWeight: 700, marginTop: 6 }}>
          新訓區域
        </h1>
        <p style={{ color: "#6B7280", marginTop: 8 }}>
          新進同仁的核心能力訓練系列。按系列順序學習，每集完成互動測驗解鎖下一集。
        </p>
      </header>

      <section style={{ display: "grid", gap: 16 }}>
        {series.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            style={{
              display: "block",
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              padding: 24,
              textDecoration: "none",
              color: "inherit",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ color: "#1E3A5F", fontWeight: 700, fontSize: 20 }}>{s.title}</div>
            <div style={{ color: "#6B7280", marginTop: 4 }}>{s.subtitle}</div>
            <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 14, color: "#374151" }}>
              <span>🎬 {s.units} 集</span>
              <span>⏱ 約 {s.totalMinutes} 分鐘</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
              前置：{s.prerequisite}
            </div>
          </Link>
        ))}
      </section>

      <footer style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #E5E7EB" }}>
        <Link href="/training/methods" style={{ color: "#1E3A5F", textDecoration: "none" }}>
          📘 HRBP 核心方法論 · 速查手冊 →
        </Link>
      </footer>
    </main>
  );
}

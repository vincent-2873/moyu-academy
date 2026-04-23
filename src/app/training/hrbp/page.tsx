import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";

export const metadata = { title: "HRBP 招募訓練系列 · 新訓區域" };
export const dynamic = "force-dynamic";

export default async function HrbpSeriesPage() {
  const supabase = getSupabaseAdmin();
  const { data: units } = await supabase
    .from("training_units")
    .select("unit_code, title, series_position, video_duration_seconds, published")
    .eq("series", "HRBP_RECRUIT_V1")
    .order("series_position", { ascending: true });

  const list = units || [];

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
      <nav style={{ fontSize: 14, marginBottom: 20 }}>
        <Link href="/training" style={{ color: "#6B7280", textDecoration: "none" }}>
          ← 新訓區域
        </Link>
      </nav>

      <header style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: "#F59E0B", fontWeight: 600 }}>
          HRBP RECRUIT · V1
        </div>
        <h1 style={{ fontSize: 32, color: "#1E3A5F", fontWeight: 700, marginTop: 6 }}>
          HRBP 招募訓練系列
        </h1>
        <p style={{ color: "#6B7280", marginTop: 8 }}>
          從敘薪制度到致命提問應對 · 四集走完約 55 分鐘 · 按順序解鎖
        </p>
      </header>

      <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {list.map((u) => {
          const mins = u.video_duration_seconds ? Math.round(u.video_duration_seconds / 60) : null;
          const ready = u.published;
          return (
            <li key={u.unit_code}>
              <Link
                href={ready ? `/training/hrbp/${u.unit_code}` : "#"}
                aria-disabled={!ready}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: ready ? "#FFFFFF" : "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  padding: 18,
                  textDecoration: "none",
                  color: ready ? "inherit" : "#9CA3AF",
                  cursor: ready ? "pointer" : "not-allowed",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                    EP{u.series_position} · {u.unit_code}
                  </div>
                  <div style={{ color: "#1E3A5F", fontWeight: 600, marginTop: 2 }}>{u.title}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "#6B7280" }}>
                  {mins && <span>⏱ {mins} 分</span>}
                  {ready ? <span style={{ color: "#F59E0B" }}>▶</span> : <span>🔒 準備中</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      {list.length === 0 && (
        <p style={{ color: "#9CA3AF", textAlign: "center", marginTop: 48 }}>
          單元資料尚未同步，請先跑 supabase-migration-training-units.sql
        </p>
      )}
    </main>
  );
}

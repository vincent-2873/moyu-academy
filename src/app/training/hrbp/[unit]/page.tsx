import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import UnitViewer from "./UnitViewer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ unit: string }> }) {
  const { unit } = await params;
  return { title: `${unit} · HRBP 招募訓練` };
}

export default async function HrbpUnitPage({ params }: { params: Promise<{ unit: string }> }) {
  const { unit } = await params;
  const supabase = getSupabaseAdmin();
  const { data: u, error } = await supabase
    .from("training_units")
    .select(
      "unit_code, title, series_position, series_total, video_url, video_duration_seconds, interactive_html_url, handbook_md, prerequisite_units, published"
    )
    .eq("unit_code", unit)
    .eq("series", "HRBP_RECRUIT_V1")
    .maybeSingle();

  if (error || !u) return notFound();

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      <nav style={{ fontSize: 14, marginBottom: 16 }}>
        <Link href="/training/hrbp" style={{ color: "#6B7280", textDecoration: "none" }}>
          ← HRBP 系列
        </Link>
      </nav>

      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: "#F59E0B", fontWeight: 600 }}>
          EP{u.series_position} / {u.series_total} · {u.unit_code}
        </div>
        <h1 style={{ fontSize: 28, color: "#1E3A5F", fontWeight: 700, marginTop: 6 }}>{u.title}</h1>
      </header>

      <UnitViewer
        unitCode={u.unit_code}
        videoUrl={u.video_url}
        interactiveHtmlUrl={u.interactive_html_url}
        handbookMd={u.handbook_md}
      />
    </main>
  );
}

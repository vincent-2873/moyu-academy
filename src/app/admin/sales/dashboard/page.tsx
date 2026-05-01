"use client";

import { useEffect, useState } from "react";
import FocusBoard from "@/components/admin/FocusBoard";

interface ChairmanBrand {
  id: string;
  name: string;
  color: string;
  active_reps?: number;
  silent_reps?: number;
  today_calls?: number;
  today_appointments?: number;
  today_closures?: number;
  status: string;
  diagnosis: string;
}

interface ChairmanData {
  ok: boolean;
  generated_at: string;
  empire: {
    total_active_reps: number;
    total_silent_today: number;
    total_calls_today: number;
    total_appointments_today: number;
    total_closures_today: number;
  };
  sales_brands: ChairmanBrand[];
}

export default function AdminSalesDashboardPage() {
  const [data, setData] = useState<ChairmanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/chairman-overview", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📊 業務戰況</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          集團漏斗 / 5 品牌橫向對比 / 排行榜 / 三層下鑽
        </p>
      </div>

      {loading && <div style={infoBox}>載入中…</div>}

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
          <KpiCard label="在線業務" value={data.empire.total_active_reps} sub={`${data.empire.total_silent_today} 沒開口`} />
          <KpiCard label="今日通數" value={data.empire.total_calls_today} />
          <KpiCard label="今日邀約" value={data.empire.total_appointments_today} />
          <KpiCard label="今日成交" value={data.empire.total_closures_today} />
        </div>
      )}

      {data?.sales_brands && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
          {data.sales_brands.map((b) => (
            <div key={b.id} style={{ background: "var(--ink-paper, #FAFAF7)", border: "1px solid var(--ink-line, #E5E2DA)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: b.color }}>{b.name}</div>
              <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 4 }}>狀態: {b.status}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                <Stat label="在線" value={b.active_reps || 0} />
                <Stat label="今日通" value={b.today_calls || 0} />
                <Stat label="邀約" value={b.today_appointments || 0} />
                <Stat label="成交" value={b.today_closures || 0} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text2, #666)", marginTop: 10, lineHeight: 1.5 }}>{b.diagnosis}</div>
            </div>
          ))}
        </div>
      )}

      <FocusBoard />
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{ background: "var(--ink-paper, #FAFAF7)", border: "1px solid var(--ink-line, #E5E2DA)", borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, color: "var(--text3, #888)", letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text3, #888)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text3, #888)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const infoBox: React.CSSProperties = {
  padding: 14,
  background: "var(--ink-mist, #F0EFEA)",
  borderRadius: 6,
  fontSize: 14,
};

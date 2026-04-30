"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PageHeader, KPICard, ErrorBox, LoadingBox, SectionHeader, StuckCard,
  type AttentionItem, type AttentionAction,
} from "../_components";

interface AttentionData {
  ok: boolean;
  generated_at: string;
  urgent: AttentionItem[];
  normal: AttentionItem[];
  resolved_today: AttentionItem[];
}

export default function AttentionPage() {
  const [data, setData] = useState<AttentionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/training-ops/attention")
      .then(r => r.json())
      .then((d: AttentionData) => setData(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = useCallback(async (id: string, action: AttentionAction) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/training-ops/attention/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.ok) {
        setActionError(json.error ?? "Action failed");
        return;
      }
      load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }, [load]);

  return (
    <div>
      <PageHeader
        title="需介入清單"
        subtitle="Claude 處理不了的,丟給你 — 只看真正需要 Vincent 親自接的人"
      />

      {error && <ErrorBox message={error} />}
      {actionError && <ErrorBox message={`動作失敗:${actionError}`} />}
      {!data && !error && <LoadingBox />}

      {data && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}>
            <KPICard label="🔴 緊急"     value={data.urgent.length} accent={data.urgent.length > 0 ? "ruby" : "default"} />
            <KPICard label="🟡 一般"     value={data.normal.length} accent={data.normal.length > 0 ? "amber" : "default"} />
            <KPICard label="✓ 24h 已處理" value={data.resolved_today.length} />
          </div>

          {/* 緊急 */}
          <SectionHeader title="🔴 緊急" count={data.urgent.length} accent="ruby" />
          {data.urgent.length === 0 ? (
            <EmptyHint text="目前沒有緊急案例。" />
          ) : (
            data.urgent.map(item => (
              <StuckCard key={item.id} item={item} onAction={handleAction} />
            ))
          )}

          {/* 一般 */}
          <SectionHeader title="🟡 一般" count={data.normal.length} accent="amber" />
          {data.normal.length === 0 ? (
            <EmptyHint text="目前沒有一般案例。" />
          ) : (
            data.normal.map(item => (
              <StuckCard key={item.id} item={item} onAction={handleAction} />
            ))
          )}

          {/* 24h 已處理 */}
          <SectionHeader title="✓ 24h 內已處理" count={data.resolved_today.length} accent="jade" />
          {data.resolved_today.length === 0 ? (
            <EmptyHint text="今天還沒處理任何案例。" />
          ) : (
            data.resolved_today.map(item => (
              <StuckCard key={item.id} item={item} onAction={handleAction} disabled />
            ))
          )}
        </>
      )}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{
      padding: 16, background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 8, color: "var(--text3)", fontSize: 13, marginBottom: 16,
    }}>
      {text}
    </div>
  );
}

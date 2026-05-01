"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PageHeader, KPICard, StubNotice, ErrorBox, LoadingBox,
  DraftPreviewBlock, brandLabel,
  type DraftModule,
} from "../_components";

interface MaterialsRow {
  brand: string;
  path_id?: string;
  path_code: string;
  expected: number;
  actual: number;
  missing: number;
  status: "complete" | "incomplete" | "empty";
}

interface MaterialsData {
  ok: boolean;
  generated_at: string;
  by_brand: MaterialsRow[];
}

export default function MaterialsPage() {
  const [data, setData] = useState<MaterialsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // generate / adopt 狀態 keyed by `${path_id}|${brand}`
  const [drafts, setDrafts] = useState<Record<string, DraftModule[]>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [generateErr, setGenerateErr] = useState<Record<string, string>>({});
  const [adopting, setAdopting] = useState<Record<string, boolean>>({});
  const [adoptErr, setAdoptErr] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    fetch("/api/admin/training-ops/materials")
      .then(r => r.json())
      .then((d: MaterialsData) => setData(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const keyFor = (row: MaterialsRow) => `${row.path_id ?? row.path_code}|${row.brand}`;

  const handleGenerate = useCallback(async (row: MaterialsRow) => {
    if (!row.path_id) {
      setGenerateErr(prev => ({ ...prev, [keyFor(row)]: "path_id 缺失,無法生成" }));
      return;
    }
    const key = keyFor(row);
    setGenerating(prev => ({ ...prev, [key]: true }));
    setGenerateErr(prev => ({ ...prev, [key]: "" }));
    try {
      const res = await fetch("/api/admin/training-ops/materials/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path_id: row.path_id, brand: row.brand }),
      });
      const json = await res.json();
      if (!json.ok) {
        setGenerateErr(prev => ({ ...prev, [key]: json.error ?? "Unknown error" }));
      } else {
        setDrafts(prev => ({ ...prev, [key]: json.drafts as DraftModule[] }));
      }
    } catch (e: unknown) {
      setGenerateErr(prev => ({ ...prev, [key]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setGenerating(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  const handleAdoptAll = useCallback(async (row: MaterialsRow) => {
    if (!row.path_id) return;
    const key = keyFor(row);
    setAdopting(prev => ({ ...prev, [key]: true }));
    setAdoptErr(prev => ({ ...prev, [key]: "" }));
    try {
      const res = await fetch("/api/admin/training-ops/materials/adopt-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path_id: row.path_id, brand: row.brand }),
      });
      const json = await res.json();
      if (!json.ok) {
        setAdoptErr(prev => ({ ...prev, [key]: json.error ?? "Adopt failed" }));
      } else {
        setDrafts(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        load();
      }
    } catch (e: unknown) {
      setAdoptErr(prev => ({ ...prev, [key]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setAdopting(prev => ({ ...prev, [key]: false }));
    }
  }, [load]);

  return (
    <div>
      <PageHeader
        title="教材管理"
        subtitle="各品牌 × path 的訓練模組完整度,Claude 自動補草稿"
      />

      {error && <ErrorBox message={error} />}
      {!data && !error && <LoadingBox />}

      {data && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}>
            <KPICard label="完整 brand × path" value={data.by_brand.filter(b => b.status === "complete").length} />
            <KPICard label="缺部分"            value={data.by_brand.filter(b => b.status === "incomplete").length} accent="amber" />
            <KPICard label="全空(全新品牌)"  value={data.by_brand.filter(b => b.status === "empty").length}      accent="ruby" />
          </div>

          {data.by_brand.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
                各品牌完整度
              </h2>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {data.by_brand.map(row => {
                  const key = keyFor(row);
                  return (
                    <div key={row.path_code}>
                      <BrandRow row={row} />
                      {row.status !== "complete" && (
                        <div style={{ paddingLeft: 16, marginBottom: 16 }}>
                          {!drafts[key] && (
                            <button
                              onClick={() => handleGenerate(row)}
                              disabled={generating[key]}
                              style={{
                                padding: "8px 14px",
                                background: generating[key] ? "var(--card2)" : "var(--card)",
                                color: "var(--text)",
                                border: "1px solid var(--gold)",
                                borderRadius: 6,
                                fontSize: 13, fontWeight: 500,
                                cursor: generating[key] ? "wait" : "pointer",
                                marginTop: 8,
                              }}
                            >
                              {generating[key] ? "Claude 生成中…" : "✨ Claude 補缺 module(基於 nSchool 8 步驟+4 本書)"}
                            </button>
                          )}
                          {generateErr[key] && (
                            <ErrorBox message={generateErr[key]} />
                          )}
                          {drafts[key] && (
                            <DraftPreviewBlock
                              drafts={drafts[key]}
                              onAdoptAll={() => handleAdoptAll(row)}
                              adopting={adopting[key] ?? false}
                              adoptError={adoptErr[key] ?? null}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <StubNotice tasks={[
            "✓ generate-draft + adopt-draft API(對齊 nSchool 真實 8 步驟 + 4 本書,延伸 D2 既有,不從零生)",
            "✓ Phase B-4 後修:砍「28 module」hardcode,改成依 path 既有 module 補缺",
            "✓ Phase B-5 後修:對齊 BIZ_MODULE_SPEC §8 教材管理規範",
            "Task 1.6 待實作:Top 5 / Bottom 5 modules 成效 + Claude 評估",
            "後續迭代:加 RAG retrieval(從 knowledge_chunks pillar='sales' 撈 nSchool chunk 進 prompt)",
          ]} />
        </>
      )}
    </div>
  );
}

function BrandRow({ row }: { row: MaterialsRow }) {
  const statusColor = row.status === "complete" ? "var(--green)" : row.status === "empty" ? "var(--accent)" : "var(--gold)";
  const statusText  = row.status === "complete" ? "✓ 完整"      : row.status === "empty" ? "🆕 全新"   : "⚠ 缺部分";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "12px 16px",
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      marginBottom: 8,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
          {brandLabel(row.brand)}
        </div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>
          {row.path_code}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--text2)", fontFamily: '"JetBrains Mono", monospace' }}>
        {row.actual} / {row.expected}
      </div>
      <div style={{ fontSize: 12, color: statusColor, fontWeight: 500, minWidth: 80, textAlign: "right" }}>
        {statusText}
      </div>
    </div>
  );
}

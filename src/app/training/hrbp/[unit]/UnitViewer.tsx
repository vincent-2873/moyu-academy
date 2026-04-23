"use client";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/store";

type Props = {
  unitCode: string;
  videoUrl: string | null;
  interactiveHtmlUrl: string | null;
  handbookMd: string | null;
};

type Stage = "video" | "quiz" | "done";

export default function UnitViewer({ unitCode, videoUrl, interactiveHtmlUrl, handbookMd }: Props) {
  const [stage, setStage] = useState<Stage>(videoUrl ? "video" : "quiz");
  const [result, setResult] = useState<{ score?: number; total?: number; passed?: boolean } | null>(null);
  const [emailReady, setEmailReady] = useState<string | null>(null);

  useEffect(() => {
    const u = getCurrentUser();
    setEmailReady(u?.email ?? null);
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const trusted = e.origin === window.location.origin || interactiveHtmlUrl?.startsWith(e.origin);
      if (!trusted) return;
      const msg = e.data as { type?: string; unit?: string; score?: number; total?: number; passed?: boolean; series_complete?: boolean };
      if (msg?.type !== "unit_complete") return;
      if (msg.unit !== unitCode) return;
      setResult({ score: msg.score, total: msg.total, passed: msg.passed });
      setStage("done");

      if (emailReady) {
        fetch("/api/training-progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: emailReady,
            unit_code: unitCode,
            status: msg.passed ? "passed" : "failed",
            score: msg.score,
            total: msg.total,
            passed: msg.passed,
            series_complete: msg.series_complete ?? false,
          }),
        }).catch((err) => console.error("[training-progress] post failed", err));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [unitCode, interactiveHtmlUrl, emailReady]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <StageTabs stage={stage} setStage={setStage} hasVideo={!!videoUrl} hasHandbook={!!handbookMd} />

      {stage === "video" && videoUrl && (
        <div style={{ aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", background: "#000" }}>
          <video
            src={videoUrl}
            controls
            preload="metadata"
            style={{ width: "100%", height: "100%" }}
            onEnded={() => setStage("quiz")}
          />
        </div>
      )}

      {stage === "quiz" &&
        (interactiveHtmlUrl ? (
          <iframe
            src={interactiveHtmlUrl}
            title={`${unitCode} interactive quiz`}
            style={{ width: "100%", minHeight: 720, border: "1px solid #E5E7EB", borderRadius: 12 }}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <Empty hint="互動測驗尚未發佈" />
        ))}

      {stage === "done" && result && (
        <div
          style={{
            background: result.passed ? "#ECFDF5" : "#FEF2F2",
            border: `1px solid ${result.passed ? "#10B981" : "#EF4444"}`,
            color: result.passed ? "#065F46" : "#991B1B",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18 }}>
            {result.passed ? "✅ 通過！" : "❌ 未通過"}
          </div>
          <div style={{ marginTop: 4 }}>
            分數：{result.score} / {result.total}
          </div>
        </div>
      )}

      {handbookMd && stage === "done" && (
        <details style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, color: "#1E3A5F" }}>
            📘 查閱本單元手冊
          </summary>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 12, fontSize: 14, color: "#374151" }}>
            {handbookMd}
          </pre>
        </details>
      )}
    </div>
  );
}

function StageTabs({
  stage,
  setStage,
  hasVideo,
  hasHandbook,
}: {
  stage: Stage;
  setStage: (s: Stage) => void;
  hasVideo: boolean;
  hasHandbook: boolean;
}) {
  const tabs: { id: Stage; label: string; enabled: boolean }[] = [
    { id: "video", label: "🎬 影片", enabled: hasVideo },
    { id: "quiz", label: "🧪 互動測驗", enabled: true },
    { id: "done", label: hasHandbook ? "📘 手冊 + 結果" : "📊 結果", enabled: true },
  ];
  return (
    <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #E5E7EB" }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          disabled={!t.enabled}
          onClick={() => setStage(t.id)}
          style={{
            padding: "10px 14px",
            background: "transparent",
            border: "none",
            borderBottom: stage === t.id ? "2px solid #F59E0B" : "2px solid transparent",
            color: stage === t.id ? "#1E3A5F" : "#6B7280",
            fontWeight: stage === t.id ? 700 : 500,
            cursor: t.enabled ? "pointer" : "not-allowed",
            opacity: t.enabled ? 1 : 0.5,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div
      style={{
        padding: 40,
        textAlign: "center",
        color: "#9CA3AF",
        border: "1px dashed #E5E7EB",
        borderRadius: 12,
      }}
    >
      {hint}
    </div>
  );
}

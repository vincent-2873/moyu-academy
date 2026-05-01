"use client";

import { useEffect, useState } from "react";
import KnowledgeEngineEditor from "@/components/admin/KnowledgeEngineEditor";
import RagUploadPanel from "@/components/admin/RagUploadPanel";
import RagReviewQueue from "@/components/admin/RagReviewQueue";
import IngestLocalTrigger from "@/components/admin/IngestLocalTrigger";

export default function AdminClaudeKnowledgePage() {
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("moyu_admin_session");
    if (stored) {
      try {
        const json = JSON.parse(stored);
        setAdminEmail(json.email || "");
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📚 知識庫管理</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          RAG 三池(sales / legal / common)分類管理 + Notion 同步 + 上傳審核
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <IngestLocalTrigger />
        <KnowledgeEngineEditor />
        <RagUploadPanel email={adminEmail} />
        <RagReviewQueue />
      </div>
    </div>
  );
}

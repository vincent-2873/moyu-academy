"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Props {
  onClick: () => void;
}

export default function SidebarSetupProgress({ onClick }: Props) {
  const [percent, setPercent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/setup-status")
      .then(r => r.json())
      .then(d => {
        // 算完成度 — 依據 env 設定數量 + metabase rows
        let done = 0;
        let total = 5;
        if (d.metabase_rows > 0) done++;
        if (d.has_notion_token) done++;
        if (d.has_google_secret) done++;
        if (d.has_discord_secret) done++;
        if (d.line_callback_correct) done++;
        setPercent(Math.round((done / total) * 100));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        width: "calc(100% - 24px)",
        margin: "8px 12px 4px",
        padding: "10px 12px",
        background: percent === 100 ? "var(--bg-elev)" : "transparent",
        border: `1px solid ${percent < 60 ? "var(--accent-red)" : percent < 100 ? "var(--gold-thread, #c9a96e)" : "var(--border-soft, rgba(26,26,26,0.10))"}`,
        borderRadius: 4,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 9, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600 }}>SETUP</span>
        <span style={{ fontSize: 11, fontFamily: "var(--font-jetbrains-mono)", fontWeight: 600, color: percent === 100 ? "var(--gold-thread, #c9a96e)" : percent < 60 ? "var(--accent-red)" : "var(--ink-deep)" }}>
          {percent}%
        </span>
      </div>
      <div style={{ height: 3, background: "var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 2, overflow: "hidden", position: "relative" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1.0, ease: "easeOut" }}
          style={{
            height: "100%",
            background: percent === 100 ? "var(--gold-thread, #c9a96e)" : percent < 60 ? "var(--accent-red)" : "var(--ink-deep)",
          }}
        />
      </div>
    </motion.button>
  );
}

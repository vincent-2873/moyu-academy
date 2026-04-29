"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * SetupWizard — Vincent 1-click setup checklist
 *
 * 列出需要 Vincent 自己點一次的 setup task:
 *   - Notion integration token
 *   - LINE callback URL
 *   - Discord secret rotate
 *   - Metabase backfill verify
 *
 * 每個 task 顯示:狀態 / 一鍵連結 / 說明 / 完成後做什麼
 */

type Task = {
  id: string;
  title: string;
  status: "done" | "pending" | "needs_action" | "running";
  description: string;
  cta?: { label: string; url: string };
  note?: string;
};

export default function SetupWizard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/setup-status")
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const tasks: Task[] = [
    {
      id: "metabase",
      title: "Metabase 業務數據自動同步",
      status: stats?.metabase_rows > 0 ? "done" : "running",
      description: "GitHub Actions 每天 09:00 + 17:00 台北自動撈 Q1381 業務指標進 sales_metrics_daily。",
      note: stats?.metabase_rows
        ? `已有 ${stats.metabase_rows.toLocaleString()} rows · ${stats.metabase_distinct_dates} 天 · ${stats.metabase_distinct_people} 人`
        : "Backfill 跑著,5-15 分鐘完成",
      cta: { label: "看 Actions log", url: "https://github.com/vincent-2873/moyu-academy/actions/workflows/metabase-daily-sync.yml" },
    },
    {
      id: "notion",
      title: "Notion 知識庫 RAG 整合",
      status: stats?.has_notion_token ? "done" : "needs_action",
      description: "把你 Notion 4 品牌訓練 + HRBP 6 個逐字稿同步進 RAG 知識庫,戰情官對話自動引用。",
      cta: { label: "建 Notion Integration → 取 token", url: "https://www.notion.so/profile/integrations/internal/form/new-integration" },
      note: "1) 點連結 → 2) 名字填 'moyu-academy-rag' → 3) 選你的 workspace → 4) 點建立 → 5) 複製顯示的 secret token",
    },
    {
      id: "line",
      title: "LINE 一鍵登入 callback URL",
      status: stats?.line_callback_correct ? "done" : "needs_action",
      description: "LINE Developer Console → Login channel → Callback URL 改成 https://moyusales.zeabur.app/api/line/oauth/callback",
      cta: { label: "進 LINE Developer Console", url: "https://developers.line.biz/console/" },
      note: "原本指向老 luynflhuzbcbajycvuet.supabase.co,要改新 URL 才能 LINE 一鍵登入",
    },
    {
      id: "discord",
      title: "Discord secret rotate(資安)",
      status: "needs_action",
      description: "之前 Discord secret 在 chat plaintext 過(2026-04-29),建議 rotate 一次。",
      cta: { label: "進 Discord Developer Portal", url: "https://discord.com/developers/applications" },
      note: "OAuth2 → Reset Client Secret → 複製新 secret → paste 到 Zeabur env DISCORD_OAUTH_CLIENT_SECRET",
    },
    {
      id: "google_oauth",
      title: "Google OAuth secret(可選)",
      status: stats?.has_google_secret ? "done" : "needs_action",
      description: "Google login 走 Supabase Auth provider(huance 已配),這裡是備援獨立 OAuth client 用。",
      cta: { label: "進 Google Cloud Console", url: "https://console.cloud.google.com/auth/clients/68172491156-ibt265pv98phsbmb3dl2qqeegf2q6ccb.apps.googleusercontent.com?project=nschool-my-project" },
      note: "Add secret → 複製 → paste Zeabur env GOOGLE_OAUTH_CLIENT_SECRET",
    },
  ];

  if (loading) return <div className="p-12 text-center text-sm" style={{ color: "var(--ink-mid)" }}>載入 setup 狀態…</div>;

  const doneCount = tasks.filter(t => t.status === "done").length;
  const totalCount = tasks.length;
  const percent = Math.round((doneCount / totalCount) * 100);

  return (
    <div style={{ padding: "40px 32px 80px", maxWidth: 980, margin: "0 auto" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}>
        ADMIN · 1-CLICK SETUP
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 600, color: "var(--ink-deep)", letterSpacing: 4, marginBottom: 16, lineHeight: 1.1 }}
      >
        Setup 完成度 · {percent}%
      </motion.h1>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ fontSize: 13, color: "var(--ink-mid)", marginBottom: 32, lineHeight: 1.7 }}>
        {doneCount} / {totalCount} 件完成 · 每件 30 秒~2 分鐘
      </motion.div>

      {/* progress bar */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
        style={{ height: 4, background: "var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 2, marginBottom: 56, transformOrigin: "left", position: "relative", overflow: "hidden" }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
          style={{ height: "100%", background: "var(--accent-red, #b91c1c)" }}
        />
      </motion.div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {tasks.map((task, idx) => (
          <TaskCard key={task.id} task={task} delay={0.6 + idx * 0.1} />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        style={{ marginTop: 48, padding: 24, background: "var(--bg-elev)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6, fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.8 }}
      >
        <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 16, color: "var(--ink-deep)", marginBottom: 8 }}>狀態說明</div>
        每個 task 完成後系統會自動偵測。完成後本頁面狀態會自動更新為 ✓ 已完成。<br/>
        每個 secret 你 paste 進 Zeabur env 後 deploy 約 1-2 分鐘自動上線。
      </motion.div>
    </div>
  );
}

function TaskCard({ task, delay }: { task: Task; delay: number }) {
  const statusMap: Record<string, { color: string; label: string; icon: string }> = {
    done:         { color: "var(--gold-thread, #c9a96e)", label: "已完成",  icon: "●" },
    running:      { color: "var(--accent-red)",            label: "進行中",  icon: "○" },
    pending:      { color: "var(--ink-mid)",               label: "待處理",  icon: "·" },
    needs_action: { color: "var(--accent-red)",            label: "需動作",  icon: "▲" },
  };
  const s = statusMap[task.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -2 }}
      style={{
        padding: 24,
        background: "var(--bg-paper)",
        border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
        borderRadius: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <span style={{ color: s.color, fontSize: 14 }}>{s.icon}</span>
        <span style={{ fontSize: 10, color: s.color, letterSpacing: 2, fontWeight: 600 }}>{s.label}</span>
        <h3 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", letterSpacing: 1, fontWeight: 500, marginLeft: 4 }}>
          {task.title}
        </h3>
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.7, marginBottom: 12, paddingLeft: 28 }}>
        {task.description}
      </div>
      {task.note && (
        <div style={{ fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.7, marginBottom: 14, paddingLeft: 28, background: "var(--bg-elev)", padding: "8px 12px", borderRadius: 4 }}>
          {task.note}
        </div>
      )}
      {task.cta && task.status !== "done" && (
        <div style={{ paddingLeft: 28 }}>
          <motion.a
            href={task.cta.url}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: "inline-block",
              padding: "8px 18px",
              borderRadius: 4,
              background: "var(--ink-deep)",
              color: "var(--bg-paper)",
              fontSize: 12,
              fontFamily: "var(--font-noto-serif-tc)",
              textDecoration: "none",
              letterSpacing: 2,
            }}
          >
            {task.cta.label} →
          </motion.a>
        </div>
      )}
    </motion.div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STAGE_NAMES: Record<string, string> = {
  beginner: "研墨者",
  intermediate: "執筆者",
  advanced: "點墨者",
  master: "執印者",
};

const PATH_NAMES: Record<string, string> = {
  business: "業務養成",
  legal: "法務養成",
  common: "通用養成",
};

export default function AccountClient() {
  const [email, setEmail] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const e = sessionStorage.getItem("moyu_current_user")
      || sessionStorage.getItem("admin_email")
      || localStorage.getItem("admin_email");
    setEmail(e);
  }, []);

  useEffect(() => {
    if (!email) { setLoading(false); return; }
    fetch(`/api/me/training?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => { setUser(d.user); setLoading(false); })
      .catch(() => setLoading(false));
  }, [email]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0,1,0.4,1] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ textAlign: "center", padding: 80, color: "var(--ink-mid)", letterSpacing: 4, fontFamily: "var(--font-noto-serif-tc)" }}>
          載 入 帳 號
        </motion.div>
      </div>
    );
  }

  if (!email || !user) {
    return (
      <div style={pageStyle}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", padding: 80 }}>
          <h1 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 64, color: "var(--ink-deep)", letterSpacing: 8, marginBottom: 16 }}>未 登 入</h1>
          <a href="/" style={{ color: "var(--accent-red)" }}>回登入頁</a>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 32px" }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 12, fontWeight: 600 }}>
          MOYU · ACCOUNT
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.0, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            fontFamily: "var(--font-noto-serif-tc)",
            fontSize: "clamp(48px, 8vw, 96px)",
            fontWeight: 600,
            color: "var(--ink-deep)",
            letterSpacing: 4,
            lineHeight: 1.05,
            marginBottom: 16,
          }}
        >
          {user.name || "夥伴"}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ fontSize: 14, color: "var(--ink-mid)", marginBottom: 48, letterSpacing: 1, lineHeight: 1.7 }}
        >
          <span style={{ fontFamily: "var(--font-noto-serif-tc)", color: "var(--accent-red)", fontWeight: 600 }}>
            {STAGE_NAMES[user.stage] || "研墨者"}
          </span>
          <span> · {PATH_NAMES[user.stage_path] || "通用"}</span>
          <span> · {user.brand || "墨宇"}</span>
          <span> · {user.email}</span>
        </motion.div>

        <KintsugiLine delay={0.5} />

        {/* 個人資料 */}
        <SectionLabel delay={0.7}>己 · PROFILE</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 56 }}>
          <InfoCard label="姓名" value={user.name || "—"} delay={0.8} />
          <InfoCard label="信箱" value={user.email} delay={0.85} mono />
          <InfoCard label="階段稱號" value={STAGE_NAMES[user.stage] || "—"} delay={0.9} />
          <InfoCard label="養成路徑" value={PATH_NAMES[user.stage_path] || "—"} delay={0.95} />
          <InfoCard label="所屬品牌" value={user.brand || "—"} delay={1.0} />
          <InfoCard label="加入日期" value={user.created_at ? new Date(user.created_at).toISOString().slice(0, 10) : "—"} delay={1.05} mono />
        </div>

        {/* 綁定狀態 */}
        <SectionLabel delay={1.1}>綁 · BINDINGS</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 56 }}>
          <BindCard label="LINE" bound={!!user.line_user_id} bindUrl="/api/line/oauth/start?mode=bind" color="#06C755" delay={1.2} />
          <BindCard label="Google" bound={!!user.google_id} bindUrl="" color="#4285F4" delay={1.25} disabled hint="從登入頁 Google 一鍵登入綁定" />
          <BindCard label="Discord" bound={!!user.discord_id} bindUrl="/api/auth/discord/start?mode=bind" color="#5865F2" delay={1.3} />
        </div>

        {/* 動作 */}
        <SectionLabel delay={1.4}>動 · ACTIONS</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 48 }}>
          <ActionCard label="改密碼" href="/account/password" delay={1.5} />
          <ActionCard label="登出" href="#logout" onClick={() => {
            sessionStorage.removeItem("moyu_current_user");
            sessionStorage.removeItem("admin_email");
            localStorage.removeItem("admin_email");
            window.location.href = "/";
          }} delay={1.55} variant="danger" />
        </div>

        <NavBar active="account" />
      </div>
    </div>
  );
}

function InfoCard({ label, value, delay = 0, mono = false }: { label: string; value: any; delay?: number; mono?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -2 }}
      style={{ padding: 20, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6 }}
    >
      <div style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 3, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{
        fontFamily: mono ? "var(--font-jetbrains-mono)" : "var(--font-noto-serif-tc)",
        fontSize: mono ? 13 : 16,
        color: "var(--ink-deep)",
        wordBreak: "break-all",
      }}>
        {value}
      </div>
    </motion.div>
  );
}

function BindCard({ label, bound, bindUrl, color, delay = 0, disabled = false, hint }: { label: string; bound: boolean; bindUrl: string; color: string; delay?: number; disabled?: boolean; hint?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -2 }}
      style={{ padding: 20, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: color }}/>
        <span style={{ fontSize: 10, color: "var(--ink-mid)", letterSpacing: 3, fontWeight: 600, textTransform: "uppercase" }}>{label}</span>
        {bound && <span style={{ fontSize: 10, color: "var(--accent-red)", marginLeft: "auto", fontFamily: "var(--font-noto-serif-tc)" }}>● 已綁</span>}
      </div>
      {bound ? (
        <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 14, color: "var(--ink-deep)" }}>已綁定</div>
      ) : disabled ? (
        <div style={{ fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.7 }}>{hint || "未綁定"}</div>
      ) : (
        <motion.a
          href={bindUrl}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: "inline-block",
            padding: "6px 14px",
            borderRadius: 4,
            background: "var(--ink-deep)",
            color: "var(--bg-paper)",
            fontSize: 12,
            fontFamily: "var(--font-noto-serif-tc)",
            textDecoration: "none",
            letterSpacing: 2,
          }}
        >
          綁定
        </motion.a>
      )}
    </motion.div>
  );
}

function ActionCard({ label, href, onClick, delay = 0, variant }: { label: string; href: string; onClick?: () => void; delay?: number; variant?: "danger" | "default" }) {
  const isDanger = variant === "danger";
  return (
    <motion.a
      href={onClick ? undefined : href}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      style={{
        padding: 20,
        background: isDanger ? "transparent" : "var(--bg-paper)",
        border: `1px solid ${isDanger ? "var(--accent-red)" : "var(--border-soft, rgba(26,26,26,0.10))"}`,
        borderRadius: 6,
        textDecoration: "none",
        cursor: "pointer",
        display: "block",
      }}
    >
      <div style={{
        fontFamily: "var(--font-noto-serif-tc)",
        fontSize: 18,
        color: isDanger ? "var(--accent-red)" : "var(--ink-deep)",
        letterSpacing: 4,
        textAlign: "center",
      }}>
        {label}
      </div>
    </motion.a>
  );
}

function SectionLabel({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay }} style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 4, marginBottom: 16, fontWeight: 600 }}>
      {children}
    </motion.div>
  );
}

function KintsugiLine({ delay = 0 }: { delay?: number }) {
  return (
    <motion.svg
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ delay, duration: 0.8 }}
      width="100%" height="3"
      style={{ display: "block", transformOrigin: "left", marginBottom: 56 }}
    >
      <line x1="0" y1="1.5" x2="100%" y2="1.5" stroke="var(--gold-thread, #c9a96e)" strokeWidth="1" strokeDasharray="2 4" />
    </motion.svg>
  );
}

function NavBar({ active }: { active: "home" | "work" | "learn" | "account" }) {
  const items = [
    { id: "home", label: "今天", href: "/home" },
    { id: "work", label: "數據", href: "/work" },
    { id: "learn", label: "養成", href: "/learn" },
    { id: "account", label: "帳號", href: "/account" },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7 }} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 64 }}>
      {items.map(it => (
        <motion.a
          key={it.id}
          href={it.href}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          style={{
            textAlign: "center",
            padding: "14px 0",
            borderRadius: 4,
            background: active === it.id ? "var(--ink-deep)" : "transparent",
            color: active === it.id ? "var(--bg-paper)" : "var(--ink-deep)",
            border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
            fontFamily: "var(--font-noto-serif-tc)",
            fontSize: 14,
            textDecoration: "none",
            letterSpacing: 4,
          }}
        >
          {it.label}
        </motion.a>
      ))}
    </motion.div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg-paper, #f7f1e3)",
  color: "var(--ink-deep, #1a1a1a)",
};

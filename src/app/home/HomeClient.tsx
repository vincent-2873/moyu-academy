"use client";

import { useEffect, useState } from "react";
import { Stamp } from "@/components/wabi/Stamp";

/**
 * /home — 早晨儀式(5 分鐘進入工作狀態)
 *
 * spec A1: 簽到 / Claude 早安 / 今日待辦 / 公告
 * 不放數據細節(數據在 /work)
 */

const STAGE_NAMES: Record<string, string> = {
  beginner: "研墨者",
  intermediate: "執筆者",
  advanced: "點墨者",
  master: "執印者",
};

export default function HomeClient() {
  const [email, setEmail] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [todayModules, setTodayModules] = useState<any[]>([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [greeting, setGreeting] = useState("");
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
      .then(d => {
        setUser(d.user);
        const cd = d.assignment?.current_day ?? 0;
        const today = (d.modules || []).filter((m: any) => m.day_offset === cd);
        setTodayModules(today);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // 早安詞(時段化 + 階段化)
    const hour = new Date().getHours();
    const period = hour < 6 ? "凌晨" : hour < 12 ? "早安" : hour < 18 ? "午安" : "晚安";
    setGreeting(period);

    // 今日簽到狀態
    const todayKey = `checkin_${email}_${new Date().toISOString().slice(0, 10)}`;
    setCheckedIn(!!localStorage.getItem(todayKey));
  }, [email]);

  function checkin() {
    if (!email || checkedIn) return;
    const todayKey = `checkin_${email}_${new Date().toISOString().slice(0, 10)}`;
    localStorage.setItem(todayKey, new Date().toISOString());
    setCheckedIn(true);
    // TODO: F1 補 API 寫進 DB(checkin_log 表)
  }

  if (loading) {
    return <div style={pageStyle}><Loader /></div>;
  }

  if (!email) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: "center", padding: 80 }}>
          <h1 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)" }}>未登入</h1>
          <a href="/" style={{ color: "var(--accent-red)", marginTop: 16, display: "inline-block" }}>回登入頁</a>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "60px 24px 80px" }}>
        {/* Hero greeting */}
        <div style={{ fontSize: 12, color: "var(--ink-mid)", letterSpacing: 2, marginBottom: 8 }}>
          MOYU · HOME · {new Date().toLocaleDateString("zh-TW", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <h1 style={{
          fontFamily: "var(--font-noto-serif-tc)",
          fontSize: 56,
          fontWeight: 600,
          color: "var(--ink-deep)",
          letterSpacing: 2,
          marginBottom: 12,
        }}>
          {greeting},{user?.name || "夥伴"}
        </h1>
        <div style={{ fontSize: 14, color: "var(--ink-mid)", marginBottom: 40 }}>
          {STAGE_NAMES[user?.stage] || "研墨者"} · {user?.brand || "墨宇"}
        </div>

        {/* 簽到 + 印章 */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card>
            <div style={cardLabel}>進入 · ARRIVAL</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
              {checkedIn ? (
                <>
                  <Stamp text="已到" rarity="rare" size={64} />
                  <div>
                    <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 20, color: "var(--ink-deep)" }}>已簽到</div>
                    <div style={{ fontSize: 12, color: "var(--ink-mid)" }}>今日報到完成,進入工作狀態</div>
                  </div>
                </>
              ) : (
                <button
                  onClick={checkin}
                  style={{
                    background: "var(--ink-deep)",
                    color: "var(--bg-paper)",
                    fontFamily: "var(--font-noto-serif-tc)",
                    padding: "14px 28px",
                    borderRadius: 6,
                    fontSize: 16,
                  }}
                >
                  簽到
                </button>
              )}
            </div>
          </Card>

          <Card>
            <div style={cardLabel}>狀態 · STATE</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 20, color: "var(--ink-deep)" }}>
                {STAGE_NAMES[user?.stage] || "研墨者"}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-mid)", marginTop: 4 }}>
                <a href="/learn" style={{ color: "var(--accent-red)" }}>看養成路徑 →</a>
              </div>
            </div>
          </Card>
        </div>

        {/* 今日任務 */}
        <div style={cardLabel}>今日 · TODAY · {todayModules.length} 任務</div>
        <KintsugiLine />
        <div className="space-y-3 mt-4">
          {todayModules.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--ink-mid)" }}>
              今天沒有派發任務,主管或 Claude 之後會派
            </div>
          ) : (
            todayModules.map((m: any) => (
              <div key={m.id} className="p-4 rounded-md" style={{
                background: "var(--bg-elev, rgba(247,241,227,0.85))",
                border: "1px solid var(--border-soft)",
              }}>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontSize: 11, color: "var(--ink-mid)", textTransform: "uppercase", letterSpacing: 1 }}>
                    {m.module_type}
                  </span>
                  {m.duration_min && <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>· {m.duration_min} 分</span>}
                </div>
                <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 18, color: "var(--ink-deep)", marginBottom: 4 }}>
                  {m.title}
                </div>
                {m.description && (
                  <div style={{ fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.6 }}>{m.description}</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 4 link bar */}
        <div className="mt-12 grid grid-cols-4 gap-2">
          <NavBtn href="/home" label="今天" active />
          <NavBtn href="/work" label="數據" />
          <NavBtn href="/learn" label="養成" />
          <NavBtn href="/account" label="帳號" />
        </div>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-md" style={{
      background: "var(--bg-paper)",
      border: "1px solid var(--border-soft)",
    }}>
      {children}
    </div>
  );
}

function NavBtn({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <a href={href} className="text-center py-3 rounded-md transition-colors" style={{
      background: active ? "var(--ink-deep)" : "transparent",
      color: active ? "var(--bg-paper)" : "var(--ink-deep)",
      border: "1px solid var(--border-soft)",
      fontFamily: "var(--font-noto-serif-tc)",
      fontSize: 14,
      textDecoration: "none",
    }}>
      {label}
    </a>
  );
}

function KintsugiLine() {
  return (
    <svg width="100%" height="3" style={{ display: "block" }}>
      <line x1="0" y1="1.5" x2="100%" y2="1.5" stroke="var(--gold-thread, #c9a96e)" strokeWidth="1" strokeDasharray="2 4" />
    </svg>
  );
}

function Loader() {
  return <div style={{ textAlign: "center", padding: 80, color: "var(--ink-mid)" }}>載入早晨儀式…</div>;
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg-paper, #f7f1e3)",
  color: "var(--ink-deep, #1a1a1a)",
};
const cardLabel: React.CSSProperties = {
  fontSize: 11,
  color: "var(--ink-mid)",
  letterSpacing: 2,
  fontWeight: 600,
};

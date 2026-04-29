"use client";

import { useEffect, useState } from "react";
import { Stamp } from "@/components/wabi/Stamp";

/**
 * /learn — 個人養成捲軸地圖
 *
 * 顯示:
 *   - 我的階段(研墨者 / 執筆者 / 點墨者 / 執印者)
 *   - 我的 path(business 14 天 / recruit 3 天)
 *   - Day 0-N 進度地圖(已完成/進行中/未解鎖)
 *   - 我已蓋的印章
 */

const STAGE_NAMES = {
  beginner: "研墨者",
  intermediate: "執筆者",
  advanced: "點墨者",
  master: "執印者",
};

const PATH_NAMES = {
  business: "業務養成",
  recruit: "招募養成",
  legal: "法務養成",
  common: "通用養成",
};

const MODULE_TYPE_ICON: Record<string, string> = {
  video: "▶",
  reading: "📖",
  quiz: "✎",
  sparring: "🗣",
  task: "▤",
  reflection: "✿",
  live_session: "◉",
};

export default function LearnClient() {
  const [email, setEmail] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const e = sessionStorage.getItem("moyu_current_user")
      || sessionStorage.getItem("admin_email")
      || localStorage.getItem("admin_email");
    setEmail(e);
  }, []);

  useEffect(() => {
    if (!email) {
      setLoading(false);
      return;
    }
    fetch(`/api/me/training?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [email]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: "center", padding: 80, color: "var(--ink-mid)" }}>載入養成地圖…</div>
      </div>
    );
  }

  if (!email) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: "center", padding: 80 }}>
          <h1 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", marginBottom: 16 }}>未登入</h1>
          <a href="/" style={{ color: "var(--accent-red)" }}>回登入頁</a>
        </div>
      </div>
    );
  }

  if (!data?.path || !data?.modules?.length) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: "center", padding: 80 }}>
          <h1 style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 32, color: "var(--ink-deep)", marginBottom: 16 }}>還沒分配養成路徑</h1>
          <p style={{ color: "var(--ink-mid)" }}>主管會在報到後派任,稍候。</p>
        </div>
      </div>
    );
  }

  const { user, path, modules, progress, stamps, assignment } = data;
  const currentDay = assignment?.current_day || 0;

  // 按 day group
  const moduleByDay: Record<number, any[]> = {};
  modules.forEach((m: any) => {
    if (!moduleByDay[m.day_offset]) moduleByDay[m.day_offset] = [];
    moduleByDay[m.day_offset].push(m);
  });
  const days = Object.keys(moduleByDay).map(Number).sort((a, b) => a - b);

  const progressMap: Record<string, any> = {};
  progress.forEach((p: any) => { progressMap[p.module_id] = p; });

  return (
    <div style={pageStyle}>
      {/* Hero */}
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "60px 24px 40px" }}>
        <div style={{ fontSize: 12, color: "var(--ink-mid)", letterSpacing: 2, marginBottom: 8 }}>
          MOYU · LEARN
        </div>
        <h1 style={{
          fontFamily: "var(--font-noto-serif-tc)",
          fontSize: 56,
          fontWeight: 600,
          color: "var(--ink-deep)",
          marginBottom: 12,
          letterSpacing: 4,
        }}>
          {STAGE_NAMES[user.stage as keyof typeof STAGE_NAMES] || "研墨者"}
        </h1>
        <div style={{ fontSize: 14, color: "var(--ink-mid)", marginBottom: 24 }}>
          {PATH_NAMES[user.stage_path as keyof typeof PATH_NAMES] || "通用"}
          {user.brand && <span> · {user.brand}</span>}
          <span> · 第 {currentDay + 1} 天</span>
        </div>
        <KintsugiLine />
      </div>

      {/* 已蓋印章 */}
      {stamps.length > 0 && (
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 24px" }}>
          <div style={{ fontSize: 12, color: "var(--ink-mid)", letterSpacing: 2, marginBottom: 16 }}>
            印 STAMPS · {stamps.length}
          </div>
          <div className="flex flex-wrap gap-4 mb-12">
            {stamps.map((s: any) => (
              <div key={s.id} className="text-center">
                <Stamp text={s.stamp_name} rarity={s.rarity} size={72} />
                <div style={{ fontSize: 10, color: "var(--ink-mid)", marginTop: 6 }}>
                  {new Date(s.earned_at).toISOString().slice(0, 10)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 14 天 / 3 天 捲軸地圖 */}
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 24px 80px" }}>
        <div style={{ fontSize: 12, color: "var(--ink-mid)", letterSpacing: 2, marginBottom: 24 }}>
          路 PATH · {path.name}
        </div>

        <div className="space-y-6">
          {days.map(day => {
            const isCurrent = day === currentDay;
            const isPast = day < currentDay;
            const isFuture = day > currentDay;
            const dayModules = moduleByDay[day];

            return (
              <div key={day} style={{
                opacity: isFuture ? 0.4 : 1,
                position: "relative",
              }}>
                {/* Day 標題 */}
                <div className="flex items-center gap-4 mb-3">
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: isCurrent ? "var(--accent-red, #b91c1c)" : isPast ? "var(--ink-deep, #1a1a1a)" : "transparent",
                    color: isCurrent || isPast ? "var(--bg-paper, #f7f1e3)" : "var(--ink-mid, #4a4a4a)",
                    border: isFuture ? "1px dashed var(--border-soft)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-noto-serif-tc)",
                    fontSize: 22,
                    fontWeight: 600,
                  }}>
                    D{day}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--ink-mid)" }}>
                      {isCurrent ? "今日" : isPast ? "已過" : "未到"}
                    </div>
                    <div style={{ fontSize: 16, fontFamily: "var(--font-noto-serif-tc)", color: "var(--ink-deep)" }}>
                      第 {day} 天 · {dayModules.length} 任務
                    </div>
                  </div>
                </div>

                {/* Modules */}
                <div className="ml-16 space-y-2">
                  {dayModules.map((m: any) => {
                    const p = progressMap[m.id];
                    const status = p?.status || (isPast ? "skipped" : isFuture ? "pending" : "pending");
                    const completed = status === "completed";
                    const inProgress = status === "in_progress";

                    return (
                      <div key={m.id} className="p-3 rounded-md" style={{
                        background: completed ? "var(--bg-elev)" : "var(--bg-paper)",
                        border: "1px solid var(--border-soft)",
                        opacity: status === "skipped" ? 0.5 : 1,
                      }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontSize: 14 }}>{MODULE_TYPE_ICON[m.module_type] || "·"}</span>
                          <span style={{ fontSize: 11, color: "var(--ink-mid)", textTransform: "uppercase", letterSpacing: 1 }}>
                            {m.module_type}
                          </span>
                          {m.duration_min && <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>· {m.duration_min} 分</span>}
                          {completed && <span style={{ fontSize: 12, color: "var(--accent-red)" }}>● 已完成</span>}
                          {inProgress && <span style={{ fontSize: 12, color: "var(--gold-thread, #c9a96e)" }}>○ 進行中</span>}
                          {m.reward?.stamp && (
                            <span style={{ fontSize: 11, color: "var(--accent-red)", marginLeft: "auto" }}>
                              印章「{m.reward.stamp}」
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, fontFamily: "var(--font-noto-serif-tc)", color: "var(--ink-deep)", marginBottom: 4 }}>
                          {m.title}
                        </div>
                        {m.description && (
                          <div style={{ fontSize: 12, color: "var(--ink-mid)", lineHeight: 1.6 }}>
                            {m.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KintsugiLine() {
  return (
    <svg width="100%" height="3" style={{ display: "block" }}>
      <line x1="0" y1="1.5" x2="100%" y2="1.5" stroke="var(--gold-thread, #c9a96e)" strokeWidth="1" strokeDasharray="2 4" />
    </svg>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg-paper, #f7f1e3)",
  color: "var(--ink-deep, #1a1a1a)",
};

import { getSupabaseAdmin, fetchAllRows } from "@/lib/supabase";
import { taipeiToday, taipeiDaysAgo } from "@/lib/time";

/**
 * 業務監測生長儀表板 API
 *
 * 一次回傳 5 個改革專案的即時狀態，供後台首頁渲染
 *
 * 5 個改革專案：
 * - sales_combat       業務戰力（不開口痛點）
 * - manager_oversight  主管督導（主管不管事痛點）
 * - recruitment_funnel 招聘漏斗（招不到人痛點）
 * - human_state        人類狀態監測（沒真實數據痛點）
 * - breakthrough       突破推力引擎（執行違反人性介入）
 */

interface ProjectMetric {
  id: string;
  name: string;
  category: string;
  status: "healthy" | "warning" | "critical" | "unknown";
  primary_metric: { label: string; value: string | number };
  secondary_metric: { label: string; value: string | number };
  diagnosis: string;
  next_action: string;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const now = Date.now();
    // 2026-04-30 Wave A B6+B8 fix:用台北 TZ + fetchAllRows 防 1000 cap
    const weekAgo = taipeiDaysAgo(7);

    // 並行抓取 5 個專案的核心數據
    const [usersRes, activities, kpis, recruits, checkins, breakthroughs, claudeTasks] = await Promise.all([
      supabase.from("users").select("id, email, name, brand, status, role").eq("status", "active"),
      fetchAllRows<{ user_email: string; last_heartbeat: string }>(() =>
        supabase.from("user_activity").select("user_email, last_heartbeat")
      ),
      fetchAllRows<{ user_id: string; date: string; calls: number; valid_calls: number; appointments: number; closures: number }>(() =>
        supabase.from("kpi_entries")
          .select("user_id, date, calls, valid_calls, appointments, closures")
          .gte("date", weekAgo)
      ),
      fetchAllRows<{ id: string; stage: string; brand: string; created_at: string; stage_entered_at: string }>(() =>
        supabase.from("recruits")
          .select("id, stage, brand, created_at, stage_entered_at")
          .neq("stage", "rejected")
      ),
      fetchAllRows<{ user_email: string; date: string; energy: number; mood: number; comfort_level: number; ai_score: number }>(() =>
        supabase.from("human_state_checkin")
          .select("user_email, date, energy, mood, comfort_level, ai_score")
          .gte("date", weekAgo)
      ),
      fetchAllRows<{ id: string; user_email: string; severity: string; acknowledged: boolean; created_at: string }>(() =>
        supabase.from("breakthrough_log")
          .select("id, user_email, severity, acknowledged, created_at")
          .gte("created_at", new Date(now - 86400000).toISOString())
      ),
      fetchAllRows<{ id: string; status: string; priority: string }>(() =>
        supabase.from("claude_tasks").select("id, status, priority").in("status", ["pending", "in_progress", "blocked"])
      ),
    ]);

    const users = usersRes.data || [];

    const totalUsers = users.length;
    const today = taipeiToday();

    // ─── 1. 業務戰力 (sales_combat) ─────────────────
    const todayKpis = kpis.filter((k) => k.date === today);
    const totalCallsToday = todayKpis.reduce((s, k) => s + (k.calls || 0), 0);
    const usersWithCallsToday = new Set(todayKpis.filter((k) => (k.calls || 0) > 0).map((k) => k.user_id));
    const silentUsers = totalUsers - usersWithCallsToday.size;
    const silentRatio = totalUsers > 0 ? silentUsers / totalUsers : 0;

    const salesProject: ProjectMetric = {
      id: "sales_combat",
      name: "業務戰力",
      category: "P1 — 業務不開口",
      status: silentRatio > 0.5 ? "critical" : silentRatio > 0.2 ? "warning" : "healthy",
      primary_metric: { label: "今日撥打總通數", value: totalCallsToday },
      secondary_metric: { label: "今日沒打的人", value: `${silentUsers}/${totalUsers}` },
      diagnosis:
        silentRatio > 0.5
          ? `${Math.round(silentRatio * 100)}% 業務今天 0 通電話 — 整團隊在偷懶`
          : silentRatio > 0.2
          ? `${silentUsers} 位業務今天還沒開口 — 該逼了`
          : `業務都在開口，繼續盯轉換率`,
      next_action: silentUsers > 0 ? `點名 ${silentUsers} 位業務 + 限定 1 小時內回報通數` : "看通話品質",
    };

    // ─── 2. 主管督導 (manager_oversight) ─────────────
    const managers = users.filter((u) => ["super_admin", "brand_manager", "team_leader"].includes(u.role));
    const managerActivityMap = new Map(activities.map((a) => [a.user_email, a.last_heartbeat]));
    const inactiveManagers = managers.filter((m) => {
      const beat = managerActivityMap.get(m.email);
      if (!beat) return true;
      return now - new Date(beat).getTime() > 86400000;
    });
    const managerProject: ProjectMetric = {
      id: "manager_oversight",
      name: "主管督導",
      category: "P1 — 主管不管事",
      status: managers.length === 0 ? "unknown" : inactiveManagers.length > managers.length / 2 ? "critical" : inactiveManagers.length > 0 ? "warning" : "healthy",
      primary_metric: { label: "主管總數", value: managers.length },
      secondary_metric: { label: "24h 內未上線", value: inactiveManagers.length },
      diagnosis:
        managers.length === 0
          ? "系統內還沒設定主管角色 — 沒人能督導"
          : inactiveManagers.length > 0
          ? `${inactiveManagers.length} 位主管 24 小時沒進系統 — 自己也在偷懶`
          : "主管都在線上",
      next_action: managers.length === 0 ? "立刻設定 brand_manager / team_leader 角色" : inactiveManagers.length > 0 ? `點名主管：${inactiveManagers.map((m) => m.name).join(", ")}` : "看主管 1on1 紀錄",
    };

    // ─── 3. 招聘漏斗 (recruitment_funnel) ────────────
    const stageCount: Record<string, number> = {};
    recruits.forEach((r) => { stageCount[r.stage] = (stageCount[r.stage] || 0) + 1; });
    const inFunnel = recruits.filter((r) => !["passed", "dropped", "rejected"].includes(r.stage)).length;
    const droppedThisMonth = recruits.filter((r) => r.stage === "dropped" && new Date(r.created_at).getTime() > now - 30 * 86400000).length;
    const recruitProject: ProjectMetric = {
      id: "recruitment_funnel",
      name: "招聘漏斗",
      category: "P2 — 招不到人",
      status: recruits.length === 0 ? "unknown" : inFunnel < 5 ? "critical" : inFunnel < 10 ? "warning" : "healthy",
      primary_metric: { label: "漏斗中求職者", value: inFunnel },
      secondary_metric: { label: "本月流失", value: droppedThisMonth },
      diagnosis:
        recruits.length === 0
          ? "招聘系統還沒有任何資料 — 漏斗是空的"
          : inFunnel < 5
          ? "漏斗快空了，下個月會無人可用"
          : `各階段：${Object.entries(stageCount).map(([k, v]) => `${k}=${v}`).join(", ")}`,
      next_action: recruits.length === 0 ? "貼第一批求職者進系統 (POST /api/admin/recruits)" : "補充廣告投放 + 加快面試節奏",
    };

    // ─── 4. 人類狀態 (human_state) ─────────────────
    const todayCheckins = checkins.filter((c) => c.date === today);
    const checkinRatio = totalUsers > 0 ? todayCheckins.length / totalUsers : 0;
    const avgEnergy = todayCheckins.length > 0 ? todayCheckins.reduce((s, c) => s + (c.energy || 0), 0) / todayCheckins.length : 0;
    const avgComfort = todayCheckins.length > 0 ? todayCheckins.reduce((s, c) => s + (c.comfort_level || 0), 0) / todayCheckins.length : 0;
    const stateProject: ProjectMetric = {
      id: "human_state",
      name: "人類狀態",
      category: "P0 — 沒真實數據",
      status: checkinRatio < 0.3 ? "critical" : checkinRatio < 0.7 ? "warning" : "healthy",
      primary_metric: { label: "今日 Check-in 率", value: `${Math.round(checkinRatio * 100)}%` },
      secondary_metric: { label: "平均舒適度（越低越好）", value: avgComfort.toFixed(1) },
      diagnosis:
        checkinRatio < 0.3
          ? "沒人填 daily check-in — 系統看不到人類狀態"
          : avgComfort > 7
          ? `平均舒適度 ${avgComfort.toFixed(1)} — 太爽了，沒在突破`
          : `平均能量 ${avgEnergy.toFixed(1)} / 舒適 ${avgComfort.toFixed(1)}`,
      next_action: checkinRatio < 0.5 ? "強制每日 9:00 前 check-in，否則鎖系統" : "看哪些人 7 天都很舒適 → 立刻拉出來逼",
    };

    // ─── 5. 突破推力 (breakthrough) ────────────────
    const triggered24h = breakthroughs.length;
    const ackRatio = breakthroughs.length > 0 ? breakthroughs.filter((b) => b.acknowledged).length / breakthroughs.length : 0;
    const breakthroughProject: ProjectMetric = {
      id: "breakthrough",
      name: "突破推力",
      category: "引擎 — 違反人性介入",
      status: triggered24h === 0 ? "unknown" : ackRatio < 0.3 ? "critical" : ackRatio < 0.7 ? "warning" : "healthy",
      primary_metric: { label: "24h 觸發次數", value: triggered24h },
      secondary_metric: { label: "已回應比例", value: `${Math.round(ackRatio * 100)}%` },
      diagnosis:
        triggered24h === 0
          ? "規則引擎還沒啟動，今天沒任何介入"
          : ackRatio < 0.3
          ? "介入了但沒人回應 — 規則被忽視"
          : `${triggered24h} 次介入觸發，${Math.round(ackRatio * 100)}% 有回應`,
      next_action: triggered24h === 0 ? "啟動 cron 跑 breakthrough engine" : "升級忽視介入的人到 hard 級",
    };

    return Response.json({
      ok: true,
      generated_at: new Date().toISOString(),
      summary: {
        total_users: totalUsers,
        active_managers: managers.length - inactiveManagers.length,
        in_recruitment_funnel: inFunnel,
        pending_claude_tasks: claudeTasks.filter((t) => t.status === "pending").length,
        critical_claude_tasks: claudeTasks.filter((t) => t.priority === "critical").length,
      },
      projects: [stateProject, salesProject, managerProject, recruitProject, breakthroughProject],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

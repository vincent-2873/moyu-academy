import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * v3 Dashboard API — 指揮中心一頁式戰況聚合
 *
 * 一次拉齊：3 大支柱 / 所有專案 / 待辦命令 / 健康度分布 / Claude 觀察筆記
 * 給前台 admin Command Center 用，避免多次往返。
 */

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    const [pillarsRes, projectsRes, commandsRes, insightsRes] = await Promise.all([
      supabase.from("v3_pillars").select("*").order("display_order"),
      supabase.from("v3_projects").select("*"),
      supabase.from("v3_commands").select("*").order("created_at", { ascending: false }).limit(100),
      supabase
        .from("v3_ai_insights")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    // 偵測缺表狀況（v3 還沒跑 migration）
    // 42P01: PostgreSQL relation does not exist
    // PGRST205: PostgREST schema cache miss
    const tableMissing = (e: { message?: string; code?: string } | null) =>
      e && (
        e.code === "42P01" ||
        e.code === "PGRST205" ||
        e.message?.includes("does not exist") ||
        e.message?.includes("Could not find the table")
      );

    if (tableMissing(pillarsRes.error) || tableMissing(projectsRes.error)) {
      return Response.json(
        {
          ok: false,
          error: "v3 資料表還沒建立。請到 Supabase SQL editor 跑 supabase-migration-v3-pillars.sql",
          missing_migration: true,
        },
        { status: 503 },
      );
    }

    if (pillarsRes.error) throw pillarsRes.error;
    if (projectsRes.error) throw projectsRes.error;
    if (commandsRes.error) throw commandsRes.error;

    const pillars = pillarsRes.data || [];
    const projects = projectsRes.data || [];
    const commands = commandsRes.data || [];
    const insights = insightsRes.data || [];

    // 按支柱聚合
    const byPillar = pillars.map((p) => {
      const pProjects = projects.filter((pr) => pr.pillar_id === p.id);
      const pCommands = commands.filter((c) => c.pillar_id === p.id);

      const healthDist = {
        healthy: pProjects.filter((pr) => pr.health === "healthy").length,
        warning: pProjects.filter((pr) => pr.health === "warning").length,
        critical: pProjects.filter((pr) => pr.health === "critical").length,
        unknown: pProjects.filter((pr) => pr.health === "unknown").length,
      };

      const statusDist = {
        active: pProjects.filter((pr) => pr.status === "active").length,
        paused: pProjects.filter((pr) => pr.status === "paused").length,
        done: pProjects.filter((pr) => pr.status === "done").length,
        dropped: pProjects.filter((pr) => pr.status === "dropped").length,
      };

      const avgProgress =
        pProjects.length > 0
          ? Math.round(pProjects.reduce((s, pr) => s + (pr.progress || 0), 0) / pProjects.length)
          : 0;

      // 命令統計
      const pendingCmds = pCommands.filter((c) => c.status === "pending").length;
      const doneTodayCmds = pCommands.filter(
        (c) => c.status === "done" && c.done_at && c.done_at.slice(0, 10) === today,
      ).length;
      const blockedCmds = pCommands.filter((c) => c.status === "blocked").length;
      const ignoredCmds = pCommands.filter((c) => c.status === "ignored").length;

      // 該支柱整體狀態
      let overall: "healthy" | "warning" | "critical" | "unknown" = "healthy";
      let diagnosis = "";
      if (pProjects.length === 0) {
        overall = "unknown";
        diagnosis = `${p.name}條線還沒任何專案 — 該開戰場了`;
      } else if (healthDist.critical > 0) {
        overall = "critical";
        diagnosis = `${healthDist.critical} 個專案紅燈，立即介入`;
      } else if (ignoredCmds > 2) {
        overall = "critical";
        diagnosis = `${ignoredCmds} 個命令被忽略 — 員工失控`;
      } else if (healthDist.warning > 0 || blockedCmds > 0) {
        overall = "warning";
        diagnosis = `${healthDist.warning} 黃燈 / ${blockedCmds} 卡住 — 該逼了`;
      } else if (healthDist.unknown === pProjects.length) {
        overall = "unknown";
        diagnosis = "全部專案還未開始監測 — Claude 等第一週數據";
      } else {
        diagnosis = `${pProjects.length} 個專案推進中，平均完成度 ${avgProgress}%`;
      }

      return {
        ...p,
        project_count: pProjects.length,
        avg_progress: avgProgress,
        health_dist: healthDist,
        status_dist: statusDist,
        commands: {
          pending: pendingCmds,
          done_today: doneTodayCmds,
          blocked: blockedCmds,
          ignored: ignoredCmds,
        },
        overall,
        diagnosis,
      };
    });

    // 全局告警
    const alerts = byPillar
      .filter((p) => p.overall === "critical" || p.overall === "warning")
      .map((p) => ({
        level: p.overall,
        pillar: p.name,
        pillar_id: p.id,
        message: p.diagnosis,
      }));

    // 全集團統計
    const empire = {
      total_projects: projects.length,
      total_pending_commands: commands.filter((c) => c.status === "pending").length,
      total_done_today: commands.filter(
        (c) => c.status === "done" && c.done_at && c.done_at.slice(0, 10) === today,
      ).length,
      total_blocked: commands.filter((c) => c.status === "blocked").length,
      total_ignored: commands.filter((c) => c.status === "ignored").length,
      critical_pillars: byPillar.filter((p) => p.overall === "critical").length,
      warning_pillars: byPillar.filter((p) => p.overall === "warning").length,
    };

    return Response.json({
      ok: true,
      generated_at: new Date().toISOString(),
      empire,
      pillars: byPillar,
      projects,
      recent_commands: commands.slice(0, 30),
      insights,
      alerts,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[v3/dashboard] caught:", err);
    // 偵測 caught 出來的缺表錯誤
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("v3_")) {
      return Response.json(
        {
          ok: false,
          error: "v3 資料表還沒建立。請到 Supabase SQL editor 跑 supabase-migration-v3-pillars.sql",
          missing_migration: true,
          raw: msg,
        },
        { status: 503 },
      );
    }
    return Response.json({ ok: false, error: msg, raw: String(err) }, { status: 500 });
  }
}

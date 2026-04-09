import { getSupabaseAdmin } from "@/lib/supabase";
import { linePush, pushNewTask } from "@/lib/line-notify";
import { NextRequest } from "next/server";

/**
 * Claude AI 自動掃描排程
 *
 * 排程建議：每天 09:00 + 18:00 跑一次 (Vercel Cron)
 *
 * 工作內容：
 * 1. 掃描所有業務的活動狀態 + KPI + 訓練進度
 * 2. 偵測異常 (超過 3 天未活動 / KPI 連續未達標 / 測驗分數驟降)
 * 3. 寫入 health_alerts
 * 4. 把需要主管處理的事項丟到 claude_tasks
 * 5. 透過 LINE 推播給用戶
 *
 * 注意：這是 stub 框架，實際 AI 分析等用戶提供 KPI 門檻 + 外部 API 後再啟用
 */

interface ScanResult {
  step: string;
  ok: boolean;
  detail?: string;
  count?: number;
}

const INACTIVITY_DAYS_WARNING = 3;
const INACTIVITY_DAYS_CRITICAL = 7;

export async function GET(request: NextRequest) {
  // 驗證來源 (Vercel Cron 會帶 authorization header)
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const results: ScanResult[] = [];
  const startTime = Date.now();

  try {
    // ─── Step 1: 取得所有業務 ────────────────────────────────────
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, name, brand, status")
      .eq("status", "active");

    if (usersError) throw new Error(`fetch users failed: ${usersError.message}`);
    results.push({ step: "fetch_users", ok: true, count: users?.length || 0 });

    if (!users || users.length === 0) {
      return Response.json({ ok: true, message: "no active users", results });
    }

    // ─── Step 2: 掃描活動狀態 ────────────────────────────────────
    const { data: activities } = await supabase
      .from("user_activity")
      .select("user_email, last_heartbeat");

    const activityMap = new Map<string, string>();
    (activities || []).forEach((a) => activityMap.set(a.user_email, a.last_heartbeat));

    const inactiveAlerts: Array<{ user: typeof users[0]; days: number; severity: "warning" | "critical" }> = [];
    const now = Date.now();

    for (const user of users) {
      const lastBeat = activityMap.get(user.email);
      if (!lastBeat) continue;
      const daysSince = Math.floor((now - new Date(lastBeat).getTime()) / 86400000);
      if (daysSince >= INACTIVITY_DAYS_CRITICAL) {
        inactiveAlerts.push({ user, days: daysSince, severity: "critical" });
      } else if (daysSince >= INACTIVITY_DAYS_WARNING) {
        inactiveAlerts.push({ user, days: daysSince, severity: "warning" });
      }
    }
    results.push({ step: "scan_inactivity", ok: true, count: inactiveAlerts.length });

    // ─── Step 3: 寫入 health_alerts (避免重複) ────────────────────
    let alertsCreated = 0;
    for (const alert of inactiveAlerts) {
      // 檢查 24 小時內是否已有同樣警報
      const since = new Date(now - 86400000).toISOString();
      const { data: existing } = await supabase
        .from("health_alerts")
        .select("id")
        .eq("user_email", alert.user.email)
        .eq("alert_type", "inactivity")
        .eq("resolved", false)
        .gte("created_at", since)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("health_alerts").insert({
        user_id: alert.user.id,
        user_email: alert.user.email,
        alert_type: "inactivity",
        severity: alert.severity,
        message: `${alert.user.name}（${alert.user.brand}）已 ${alert.days} 天未活動`,
        metric_snapshot: { days_inactive: alert.days, brand: alert.user.brand },
      });
      alertsCreated++;
    }
    results.push({ step: "write_alerts", ok: true, count: alertsCreated });

    // ─── Step 4: 嚴重警報 → 建立 Claude 任務 + LINE 推播 ──────────
    const criticalAlerts = inactiveAlerts.filter((a) => a.severity === "critical");
    if (criticalAlerts.length > 0) {
      const summary = criticalAlerts
        .map((a) => `• ${a.user.name}（${a.user.brand}）${a.days} 天未活動`)
        .join("\n");

      const { data: task } = await supabase
        .from("claude_tasks")
        .insert({
          title: `${criticalAlerts.length} 位業務超過 7 天未活動`,
          description: summary,
          category: "decision",
          priority: "critical",
          why: "業務長時間未上線可能代表流失風險或系統障礙，需要主管介入了解狀況",
          expected_input: "請主管聯繫這些業務並回報狀況；若已離職請更新 user status",
        })
        .select()
        .single();

      if (task) {
        await pushNewTask({
          id: task.id,
          title: task.title,
          description: task.description,
          priority: "critical",
          why: task.why,
          expected_input: task.expected_input,
        });
      }
      results.push({ step: "critical_task_created", ok: true });
    }

    // ─── Step 5: 記錄這次掃描 ────────────────────────────────────
    await supabase.from("claude_actions").insert({
      action_type: "auto_scan",
      target: "all_users",
      summary: `掃描 ${users.length} 位業務，發現 ${inactiveAlerts.length} 個異常 (${alertsCreated} 個新警報)`,
      details: { results, duration_ms: Date.now() - startTime },
      result: "success",
    });

    return Response.json({
      ok: true,
      duration_ms: Date.now() - startTime,
      users_scanned: users.length,
      alerts_total: inactiveAlerts.length,
      alerts_created: alertsCreated,
      critical_count: criticalAlerts.length,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";

    // 失敗也寫到 actions log
    try {
      await supabase.from("claude_actions").insert({
        action_type: "auto_scan",
        target: "all_users",
        summary: `掃描失敗: ${msg}`,
        details: { results, error: msg },
        result: "failed",
      });
    } catch {}

    // 推播失敗給用戶
    await linePush({
      title: "Claude 自動掃描失敗",
      body: `錯誤：${msg}\n\n請進後台 Claude 指派頁查看詳情`,
      priority: "high",
    });

    return Response.json({ ok: false, error: msg, results }, { status: 500 });
  }
}

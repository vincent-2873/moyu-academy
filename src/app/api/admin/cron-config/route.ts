import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { getAdminScope, enforceWriteAccess } from "@/lib/admin-scope";

/**
 * /api/admin/cron-config — 17 個 cron 配置 + 健康度
 * 不直接改 GitHub Actions cron schedule(那要改 .yml),只 toggle is_enabled in DB
 * 17 個 cron endpoint 跑時看 cron_config.is_enabled 才執行
 */

export const runtime = "nodejs";

const KNOWN_CRONS = [
  { code: "auto-attention-push",        label: "自動關注推送",        default_schedule: "0 */2 * * *" },
  { code: "auto-iterate-30min",         label: "自動迭代 30 分",      default_schedule: "*/30 * * * *" },
  { code: "breakthrough-engine",        label: "突破引擎",            default_schedule: "0 */2 * * *" },
  { code: "claude-autoscan",            label: "Claude 自動掃描",     default_schedule: "0 */4 * * *" },
  { code: "daily-automation",           label: "每日自動化",          default_schedule: "0 1 * * *" },
  { code: "daily-briefing-push",        label: "每日簡報推送",        default_schedule: "0 1 * * *" },
  { code: "daily-todo-push",            label: "每日待辦推送",        default_schedule: "0 1 * * 1-5" },
  { code: "line-inbound-dispatcher",    label: "LINE 入站派發",       default_schedule: "*/5 * * * *" },
  { code: "manager-care-push",          label: "主管關心推送",        default_schedule: "0 10 * * *" },
  { code: "metabase-sync",              label: "Metabase 同步",       default_schedule: "0 1,9 * * *" },
  { code: "recruit-auto-outreach",      label: "招募自動觸達",        default_schedule: "0 */3 * * *" },
  { code: "recruiter-briefing-push",    label: "招募員簡報",          default_schedule: "0 1 * * *" },
  { code: "rookie-training-push",       label: "新人訓練推送",        default_schedule: "0 1 * * *" },
  { code: "sales-metrics-rules",        label: "業務指標規則",        default_schedule: "0 */1 * * *" },
  { code: "system-health-3h",           label: "系統健康度 3h",       default_schedule: "0 */3 * * *" },
  { code: "update-articles",            label: "更新文章",            default_schedule: "0 4 * * *" },
  { code: "weekly-report",              label: "週報",                default_schedule: "0 1 * * 1" },
];

export async function GET() {
  const sb = getSupabaseAdmin();

  // 從 system_run_log 取每個 cron 過去 24h 健康度
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: logs } = await sb
    .from("system_run_log")
    .select("source, status")
    .gte("created_at", since);

  const healthBySource: Record<string, { runs: number; ok: number; fail: number }> = {};
  (logs || []).forEach((l: any) => {
    const m = l.source?.match(/cron:(.+)$/) || l.source?.match(/api:\/api\/cron\/(.+)$/);
    const code = m ? m[1] : null;
    if (!code) return;
    if (!healthBySource[code]) healthBySource[code] = { runs: 0, ok: 0, fail: 0 };
    healthBySource[code].runs++;
    if (l.status === "ok") healthBySource[code].ok++;
    if (l.status === "fail") healthBySource[code].fail++;
  });

  // 看 cron_config 表有沒有 (沒就用 default)
  const { data: configs } = await sb.from("cron_config").select("*");
  const configMap: Record<string, any> = {};
  (configs || []).forEach((c: any) => { configMap[c.code] = c; });

  const items = KNOWN_CRONS.map(k => {
    const cfg = configMap[k.code];
    const health = healthBySource[k.code] || { runs: 0, ok: 0, fail: 0 };
    const passRate = health.runs > 0 ? Math.round((health.ok / health.runs) * 100) : null;
    return {
      ...k,
      is_enabled: cfg?.is_enabled ?? true,
      schedule: cfg?.schedule ?? k.default_schedule,
      runs_24h: health.runs,
      pass_rate: passRate,
      last_run_status: health.fail > 0 ? "fail" : (health.ok > 0 ? "ok" : "noop"),
    };
  });

  return NextResponse.json({ items });
}

export async function PUT(req: NextRequest) {
  // Vincent 2026-04-30 安全 #4: trainer/mentor read-only block
  const _scope = await getAdminScope(req);
  if (_scope) { const _ro = enforceWriteAccess(_scope, req.method); if (_ro) return _ro; }
  const body = await req.json();
  const { code, is_enabled, schedule } = body;
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("cron_config").upsert({
    code,
    is_enabled: is_enabled ?? true,
    schedule,
    updated_at: new Date().toISOString(),
  }, { onConflict: "code" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

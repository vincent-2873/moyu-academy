import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 一次性 setup endpoint：建立 Claude AI 自動化系統需要的 3 個表
 *
 * 使用方法：
 * - POST /api/admin/setup-claude-tables
 *
 * 因為 Supabase JS client 不能直接執行 raw SQL，這個 endpoint 用 insert/select 方式
 * 確認表存在；表本身需要在 Supabase Dashboard SQL Editor 手動執行 supabase-migration.sql
 *
 * 表名稱：
 * - claude_tasks
 * - claude_actions
 * - health_alerts
 */

const REQUIRED_TABLES = ["claude_tasks", "claude_actions", "health_alerts"];

export async function GET(_request: NextRequest) {
  return checkTables();
}

export async function POST(_request: NextRequest) {
  return checkTables();
}

async function checkTables() {
  try {
    const supabase = getSupabaseAdmin();
    const status: Record<string, { exists: boolean; row_count?: number; error?: string }> = {};

    for (const table of REQUIRED_TABLES) {
      try {
        // Use limit(1) to actually probe the table — head:true count can return null silently
        const { data, error } = await supabase.from(table).select("id").limit(1);

        if (error) {
          status[table] = { exists: false, error: error.message };
        } else {
          status[table] = { exists: true, row_count: data?.length ?? 0 };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        status[table] = { exists: false, error: msg };
      }
    }

    const allOk = REQUIRED_TABLES.every((t) => status[t]?.exists);

    return Response.json({
      ok: allOk,
      message: allOk
        ? "✅ All Claude automation tables exist"
        : "⚠️ Some tables missing — run supabase-migration.sql in Supabase Dashboard SQL Editor",
      tables: status,
      sql_file: "supabase-migration.sql (lines for claude_tasks, claude_actions, health_alerts)",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

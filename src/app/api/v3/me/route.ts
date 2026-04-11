import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * v3 Me API — 員工個人工作台
 *
 * GET /api/v3/me?email=foo@bar.com
 *
 * 回傳：
 *   - profile: 個人資訊（姓名 / email / 品牌 / 角色）
 *   - department: 所屬部門
 *   - position: 職位 + 職責 + KPI 目標
 *   - manager: 主管資訊
 *   - projects: 我負責的 v3_projects
 *   - commands: { pending, today, recent } v3_commands
 *   - stats: 簡易統計
 */

const tableMissing = (e: { message?: string; code?: string } | null) =>
  e && (e.code === "42P01" || e.code === "PGRST205" || e.message?.includes("does not exist") || e.message?.includes("Could not find the table"));

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const email = url.searchParams.get("email");

    if (!email) {
      return Response.json({ ok: false, error: "email 必填" }, { status: 400 });
    }

    // 1. 抓 user
    let { data: user, error: userErr } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (userErr) {
      return Response.json({ ok: false, error: userErr.message }, { status: 500 });
    }

    // 1a. 如果 users 表沒有這個 email，但 sales_metrics_daily 有 → 自動 provision
    //     這樣新業務一進 Metabase 就能看自己的 /me 頁面，不用等管理員建帳號
    if (!user) {
      const { data: salesRow } = await supabase
        .from("sales_metrics_daily")
        .select("name, brand, team, org, level")
        .eq("email", email)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (salesRow) {
        // 從 sales data 自動建 user row
        const name = (salesRow.name as string) || email.split("@")[0];
        const brand = (salesRow.brand as string) || "nschool";
        const now = new Date().toISOString();
        const { data: created, error: createErr } = await supabase
          .from("users")
          .insert({
            email,
            name,
            brand,
            role: "sales",
            status: "active",
            password: "", // 空密碼，強制走 LINE OAuth 或管理員事後補
            created_at: now,
            updated_at: now,
          })
          .select("*")
          .single();
        if (createErr) {
          // 無法自動 provision 就回既有邏輯
          return Response.json({
            ok: true,
            registered: false,
            message: `這個 email 在 Metabase 有業務資料但無法自動建帳號：${createErr.message}`,
            autoProvisionFailed: true,
          });
        }
        user = created;
      }
    }

    if (!user) {
      return Response.json({
        ok: true,
        registered: false,
        message: "尚未註冊。請先到系統註冊或聯絡管理員。",
      });
    }

    // 2. 抓部門
    let department = null;
    if (user.department_id) {
      const { data, error } = await supabase
        .from("v3_departments")
        .select("*")
        .eq("id", user.department_id)
        .maybeSingle();
      if (tableMissing(error)) {
        return Response.json(
          { ok: false, error: "v3 ERP 資料表還沒建立，請執行 supabase-migration-v3-erp.sql", missing_migration: true },
          { status: 503 },
        );
      }
      department = data;
    }

    // 3. 抓職位
    let position = null;
    if (user.position_id) {
      const { data } = await supabase
        .from("v3_positions")
        .select("*")
        .eq("id", user.position_id)
        .maybeSingle();
      position = data;
    }

    // 4. 抓主管資訊
    let manager = null;
    if (user.manager_email) {
      const { data } = await supabase
        .from("users")
        .select("name, email, brand")
        .eq("email", user.manager_email)
        .maybeSingle();
      manager = data;
    }

    // 5. 抓我負責的 v3_projects
    const { data: projects } = await supabase
      .from("v3_projects")
      .select("*")
      .eq("owner_email", email)
      .order("created_at", { ascending: false });

    // 6. 抓我的命令
    const { data: allCommands } = await supabase
      .from("v3_commands")
      .select("*")
      .eq("owner_email", email)
      .order("created_at", { ascending: false })
      .limit(100);

    const commands = allCommands || [];
    const today = new Date().toISOString().slice(0, 10);

    const pendingCmds = commands.filter((c) => c.status === "pending");
    const todayDoneCmds = commands.filter(
      (c) => c.status === "done" && c.done_at && c.done_at.slice(0, 10) === today,
    );
    const blockedCmds = commands.filter((c) => c.status === "blocked");

    return Response.json({
      ok: true,
      registered: true,
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        brand: user.brand,
        role: user.role,
        avatar_url: user.avatar_url,
        phone: user.phone,
        bio: user.bio,
      },
      department,
      position,
      manager,
      projects: projects || [],
      commands: {
        pending: pendingCmds,
        recent: commands.slice(0, 30),
      },
      stats: {
        total_pending: pendingCmds.length,
        done_today: todayDoneCmds.length,
        blocked: blockedCmds.length,
        total_projects: (projects || []).length,
      },
      assigned: !!user.department_id && !!user.position_id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

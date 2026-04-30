import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

/**
 * /api/admin/line-templates/send — 用 template 渲染 + 推 LINE
 *
 * Body:
 *   template_code: string
 *   variables: object  # 變數值
 *   to: string         # LINE userId(推給誰)or "self" 推給 vincent
 *   dry_run?: boolean  # 不實際推, 只渲染回 preview
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();

  try {
    const body = await req.json();
    const { template_code, variables, to, dry_run } = body;

    if (!template_code) return NextResponse.json({ error: "missing template_code" }, { status: 400 });

    const { data: tpl } = await sb.from("line_templates").select("*").eq("code", template_code).maybeSingle();
    if (!tpl) return NextResponse.json({ error: `template "${template_code}" not found` }, { status: 404 });

    // Render with variables
    const vars = { ...(tpl.example_payload || {}), ...(variables || {}) };
    const rendered = (tpl.content || "").replace(/\{(\w+)\}/g, (_: string, k: string) => {
      return vars[k] != null ? String(vars[k]) : `{${k}}`;
    });

    if (dry_run) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        rendered,
        used_vars: vars,
      });
    }

    // Actual LINE push
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!lineToken) {
      return NextResponse.json({ error: "LINE_CHANNEL_ACCESS_TOKEN not set" }, { status: 503 });
    }

    let targetUserId = to;
    if (to === "self" || to === "admin") {
      targetUserId = process.env.LINE_ADMIN_USER_ID;
      if (!targetUserId) {
        return NextResponse.json({ error: "LINE_ADMIN_USER_ID not set" }, { status: 503 });
      }
    }

    const linePayload = {
      to: targetUserId,
      messages: [{ type: "text", text: rendered }],
    };

    const r = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lineToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(linePayload),
    });

    const log = {
      template_code,
      to: targetUserId,
      status: r.status,
      ok: r.ok,
      rendered,
    };

    await sb.from("system_run_log").insert({
      source: "api:/api/admin/line-templates/send",
      status: r.ok ? "ok" : "fail",
      rows_in: 1,
      rows_out: r.ok ? 1 : 0,
      metadata: { template_code, to: targetUserId },
      error_message: r.ok ? null : `LINE ${r.status}`,
    });

    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json({ ...log, ok: false, error: err.slice(0, 200) }, { status: 502 });
    }

    return NextResponse.json({ ...log, ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

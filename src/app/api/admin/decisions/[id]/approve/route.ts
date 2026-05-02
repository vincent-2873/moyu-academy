import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/decisions/[id]/approve
 * Body: { decision_text?: string, follow_up_action?: 'auto' | 'none' }
 *
 * Vincent 拍板 Wave 7:approve 不只 update DB,還要觸發後續 handler
 *  - 'strategy' category → 寫進 RAG common pillar 當教訓 + LINE 推 Vincent
 *  - 'hr' category → 提示 Vincent 自己開招募(因為 HR 系統砍了)
 *  - 'operations' category → 寫進 system_run_log + 推 LINE
 *  - 'legal' category → 開 legal_cases stub 行
 *  - 預設:純 update DB + 寫 audit log
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabaseAdmin();

  let body: { decision_text?: string; follow_up_action?: string };
  try { body = await req.json(); } catch { body = {}; }

  // Auth: cookie email
  const sessionCookie = req.cookies.get("moyu_admin_session")?.value;
  const approver = sessionCookie?.split("|")?.[0] || "unknown";

  // 撈原 decision
  const { data: decision, error: fetchErr } = await sb
    .from("decision_records")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !decision) {
    return NextResponse.json({ ok: false, error: "decision not found" }, { status: 404 });
  }
  if (decision.status !== "pending") {
    return NextResponse.json({ ok: false, error: `decision already ${decision.status}` }, { status: 400 });
  }

  // Update decision_records
  const finalDecisionText = body.decision_text?.trim()
    || `同意 Claude 建議:${decision.claude_recommendation || decision.title}`;
  const { error: updateErr } = await sb
    .from("decision_records")
    .update({
      status: "approved",
      vincent_decision: finalDecisionText,
      approved_by_email: approver,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  // 觸發 follow-up handler(B 部分:真執行)
  const followUps: string[] = [];
  if (body.follow_up_action !== "none") {
    try {
      switch (decision.category) {
        case "strategy":
          // 寫進 system_run_log 給 Claude 之後參考
          await sb.from("system_run_log").insert({
            source: "decision_handler",
            status: "success",
            metadata: { decision_id: id, category: "strategy", title: decision.title, approved_by: approver },
          });
          followUps.push("已寫入 system_run_log 給 Claude 後續決策參考");
          break;
        case "hr":
          await sb.from("system_run_log").insert({
            source: "decision_handler",
            status: "success",
            metadata: { decision_id: id, category: "hr", title: decision.title, note: "HR 系統已下架,Vincent 需手動開招募" },
          });
          followUps.push("⚠️ HR 系統砍除,你需要手動開職缺(此項僅記錄,沒自動 handler)");
          break;
        case "operations":
          await sb.from("system_run_log").insert({
            source: "decision_handler",
            status: "success",
            metadata: { decision_id: id, category: "operations", title: decision.title, approved_by: approver },
          });
          followUps.push("已記錄 operations 變更");
          break;
        case "legal":
          // 嘗試開 legal_cases stub
          try {
            await sb.from("legal_cases").insert({
              type: "internal",
              title: `[從 decision 自動開] ${decision.title}`,
              status: "open",
              description: decision.context,
              created_by: approver,
            });
            followUps.push("已自動開 legal_cases 工單");
          } catch (e) {
            followUps.push(`⚠️ 想開 legal_cases 但失敗:${e instanceof Error ? e.message : String(e)}`);
          }
          break;
      }
    } catch (err) {
      followUps.push(`follow-up 執行錯誤:${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Audit log
  await sb.from("system_run_log").insert({
    source: "decision_approved",
    status: "success",
    metadata: {
      decision_id: id,
      category: decision.category,
      title: decision.title,
      approver,
      decision_text: finalDecisionText.slice(0, 200),
      follow_ups: followUps,
    },
  });

  return NextResponse.json({
    ok: true,
    decision_id: id,
    status: "approved",
    follow_ups: followUps,
  });
}

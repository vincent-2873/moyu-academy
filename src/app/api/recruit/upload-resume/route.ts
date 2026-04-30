import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import {
  uploadToDrive,
  getResumeFolder,
  findAndUpdateSheetByName,
} from "@/lib/google-api";

/**
 * POST /api/recruit/upload-resume
 *
 * Worker 下載 104 履歷 PDF 後呼叫此 API：
 * 1. 上傳 PDF 到 Google Drive (高雄資料夾)
 * 2. 更新 Google Sheet 邀約紀錄表的履歷連結
 * 3. 更新 outreach_104_queue.resume_url
 *
 * body: {
 *   candidateName: string
 *   candidate104Id: string
 *   account: string        — 104 帳號 (墨凡/睿富)
 *   queueId: string        — outreach_104_queue.id
 *   pdfBase64: string      — PDF 檔案的 base64 編碼
 * }
 */


export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();

  let body: {
    candidateName?: string;
    candidate104Id?: string;
    account?: string;
    queueId?: string;
    pdfBase64?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON body" },
      { status: 400 }
    );
  }

  const { candidateName, candidate104Id, account, queueId, pdfBase64 } = body;

  if (!candidateName || !candidate104Id || !pdfBase64 || !queueId) {
    return NextResponse.json(
      {
        ok: false,
        error: "candidateName, candidate104Id, queueId, pdfBase64 required",
      },
      { status: 400 }
    );
  }

  try {
    // 1. Upload PDF to Google Drive
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    const fileName = `${candidateName}_${candidate104Id}.pdf`;
    const folderId = await getResumeFolder("高雄");

    const { webViewLink } = await uploadToDrive({
      fileName,
      mimeType: "application/pdf",
      buffer: pdfBuffer,
      parentFolderId: folderId,
    });

    // 2. Update Google Sheet — find by name, update resumeLink column
    try {
      await findAndUpdateSheetByName(candidateName, null, {
        resumeLink: webViewLink,
      });
    } catch (sheetErr: unknown) {
      // Sheet update is non-critical — log but don't fail
      console.warn(
        "[upload-resume] sheet update warning:",
        sheetErr instanceof Error ? sheetErr.message : sheetErr
      );
    }

    // 3. Update outreach_104_queue.resume_url
    const { error: dbErr } = await supabase
      .from("outreach_104_queue")
      .update({
        resume_url: webViewLink,
        updated_at: new Date().toISOString(),
      })
      .eq("id", queueId);

    if (dbErr) {
      console.warn("[upload-resume] queue update warning:", dbErr.message);
    }

    // 4. Log to claude_actions
    await supabase.from("claude_actions").insert({
      action_type: "resume_upload",
      target_table: "outreach_104_queue",
      target_id: queueId,
      detail: JSON.stringify({
        candidateName,
        candidate104Id,
        account: account || "unknown",
        driveLink: webViewLink,
        pdfSize: pdfBuffer.length,
      }),
      status: "completed",
    });

    return NextResponse.json({ ok: true, driveLink: webViewLink });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload-resume] error:", msg);

    // Log failure
    try {
      await supabase
        .from("claude_actions")
        .insert({
          action_type: "resume_upload",
          target_table: "outreach_104_queue",
          target_id: queueId,
          detail: JSON.stringify({
            candidateName,
            candidate104Id,
            error: msg,
          }),
          status: "failed",
        });
    } catch {
      // non-critical logging, ignore
    }

    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}

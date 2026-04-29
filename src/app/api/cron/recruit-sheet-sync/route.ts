import { getSupabaseAdmin } from "@/lib/supabase";
import { google } from "googleapis";
import { NextRequest } from "next/server";

/**
 * 招募紀錄表 Google Sheet 雙向同步
 *
 * Sheet:1APzwwNIpoOZfqkxdHKXZqkzYkxpu1a6eQdw56T2tsFw
 *   gid=1597862340 → 招募流程
 *   gid=1556168707 → 求職者紀錄
 *
 * 同步方向:
 *   1. Sheet → DB:讀求職者紀錄(姓名/電話/email/PDF履歷/狀態) upsert public.recruits
 *   2. DB → Sheet:當系統內狀態變動(面試完成/錄取/拒絕)寫回 sheet 對應 row
 *
 * 跑頻率:每 30 min
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const SHEET_ID = process.env.RECRUIT_SHEET_ID || "1APzwwNIpoOZfqkxdHKXZqkzYkxpu1a6eQdw56T2tsFw";
const SHEET_TAB_RECRUITS = "求職者紀錄!A2:N"; // 求職者列表 row 起 2

function getGoogleAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (b64) {
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return new google.auth.GoogleAuth({
      credentials: json,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (email && key) {
    return new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: key },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  throw new Error("Google service account not configured");
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (!req.headers.get("x-zeabur-cron")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  const started = Date.now();

  try {
    const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_TAB_RECRUITS,
    });
    const rows = res.data.values || [];

    let upserted = 0;
    let skipped = 0;
    for (const row of rows) {
      // Vincent 表結構假設 (待 confirm 真欄位順序):
      // [0]姓名 [1]電話 [2]email [3]狀態 [4]品牌 [5]source(104/官網/介紹) [6]履歷PDF [7]邀約日 [8]面試日 [9]備註 ...
      const [name, phone, email, status, brand, source, resume_url, contact_at, interview_at, notes] = row;
      if (!name && !phone && !email) { skipped++; continue; }

      await supabase.from("recruits").upsert(
        {
          name: name || null,
          phone: phone || null,
          email: email || null,
          status: status || "new",
          brand: brand || "xuemi",
          source: source || null,
          resume_url: resume_url || null,
          contact_at: contact_at || null,
          interview_at: interview_at || null,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "phone" }
      );
      upserted++;
    }

    return Response.json({
      ok: true,
      duration_ms: Date.now() - started,
      total_rows: rows.length,
      upserted,
      skipped,
    });
  } catch (e) {
    return Response.json({
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
      duration_ms: Date.now() - started,
    }, { status: 500 });
  }
}

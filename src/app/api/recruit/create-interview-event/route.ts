import { getSupabaseAdmin } from "@/lib/supabase";
import { google } from "googleapis";
import { NextRequest } from "next/server";

/**
 * 建 Google Calendar event + Google Meet link 給面試
 *
 * POST { recruit_id, candidate_name, interviewer_email, start, duration_min, brand, location_label }
 *
 * Vincent 規格:
 *   標題:【睿富】線上面談-高雄中山-{candidate_name}
 *   說明:{candidate_name} {brand} 第 {round} 面
 *   參與者:招募員 + 主管 + 求職者(若有 email)
 *   含 Google Meet link
 *   寫進 recruit_schedule + 推 LINE 給招募員
 */

export const runtime = "nodejs";

const RECRUIT_CAL_ID = process.env.RECRUIT_SHARED_CALENDAR_ID;

function getGoogleAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (b64) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(Buffer.from(b64, "base64").toString("utf8")),
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (email && key) {
    return new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: key },
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  }
  throw new Error("Google service account not configured");
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json() as {
    recruit_id?: string;
    candidate_name: string;
    candidate_email?: string;
    interviewer_email?: string;
    start: string; // ISO datetime
    duration_min?: number;
    brand?: string;
    location_label?: string; // e.g. 「高雄中山」
    round?: number; // 1, 2
  };

  if (!RECRUIT_CAL_ID) return Response.json({ error: "RECRUIT_SHARED_CALENDAR_ID not set" }, { status: 500 });
  if (!body.candidate_name || !body.start) return Response.json({ error: "candidate_name + start required" }, { status: 400 });

  const brandLabel = body.brand === "ruifu" ? "睿富" : body.brand === "mofan" ? "墨翻" : (body.brand || "墨宇");
  const round = body.round || 1;
  const duration = body.duration_min || 30;
  const locLabel = body.location_label || "高雄中山";
  const summary = `【${brandLabel}】線上面談-${locLabel}-${body.candidate_name}`;
  const description = `${body.candidate_name} ${brandLabel} 第 ${round} 面\n系統自動建立`;

  const startTime = new Date(body.start);
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  try {
    const calendar = google.calendar({ version: "v3", auth: getGoogleAuth() });
    const attendees = [];
    if (body.interviewer_email) attendees.push({ email: body.interviewer_email });
    if (body.candidate_email) attendees.push({ email: body.candidate_email });

    const event = await calendar.events.insert({
      calendarId: RECRUIT_CAL_ID,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        summary,
        description,
        start: { dateTime: startTime.toISOString(), timeZone: "Asia/Taipei" },
        end: { dateTime: endTime.toISOString(), timeZone: "Asia/Taipei" },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: `moyu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
      },
    });

    const meetUrl = event.data.hangoutLink || event.data.conferenceData?.entryPoints?.find(p => p.entryPointType === "video")?.uri;
    const eventId = event.data.id;

    // 寫進 recruit_schedule
    await supabase.from("recruit_schedule").insert({
      recruit_id: body.recruit_id || null,
      candidate_name: body.candidate_name,
      candidate_email: body.candidate_email || null,
      interviewer_email: body.interviewer_email || null,
      brand: body.brand || "xuemi",
      round,
      start_at: startTime.toISOString(),
      end_at: endTime.toISOString(),
      meet_url: meetUrl,
      event_id: eventId,
      status: "scheduled",
      notes: summary,
    });

    return Response.json({
      ok: true,
      event_id: eventId,
      summary,
      meet_url: meetUrl,
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    });
  } catch (e) {
    return Response.json({
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}

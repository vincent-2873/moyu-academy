import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 招募分機通話統計同步
 *
 * Vincent 指定:
 *   PBX URL:https://122.147.213.44:8080/
 *   Login:599 / 0601
 *   抓分機 502(Haper)+ 503(Su)— 招募夥伴致電求職者的分機
 *   每分機:通話通數 + 通話總秒數(換算分鐘)
 *
 * 跑頻率:每 15 分鐘(配 cron.yml every-15-min schedule,共用 metabase 排程)
 *
 * 為避免每次 login,session token 暫存在 system_secrets.pbx_session
 *
 * ⚠️ PBX 用 self-signed cert,fetch 預設不接受 — node 18+ 需 Agent ignore
 *    Next.js Edge runtime 不支援 https.Agent,改用 node runtime
 */

export const runtime = "nodejs";

const PBX_HOST = process.env.PBX_HOST || "https://122.147.213.44:8080";
const PBX_USER = process.env.PBX_USER || "599";
const PBX_PASS = process.env.PBX_PASS || "0601";
const TARGET_EXTS = ["502", "503"]; // Haper, Su
const EXT_NAMES: Record<string, string> = { "502": "Haper", "503": "Su" };

interface CallStat {
  ext: string;
  agent: string;
  date: string;
  calls: number;
  totalSec: number;
  totalMin: number;
  answered: number;
}

async function pbxFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const url = PBX_HOST + path;
  // Self-signed cert: ignore TLS verify(node only)
  // 改用 Basic Auth header(很多 PBX 直接吃)
  const basic = Buffer.from(`${PBX_USER}:${PBX_PASS}`).toString("base64");

  // node-fetch / undici 在 Next.js Node runtime 預設嚴格驗 cert
  // 透過 NODE_TLS_REJECT_UNAUTHORIZED env(僅本 fetch 開,執行完 restore)
  const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    return await fetch(url, {
      ...opts,
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
  } finally {
    if (prevTls !== undefined) process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
    else delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  }
}

function todayTaipei(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 嘗試從 PBX 抓特定分機今日通話統計
 * 不同 PBX 廠牌 endpoint 不同,先 try 常見幾個 path
 *
 * Wave 1:回 stub(尚未確認 PBX vendor)。Vincent 確認後填正確 endpoint。
 */
async function tryFetchExtStats(ext: string, date: string): Promise<CallStat | null> {
  const candidates = [
    `/api/cdr?ext=${ext}&date=${date}`,
    `/cdr?ext=${ext}&date=${date}`,
    `/api/v1/cdr/extension/${ext}?date=${date}`,
    `/cgi-bin/api-system_status?action=getextensionstatus&extension=${ext}`,
  ];
  for (const path of candidates) {
    try {
      const res = await pbxFetch(path, { method: "GET" });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("json") ? await res.json() : await res.text();
      // try common shapes
      let calls = 0, totalSec = 0, answered = 0;
      if (typeof data === "object" && data !== null) {
        const d = data as Record<string, unknown>;
        calls = Number(d.calls || d.total_calls || d.cnt || 0);
        totalSec = Number(d.total_sec || d.total_duration || d.duration_sec || 0);
        answered = Number(d.answered || d.connected || 0);
      } else if (typeof data === "string") {
        // stub: 大部分 PBX text 響應需要 vendor-specific parse
        continue;
      }
      if (calls > 0 || totalSec > 0) {
        return {
          ext,
          agent: EXT_NAMES[ext] || ext,
          date,
          calls,
          totalSec,
          totalMin: Math.round(totalSec / 60),
          answered,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    if (!req.headers.get("x-zeabur-cron")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const date = todayTaipei();
  const supabase = getSupabaseAdmin();
  const started = Date.now();

  const stats: CallStat[] = [];
  const errors: Array<{ ext: string; err: string }> = [];

  for (const ext of TARGET_EXTS) {
    try {
      const stat = await tryFetchExtStats(ext, date);
      if (stat) {
        stats.push(stat);
        // upsert into phone_call_log(daily aggregate)
        await supabase.from("phone_call_log").upsert(
          {
            extension: ext,
            agent: stat.agent,
            date,
            calls: stat.calls,
            total_sec: stat.totalSec,
            total_min: stat.totalMin,
            answered: stat.answered,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "extension,date" }
        );
      } else {
        errors.push({ ext, err: "no PBX endpoint matched (need Vincent confirm vendor)" });
      }
    } catch (e) {
      errors.push({ ext, err: e instanceof Error ? e.message.slice(0, 100) : "unknown" });
    }
  }

  return Response.json({
    ok: true,
    date,
    duration_ms: Date.now() - started,
    stats,
    errors,
    note: errors.length === TARGET_EXTS.length
      ? "PBX endpoint 待 Vincent 確認 vendor(目前 4 種 candidate path 都沒回 — Yeastar/3CX/asterisk-cdr/freepbx?)"
      : undefined,
  });
}

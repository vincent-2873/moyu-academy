import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/test-ping/seed-decisions
 *
 * Vincent 第十三輪 verify Wave 7.5 reject v2 closed-loop
 * 插 3 個 demo pending decisions 到 decision_records 給 hub 顯示
 */

const DEMO_DECISIONS = [
  {
    category: "strategy",
    title: "ooschool 連兩月低於目標 70%,啟動全面腳本重訓",
    context: "ooschool 4 月成交 5 / 目標 8(63%),5 月迄今 5 通電話 5 個邀約 5 個成交效率反常 — 看似爆發但實際單一案件,新客戶轉換 0。腳本對 ESG 主題客群免疫。",
    claude_recommendation: "本週啟動 5 天密集腳本重訓:Day 1-2 拆解現腳本失效原因(對標 nschool 36% 邀約轉成交);Day 3 引入 SPIN-Q 結構;Day 4 角色扮演;Day 5 真實 100 通驗證。預期 3 週後恢復目標 70%。",
    urgency: "high",
  },
  {
    category: "operations",
    title: "xlab 本週 289 通電話 0 成交,2 位人力空轉",
    context: "xlab 王希希 + 李怡萱 W18 共 289 通電話,連續 5 個工作日 0 成交。雖然產品為實驗品牌但完全沒進線索 = 不是腳本問題,是「品牌定位 / 目標客群」問題。",
    claude_recommendation: "暫停 xlab 撥打 1 週,我跟兩位協作 1 hr 重定義 ICP(理想客群),產生新撥打名單測試 50 通驗證假設。如再 0 成交,評估 xlab 是否需 pause 或 pivot。",
    urgency: "critical",
  },
  {
    category: "hr",
    title: "全員週六加班補課程同步(本週上完 W18 進度)",
    context: "上月新訓 6 人完成 60% 訓練,但 W18 業務生產力出現倒退,根據 sales_metrics 數據,新人 ramping 比預期慢 10 天。",
    claude_recommendation: "本週六(5/9)安排集中半日訓練(09:00-13:00),新訓 6 人 + 主管 Lance 共同檢視「為何 W18 0 成交」。我提供逐字稿復盤模板。預期挽回 ramping curve 5 天。",
    urgency: "normal",
  },
];

export async function GET(req: NextRequest) {
  // 簡單驗證 — 只在 dev / explicit ?key=manual-trigger
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== "manual-trigger") {
    return NextResponse.json({ ok: false, error: "missing key" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const inserted: Array<{ id: string; title: string }> = [];

  for (const d of DEMO_DECISIONS) {
    const { data, error } = await sb
      .from("decision_records")
      .insert({
        ...d,
        status: "pending",
        evidence_refs: [],
      })
      .select("id, title")
      .single();
    if (data) inserted.push({ id: data.id, title: data.title });
    else if (error) console.error("[seed]", error);
  }

  return NextResponse.json({ ok: true, inserted_count: inserted.length, inserted });
}

export const POST = GET;

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MODULE_TYPES = ["video", "reading", "quiz", "sparring", "task", "reflection", "live_session"] as const;
type ModuleType = typeof ALLOWED_MODULE_TYPES[number];

interface DraftModule {
  day_offset: number;       // 0-13
  sequence: number;          // 1, 2 (each day 2 modules)
  module_type: ModuleType;
  title: string;
  description: string;
  duration_min: number;
}

const BRAND_CHINESE: Record<string, string> = {
  nschool:  "nSchool 財經學院",
  xuemi:    "XUEMI 學米",
  ooschool: "ooschool 無限學院",
  aischool: "aischool 未來學院",
  xlab:     "X LAB AI 實驗室",
};

const SYSTEM_PROMPT = `你是墨宇集團的訓練設計專家。

任務:為指定品牌設計 14 天業務養成 SOP,共 28 個 training modules(每天 2 個 module)。

設計原則(必須遵守):
1. D0-D6 是基礎期(認識公司 / 顧問式開發 / 開場白 / 探詢需求)
2. D7-D10 是進階期(異議處理 / 客戶分群 / 案例拆解)
3. D11-D13 是實戰期(模擬電話 / Demo 演練 / 收尾簽約)
4. 每天 sequence=1 多為「輸入」(video / reading),sequence=2 多為「輸出」(sparring / task / reflection)
5. duration_min 控制在 5-30 分鐘(新人專注度有限)
6. 標題要敘述性,不要用「Module 1 / D3 #2」這種代號(新人不會買單)
7. description 要 1 句說「為什麼學這個」

module_type 只能用以下 7 種(其他會被資料庫拒絕):
- video       講師影片
- reading     文章閱讀
- quiz        小測驗
- sparring    跟 Claude 對練(D2 後才開始,D7 後增加頻率)
- task        實作任務(打第一通電話 / 寫客戶輪廓)
- reflection  反思題(寫 100 字感想)
- live_session 直播 / Workshop(可選,通常 D14 結業)

JSON output 格式(strict):
{
  "modules": [
    { "day_offset": 0, "sequence": 1, "module_type": "video", "title": "歡迎來到 X 學院 · 首日報到", "description": "了解 X 的使命、3 大產品線、你的角色", "duration_min": 15 },
    { "day_offset": 0, "sequence": 2, "module_type": "task", "title": "今日反思:我對銷售的想像 vs 現實", "description": "寫下你來這之前對銷售的想像,以及你想學會的事", "duration_min": 10 },
    ... 28 entries total
  ]
}

不要加任何 markdown 或解釋,只回 strict JSON。`;

/**
 * POST /api/admin/training-ops/materials/generate-draft
 *
 * Body: { path_id: string, brand: string }
 * 用 OpenAI gpt-4o-mini 為指定品牌 + path 生成 28 個 module 草稿
 * 寫到 path_completeness.claude_drafts(jsonb 暫存,等採用才寫進 training_modules)
 *
 * Cost: ~3K token × $0.15/1M = $0.0005 per call
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const pathId = String(body.path_id ?? "");
  const brand = String(body.brand ?? "");

  if (!pathId || !brand) {
    return NextResponse.json({ ok: false, error: "path_id and brand required" }, { status: 400 });
  }

  const brandLabel = BRAND_CHINESE[brand] ?? brand;
  const sb = getSupabaseAdmin();

  try {
    // 確認 path 存在
    const { data: pathRow, error: pathErr } = await sb.from("training_paths")
      .select("id, code, brand, total_days")
      .eq("id", pathId)
      .single();
    if (pathErr || !pathRow) {
      return NextResponse.json({ ok: false, error: `Path not found: ${pathId}` }, { status: 404 });
    }

    const userPrompt = `為「${brandLabel}」(brand code: ${brand})設計 14 天業務養成 SOP,共 28 個 module。
此品牌特色請考量:
${getBrandContext(brand)}

回 strict JSON。`;

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        max_tokens: 8000,
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!oaiRes.ok) {
      const errText = await oaiRes.text();
      return NextResponse.json(
        { ok: false, error: `OpenAI ${oaiRes.status}: ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const oaiData = await oaiRes.json();
    const text = oaiData.choices?.[0]?.message?.content ?? "";
    let parsed: { modules: DraftModule[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "OpenAI 回傳非 JSON", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    if (!Array.isArray(parsed.modules)) {
      return NextResponse.json(
        { ok: false, error: "OpenAI 回的 JSON 缺 modules array" },
        { status: 502 }
      );
    }

    // 驗證每個 module
    const validated: DraftModule[] = [];
    const invalid: string[] = [];
    for (const m of parsed.modules) {
      if (typeof m.day_offset !== "number" || m.day_offset < 0 || m.day_offset > 13) {
        invalid.push(`day_offset out of range: ${m.day_offset}`);
        continue;
      }
      if (typeof m.sequence !== "number" || m.sequence < 1 || m.sequence > 4) {
        invalid.push(`sequence out of range: ${m.sequence}`);
        continue;
      }
      if (!ALLOWED_MODULE_TYPES.includes(m.module_type as ModuleType)) {
        invalid.push(`invalid module_type: ${m.module_type}`);
        continue;
      }
      if (!m.title || !m.description) {
        invalid.push(`missing title/description for D${m.day_offset}#${m.sequence}`);
        continue;
      }
      validated.push({
        day_offset: m.day_offset,
        sequence: m.sequence,
        module_type: m.module_type as ModuleType,
        title: String(m.title).slice(0, 200),
        description: String(m.description).slice(0, 500),
        duration_min: Math.max(1, Math.min(60, Number(m.duration_min) || 15)),
      });
    }

    // 寫到 path_completeness.claude_drafts(upsert)
    const { error: upsertErr } = await sb.from("path_completeness")
      .upsert({
        path_id: pathId,
        brand,
        total_modules_expected: 28,
        total_modules_actual: 0,
        missing_modules: validated.map(m => ({ day: m.day_offset, sequence: m.sequence, suggested_title: m.title })),
        claude_drafts: { modules: validated, generated_at: new Date().toISOString() },
        computed_at: new Date().toISOString(),
      }, { onConflict: "path_id,brand" });

    if (upsertErr) {
      return NextResponse.json({ ok: false, error: `Failed to save drafts: ${upsertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      path_code: pathRow.code,
      brand,
      brand_label: brandLabel,
      drafts_count: validated.length,
      invalid_count: invalid.length,
      invalid,
      drafts: validated,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

function getBrandContext(brand: string): string {
  switch (brand) {
    case "nschool":
      return "- 財經教育(投資理財 / 股票分析 / 個人理財規劃)\n- 客群:30-50 歲想學投資理財的上班族\n- 銷售重點:具體投報案例、信任感";
    case "xuemi":
      return "- 學米(技能成長 / 自我品牌 / 產品力)\n- 客群:25-45 歲想轉職或創業的上班族\n- 銷售重點:故事 / 個人品牌轉變的案例";
    case "ooschool":
      return "- 無限學院(全方位個人成長)\n- 客群:25-50 歲想精進通用能力的上班族\n- 銷售重點:跨領域應用、人脈、社群";
    case "aischool":
      return "- 未來學院(AI 應用 / 數位技能)\n- 客群:25-50 歲想學 AI / 工具的職場人\n- 銷售重點:具體 AI 工具示範、效率提升";
    case "xlab":
      return "- X LAB AI 實驗室(實體班 / Workshop)\n- 客群:25-50 歲想要實體互動學習的人\n- 銷售重點:現場體驗、講師近距離、實作";
    default:
      return "- 通用業務養成";
  }
}

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

// Phase B-4 後對齊:砍 X Platform 6 brand(system-tree v2 不在系統範圍)
// 統一以 path 區分(business_default / legal_default 等)
const PATH_LABEL: Record<string, string> = {
  business_default: "墨宇業務養成(BIZ)— 對齊 nSchool 真實 8 步驟 + 4 本書",
  legal_default:    "墨宇法務養成(LEGAL)— 待 Vincent 給法務 source",
};

const SYSTEM_PROMPT = `你是墨宇集團的業務訓練設計專家。

# 鐵則(2026-05-01 Vincent 拍板,Phase 6 前不變)
做每個 module 都要「基於 nSchool 既有 source 延伸」,**不從零生成**。違反鐵則的 28 個 stub 已被 D19 SQL 砍除。

# 真實素材源(content/training/sales/nschool/.../Categories/訓練中心/開發檢核/)
nSchool 真實 8 步驟(每個 sparring module 必須對齊這 8 步):
1. 破冰 — IG 引入理財話題,問開放問題挖客戶投資領域興趣
2. 信任建立 — 第三人視角(你/我/他)+ 數據+案例+複利效應(10萬投30年到174萬)
3. 需求探索 — 基本面/技術面/籌碼面 + 痛點(被套/不知何時買賣/追高被坑)
4. 介紹nSchool — 凱衛資訊 5201 上市櫃 + 20-30 年金融軟硬體 + nStock/Cmoney 同集團
5. 補充資訊 — 蒐集需求/預算 + 起承轉合架構(別太早介紹「我是誰」)
6. 財經架構 — 盈虧不對稱(賺10賠10時間成本)→ 時間複利演算 → 3 面分析導入
7. 產品引導與價值說明 — 客製化 vs HAHOW + 財經教練 + 5-10% 學習成本論
8. 行動邀請 — 30 min Google Meet 免費試聽 + 2 選 1 漏斗 + 加 LINE @5201nschool

# 4 本書 reading module(D20 SQL applied)
- GROW(Goal/Reality/Options/Will)
- 黃金圈(Why → How → What)
- OKR(Objectives / Key Results,KPI 漏斗拆解)
- SPIN(Situation/Problem/Implication/Need-Payoff)

# 訓練官 Yu 三點評估準則(對練必對齊)
順暢性 / 邏輯性(依架構順序) / 語氣語調

# KPI 漏斗(Yu 反覆強調)
撥多少通 → 通次 → 通時 → 邀約 → 出席 → 成交

# 14 天節奏(D2 既有結構)
- D0 報到 → 合約 / 集團 / 業務制度 / 聽 5 份開發 Call / 兩兩對練(20:00+)
- D1-2 顧問式開發說明 → nSchool 8 步驟逐字稿對練 + 4 本書 reading
- D3-4 邀約嘗試(Pass 給學長帶)
- D5 Demo 教學
- D6 第一單
- D7 第一週驗收(KPI 漏斗檢核)
- D8-13 量 + 質提升
- D14 出師驗收

# 設計原則
1. **每個 module 必須對應到 nSchool 8 步驟之一 / 4 本書之一 / D2 既有架構**(不創造新主題)
2. sequence=1 偏「輸入」(video / reading);sequence=2 偏「輸出」(sparring / task / reflection)
3. duration_min 5-30 min(新人專注度有限)
4. 標題敘述性,不用代號(「Module 1 / D3 #2」NG)
5. description 1 句說「為什麼學這個」+ 引用 nSchool source 主題
6. sparring framework 對齊 nSchool 真實 8 步驟,不用 X-LAB 8 步(已砍)

# module_type(7 種,違反會被 DB 拒)
- video      講師影片
- reading    文章閱讀(4 本書專用)
- quiz       小測驗
- sparring   跟 Claude 對練(D1 後開始,framework 對齊 nSchool 8 步驟)
- task       實作任務
- reflection 反思題
- live_session 直播 / Workshop

# JSON output 格式
{
  "modules": [
    { "day_offset": 0, "sequence": 1, "module_type": "video", "title": "...", "description": "...", "duration_min": 15 },
    ...
  ]
}

不要加 markdown 或解釋,只回 strict JSON。`;

/**
 * 從 RAG knowledge_chunks 撈真實 source 內容,帶進 prompt context
 *
 * 策略:
 *   1. nSchool 8 步驟核心 chunk(所有品牌共用骨幹)
 *   2. 該 brand 特化 chunk(brand 自己的領域知識 / ALL Projects)
 *
 * 對齊鐵則:每個 module 都從 Vincent 既有 source 延伸,不從零 AI 生成
 */
async function fetchRagContext(
  sb: ReturnType<typeof getSupabaseAdmin>,
  brand: string
): Promise<{ context: string; chunk_count: number }> {
  // 1. nSchool 8 步驟核心(永遠帶,所有 brand sparring framework 對齊這 8 步)
  const { data: coreChunks } = await sb.from("knowledge_chunks")
    .select("title, content, source_id")
    .eq("pillar", "sales")
    .like("source_id", "training/sales/nschool/%")
    .is("deprecated_at", null)
    .limit(8);

  // 2. brand 特化 chunk(若不是 nschool 才補,避免重複)
  let brandChunks: Array<{ title: string | null; content: string; source_id: string }> = [];
  if (brand && brand !== "nschool") {
    const { data } = await sb.from("knowledge_chunks")
      .select("title, content, source_id")
      .eq("pillar", "sales")
      .like("source_id", `training/sales/${brand}/%`)
      .is("deprecated_at", null)
      .limit(4);
    brandChunks = data ?? [];
  }

  const all = [...(coreChunks ?? []), ...brandChunks];
  if (all.length === 0) {
    return { context: "(暫無 RAG source — 先用既有 8 步驟綱要)", chunk_count: 0 };
  }

  // 每個 chunk 截前 1200 字,避免爆 token
  const context = all
    .map(c => `## ${c.title || c.source_id}\n${(c.content ?? "").slice(0, 1200)}`)
    .join("\n\n---\n\n");

  return { context, chunk_count: all.length };
}

/**
 * POST /api/admin/training-ops/materials/generate-draft
 *
 * Body: { path_id: string, brand: string }
 * 用 OpenAI gpt-4o-mini 為指定品牌 + path 生成 28 個 module 草稿
 * 寫到 path_completeness.claude_drafts(jsonb 暫存,等採用才寫進 training_modules)
 *
 * Phase B-4(2026-05-01):接 RAG knowledge_chunks 帶真實 source 進 prompt,
 *                       不再只靠 hardcode 8 步驟綱要(但綱要保留當作 fallback)
 *
 * Cost: ~5K token × $0.15/1M = $0.00075 per call(加 RAG context 後略增)
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

    // 撈既有 module 看缺哪些(對齊鐵則:延伸既有,不重複生)
    const { data: existingModules } = await sb.from("training_modules")
      .select("day_offset, sequence, module_type, title")
      .eq("path_id", pathId)
      .order("day_offset", { ascending: true })
      .order("sequence", { ascending: true });

    const existingSummary = (existingModules ?? [])
      .map(m => `D${m.day_offset}#${m.sequence} [${m.module_type}] ${m.title}`)
      .join("\n");

    const pathLabel = PATH_LABEL[pathRow.code] ?? pathRow.code;

    // Phase B-4:撈 RAG 真實 source 進 prompt(對齊鐵則)
    const { context: ragContext, chunk_count: ragChunkCount } = await fetchRagContext(sb, brand);

    const userPrompt = `Path: ${pathLabel}(code: ${pathRow.code} / brand: ${brand})
total_days: ${pathRow.total_days ?? 14}

# 真實 source 內容(${ragChunkCount} chunks · 從 RAG knowledge_chunks pillar='sales' 撈)
**鐵則**:每個 module 必須引用以下真實 source(不從零生)。標題 / 描述要對應到 source 主題。

${ragContext}

---

# 既有 module(${existingModules?.length ?? 0} 個 — 別重複生這些)
${existingSummary || "(空,新品牌 path)"}

# 你的任務
基於上面真實 source + 既有 8 步驟 + 4 本書,補滿 14 天節奏,**不創新主題**。
每個 module 的 description 應該明確引用 source 中的關鍵概念(例如:「複利效應(10萬投30年到174萬)」「凱衛 5201 上市櫃」「KPI 漏斗:撥通→通次→通時」)。

回 strict JSON,modules 陣列只列「需要補的」module(不含既有的)。`;

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
    const expectedTotal = (existingModules?.length ?? 0) + validated.length;
    const { error: upsertErr } = await sb.from("path_completeness")
      .upsert({
        path_id: pathId,
        brand,
        total_modules_expected: expectedTotal,
        total_modules_actual: existingModules?.length ?? 0,
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
      path_label: pathLabel,
      existing_count: existingModules?.length ?? 0,
      drafts_count: validated.length,
      invalid_count: invalid.length,
      invalid,
      rag_chunks_used: ragChunkCount,
      drafts: validated,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

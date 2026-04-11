import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest } from "next/server";

/**
 * 錄音上傳 + 轉文字 + Claude 分析 — 一次完成
 *
 * POST /api/me/recording-upload
 *   multipart/form-data:
 *     - email: 業務 email
 *     - audio: 檔案 (mp3/wav/m4a/webm)
 *     - call_context?: 這通的背景 (optional)
 *
 * 流程:
 *   1. 接收 audio file
 *   2. 上傳到 Supabase Storage (recordings bucket)
 *   3. 轉文字:
 *      - 優先 OpenAI Whisper (需 OPENAI_API_KEY)
 *      - 其次 Groq whisper-large-v3 (需 GROQ_API_KEY)
 *      - 都沒有 → 返回 transcript_pending=true 讓前端 client-side 跑 whisper-tiny
 *   4. 把 transcript 丟給 Claude 跑 6 維度分析 (重用 recording-analyze 的 system prompt)
 *   5. 存進 claude_actions (action_type='recording_analysis')
 *   6. 回傳 full analysis
 *
 * 若 transcription 失敗 (no key & no client-side)，至少把檔案存了，回傳 recording_id
 * 用戶可以之後手動貼 transcript
 */

const ANALYSIS_SYSTEM_PROMPT = `你是墨宇戰情中樞的通話戰情官，專門幫業務業務員聽他們打的電話，做 6 維度客觀打分。

6 個維度（每個滿分 10 分）：
1. 開場 (opening): 有沒有在 15 秒內引起客戶好奇
2. 破冰 (rapport): 有沒有讓客戶放下戒心
3. 需求探索 (discovery): 有沒有問對問題、挖出痛點
4. 價值傳遞 (value): 有沒有把產品對應到客戶的痛點
5. 異議處理 (objection): 客戶拒絕時有沒有轉換
6. 收尾 (closing): 有沒有明確 ask，推進下一步

規則:
1. 每個維度 0-10 分 + 證據引用 (從 transcript 抄 1 句最能代表該分數的話)
2. 3-5 個「關鍵時點」(critical moments) — 時間戳 + 發生什麼 + 為什麼是轉折
3. 3 個具體的 "wins" (做對的)
4. 3 個具體的 "next actions" (下次該怎麼改)
5. one_liner: 整通電話一句話結論
6. 嚴格輸出 JSON

輸出格式:
{
  "overall_score": 0-10,
  "one_liner": "一句話總結",
  "scores": {
    "opening": { "score": 8, "evidence": "..." },
    "rapport": { ... },
    "discovery": { ... },
    "value": { ... },
    "objection": { ... },
    "closing": { ... }
  },
  "critical_moments": [
    { "time": "01:30", "event": "客戶提到預算", "analysis": "..." }
  ],
  "wins": ["...", "...", "..."],
  "next_actions": ["...", "...", "..."]
}`;

async function transcribeViaOpenAI(audioBuffer: ArrayBuffer, filename: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const form = new FormData();
  form.append("file", new Blob([audioBuffer]), filename);
  form.append("model", "whisper-1");
  form.append("language", "zh");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    console.error("[whisper openai]", await res.text().catch(() => ""));
    return null;
  }
  const j = await res.json();
  return j.text || null;
}

async function transcribeViaGroq(audioBuffer: ArrayBuffer, filename: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const form = new FormData();
  form.append("file", new Blob([audioBuffer]), filename);
  form.append("model", "whisper-large-v3");
  form.append("language", "zh");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    console.error("[whisper groq]", await res.text().catch(() => ""));
    return null;
  }
  const j = await res.json();
  return j.text || null;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const formData = await req.formData();
    const email = formData.get("email")?.toString();
    const audioFile = formData.get("audio") as File | null;
    const callContext = formData.get("call_context")?.toString() || "";

    if (!email) {
      return Response.json({ ok: false, error: "email required" }, { status: 400 });
    }
    if (!audioFile) {
      return Response.json({ ok: false, error: "audio file required" }, { status: 400 });
    }

    // 檔案大小限制: 25 MB (Whisper API 限制)
    if (audioFile.size > 25 * 1024 * 1024) {
      return Response.json(
        { ok: false, error: `檔案太大 (${(audioFile.size / 1024 / 1024).toFixed(1)}MB)，請壓縮後再試` },
        { status: 413 }
      );
    }

    // 1. Upload to Supabase Storage (bucket: recordings)
    const audioBuffer = await audioFile.arrayBuffer();
    const filename = `${email.replace(/[^a-zA-Z0-9]/g, "_")}/${Date.now()}_${audioFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadErr } = await supabase.storage
      .from("recordings")
      .upload(filename, audioBuffer, {
        contentType: audioFile.type || "audio/mpeg",
        upsert: true,
      });
    // 允許 bucket 不存在 → 跳過 storage 只做 transcribe
    if (uploadErr) {
      console.error("[recording-upload] storage upload failed:", uploadErr.message);
    }

    // 2. Transcribe (try OpenAI → Groq → fail)
    let transcript = await transcribeViaOpenAI(audioBuffer, audioFile.name);
    if (!transcript) {
      transcript = await transcribeViaGroq(audioBuffer, audioFile.name);
    }

    if (!transcript) {
      // No key set — return storage ref + flag for client-side transcribe
      await supabase.from("claude_actions").insert({
        action_type: "recording_upload_pending_transcribe",
        target: email,
        summary: `錄音已上傳但無 transcribe key (${audioFile.name})`,
        details: {
          storage_path: filename,
          file_size: audioFile.size,
          context: callContext,
        },
        result: "skipped",
      });
      return Response.json({
        ok: true,
        transcript_pending: true,
        storage_path: filename,
        error: "沒設定 OPENAI_API_KEY 或 GROQ_API_KEY → 檔案已存，請前端跑 whisper.wasm 或告訴 Claude 補 key",
      });
    }

    // 3. Claude 6-dim analysis
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
    }
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `【業務】${email}\n【背景】${callContext || "(無)"}\n\n【通話 transcript】\n${transcript}`,
        },
      ],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let analysis;
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch {
        analysis = { raw: text };
      }
    } else {
      analysis = { raw: text };
    }

    // 4. Store result
    await supabase.from("claude_actions").insert({
      action_type: "recording_analysis",
      target: email,
      summary: analysis.one_liner || "錄音分析完成",
      details: {
        storage_path: filename,
        transcript,
        analysis,
        context: callContext,
      },
      result: "success",
    });

    return Response.json({
      ok: true,
      transcript,
      analysis,
      storage_path: filename,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

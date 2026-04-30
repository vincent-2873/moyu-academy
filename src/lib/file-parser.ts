/**
 * 2026-04-30 第三輪 Wave C:多 mime 文件 parser
 *
 * 接受 File / Blob,根據 mime 走不同管道:
 *   - text/plain, text/markdown, text/html → 直接 read
 *   - application/json → 直接 read
 *   - audio/* → Groq Whisper Large v3
 *   - video/* → 提取 audio track 後 Whisper(目前 Groq 直接吃 video)
 *
 * 沒 GROQ_API_KEY → audio/video stub:回 status='pending',transcript 留空,
 *   讓 admin 之後補 key 再 trigger transcribe-pending cron
 */

export interface ParseResult {
  text: string;
  mime: string;
  status: "ready" | "pending" | "failed" | "not_applicable";
  meta: {
    bytes: number;
    duration_seconds?: number;
    transcribe_provider?: string;
    error?: string;
  };
}

const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/html",
  "text/csv",
  "application/json",
]);

const AUDIO_MIMES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
]);

const VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/mpeg",
]);

export async function parseFile(file: File): Promise<ParseResult> {
  const bytes = file.size;
  const mime = file.type || "application/octet-stream";
  const meta = { bytes };

  // text-like
  if (TEXT_MIMES.has(mime) || mime.startsWith("text/")) {
    try {
      const text = await file.text();
      return { text, mime, status: "ready", meta };
    } catch (err) {
      return { text: "", mime, status: "failed", meta: { ...meta, error: String(err) } };
    }
  }

  // audio / video → Groq Whisper
  if (AUDIO_MIMES.has(mime) || VIDEO_MIMES.has(mime) || mime.startsWith("audio/") || mime.startsWith("video/")) {
    return await transcribeWhisper(file, meta);
  }

  // unsupported(PDF / docx 暫不支援)
  return {
    text: "",
    mime,
    status: "not_applicable",
    meta: { ...meta, error: `unsupported mime: ${mime}` },
  };
}

async function transcribeWhisper(file: File, meta: { bytes: number; error?: string }): Promise<ParseResult> {
  const apiKey = process.env.GROQ_API_KEY;

  // 沒 GROQ key:stub mode,record file but transcript pending
  if (!apiKey) {
    return {
      text: "",
      mime: file.type,
      status: "pending",
      meta: {
        ...meta,
        transcribe_provider: "groq-whisper-stub",
        error: "GROQ_API_KEY 未設,先存 metadata,設 key 後 cron 補轉錄",
      },
    };
  }

  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("model", "whisper-large-v3");
    fd.append("response_format", "verbose_json");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        text: "",
        mime: file.type,
        status: "failed",
        meta: { ...meta, transcribe_provider: "groq-whisper-large-v3", error: `${res.status}: ${errText.slice(0, 200)}` },
      };
    }

    const data = await res.json();
    const text = data.text || "";
    const duration = typeof data.duration === "number" ? data.duration : undefined;

    return {
      text,
      mime: file.type,
      status: "ready",
      meta: { ...meta, duration_seconds: duration, transcribe_provider: "groq-whisper-large-v3" },
    };
  } catch (err) {
    return {
      text: "",
      mime: file.type,
      status: "failed",
      meta: { ...meta, transcribe_provider: "groq-whisper-large-v3", error: String(err) },
    };
  }
}

export function isSupportedMime(mime: string): boolean {
  return (
    TEXT_MIMES.has(mime) ||
    mime.startsWith("text/") ||
    AUDIO_MIMES.has(mime) ||
    mime.startsWith("audio/") ||
    VIDEO_MIMES.has(mime) ||
    mime.startsWith("video/")
  );
}

/** 用 file size + mime 大概估 transcribe 成本 */
export function estimateTranscribeCost(bytes: number, mime: string): { provider: string; usd: number } {
  if (TEXT_MIMES.has(mime) || mime.startsWith("text/")) return { provider: "free", usd: 0 };
  // 假設 audio 1 MB = 1 min,Groq Whisper Large v3 = $0.00185/min
  const minutes = bytes / (1024 * 1024);
  const usd = Number((minutes * 0.00185).toFixed(4));
  return { provider: "groq-whisper", usd };
}

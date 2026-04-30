import { getSupabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/assets/training-upload-url
// body: { filename, content_type, kind: 'video' | 'audio' }
// 回傳: { upload_url (signed PUT), path, public_url? }

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { filename, kind = "video", subdir = "" } = body;
  if (!filename) return NextResponse.json({ error: "missing filename" }, { status: 400 });

  const bucket = kind === "audio" ? "training-audio" : "training-videos";
  const safeName = filename.replace(/[^\w.\-]/g, "_");
  const ts = new Date().toISOString().slice(0, 10);
  const path = `${subdir ? subdir + "/" : ""}${ts}/${Date.now()}-${safeName}`;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage.from(bucket).createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message, hint: "確認 D12 SQL 已 apply + bucket 存在" }, { status: 500 });

  let publicUrl: string | undefined;
  if (kind === "video") {
    const { data: pu } = sb.storage.from(bucket).getPublicUrl(path);
    publicUrl = pu?.publicUrl;
  }

  return NextResponse.json({
    upload_url: data.signedUrl,
    token: data.token,
    path,
    bucket,
    public_url: publicUrl,
  });
}

export async function GET() {
  // 列最近上傳
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage.from("training-videos").list("", { limit: 50, sortBy: { column: "created_at", order: "desc" } });
  if (error) return NextResponse.json({ items: [], note: error.message });
  return NextResponse.json({ items: data || [] });
}

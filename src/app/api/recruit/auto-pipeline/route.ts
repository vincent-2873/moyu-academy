import { getSupabaseAdmin } from "@/lib/supabase";
import { uploadToDrive, appendRecruitRecord, getResumeFolder } from "@/lib/google-api";
import { NextRequest } from "next/server";

/**
 * 🚀 招聘全自動化 Pipeline API
 *
 * POST /api/recruit/auto-pipeline
 *
 * 一個 call 搞定:
 *   1. 接收 104 求職者資訊
 *   2. 生成履歷 PDF (HTML → PDF)
 *   3. 上傳到 Google Drive (正確的城市/年度/季度資料夾)
 *   4. 寫入 Google Sheet 邀約紀錄表
 *   5. 寫入 Supabase recruits + outreach_log
 *
 * body: {
 *   candidateName: string       — 求職者姓名 (必填)
 *   age?: number                — 年齡
 *   gender?: string             — 性別
 *   phone?: string              — 電話
 *   email?: string              — Email
 *   city: string                — 工作城市: 台北/台中/高雄 (必填)
 *   branch?: string             — 據點名稱 (如 "Terry台北延平職能")
 *   education?: string          — 最高學歷
 *   experience?: string         — 工作經歷摘要
 *   experienceYears?: string    — 總年資
 *   recentJob?: string          — 最近工作
 *   desiredTitle?: string       — 希望職稱
 *   resumeText?: string         — 完整履歷文字 (104 爬的)
 *   recruiterName: string       — 負責人 (必填, 如 "Vincent")
 *   recruiterEmail?: string     — 負責人 email
 *   inviteMethod?: string       — 邀約方式 (default: "信件邀約")
 *   jobTitle?: string           — 職缺名稱
 *   jobType?: string            — 業務 / 客服 / 門市
 *   source?: string             — 來源: "104" / "LinkedIn" / "內推"
 *   sourceId?: string           — 104 代碼
 *   sourceUrl?: string          — 104 履歷頁面 URL
 * }
 */

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const body = await req.json();

  const {
    candidateName,
    age,
    gender,
    phone,
    email,
    city,
    branch,
    education,
    experience,
    experienceYears,
    recentJob,
    desiredTitle,
    resumeText,
    recruiterName,
    recruiterEmail,
    inviteMethod = "信件邀約",
    jobTitle,
    jobType = "業務",
    source = "104",
    sourceId,
    sourceUrl,
  } = body;

  // Validation
  if (!candidateName || !city || !recruiterName) {
    return Response.json(
      { ok: false, error: "candidateName + city + recruiterName 必填" },
      { status: 400 }
    );
  }

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const inviteDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;
  const fileName = `${dateStr}-${branch || city + "職能"}-${candidateName}.pdf`;

  const results: Record<string, unknown> = { candidateName, fileName };

  // =============================================
  // Step 1: 生成 PDF
  // =============================================
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateResumePdf({
      candidateName,
      age,
      gender,
      phone,
      email,
      education,
      experience,
      experienceYears,
      recentJob,
      desiredTitle,
      resumeText,
      sourceId,
      inviteDate,
      recruiterName,
      jobTitle,
    });
    results.pdfGenerated = true;
    results.pdfSize = pdfBuffer.length;
  } catch (err) {
    results.pdfGenerated = false;
    results.pdfError = String(err);
  }

  // =============================================
  // Step 2: 上傳到 Google Drive
  // =============================================
  let driveFileId: string | null = null;
  let driveLink: string | null = null;
  try {
    if (pdfBuffer) {
      const folderId = await getResumeFolder(city);
      const driveResult = await uploadToDrive({
        fileName,
        mimeType: "application/pdf",
        buffer: pdfBuffer,
        parentFolderId: folderId,
      });
      driveFileId = driveResult.id;
      driveLink = driveResult.webViewLink;
      results.driveUploaded = true;
      results.driveLink = driveLink;
    }
  } catch (err) {
    results.driveUploaded = false;
    results.driveError = String(err);
  }

  // =============================================
  // Step 3: 寫入 Google Sheet
  // =============================================
  try {
    await appendRecruitRecord({
      name: candidateName,
      branch: branch || "",
      recruiter: recruiterName,
      resumeLink: driveLink ? `${dateStr}-${branch || city + "職能"}-${candidateName}.pdf` : "",
      phone: phone || "",
      inviteDate,
      inviteMethod,
      channel: source,
      jobType,
    });
    results.sheetAppended = true;
  } catch (err) {
    results.sheetAppended = false;
    results.sheetError = String(err);
  }

  // =============================================
  // Step 4: 寫入 Supabase
  // =============================================
  try {
    // Insert into recruits
    const { data: recruit, error: recruitErr } = await supabase
      .from("recruits")
      .insert({
        name: candidateName,
        email: email || null,
        phone: phone || null,
        source,
        brand: null,
        position: jobTitle || "電銷業務",
        resume_url: driveLink || sourceUrl || null,
        notes: [
          `年齡: ${age || "未知"}`,
          `學歷: ${education || "未知"}`,
          `年資: ${experienceYears || "未知"}`,
          `最近工作: ${recentJob || "未知"}`,
          `104代碼: ${sourceId || "N/A"}`,
          resumeText ? `\n--- 履歷摘要 ---\n${resumeText.slice(0, 1000)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        owner_email: recruiterEmail || null,
        stage: "new",
      })
      .select()
      .single();

    if (recruitErr) {
      results.dbRecruitError = recruitErr.message;
    } else {
      results.recruitId = recruit.id;
    }

    // Insert into outreach_log
    await supabase.from("outreach_log").insert({
      candidate_name: candidateName,
      candidate_email: email || null,
      platform: source,
      job_title: jobTitle || "電銷業務",
      brand: null,
      message_template: inviteMethod,
      owner_email: recruiterEmail || null,
    });

    // Insert into claude_actions for tracking
    await supabase.from("claude_actions").insert({
      action_type: "recruit_auto_pipeline",
      target: candidateName,
      summary: `自動招聘: ${candidateName} · ${city} · ${inviteMethod} · ${recruiterName}`,
      details: {
        candidateName,
        city,
        phone,
        source,
        sourceId,
        recruiterName,
        jobTitle,
        driveFileId,
        driveLink,
        fileName,
        pdfGenerated: !!pdfBuffer,
      },
      result: pdfBuffer && driveLink ? "success" : "partial",
    });
    results.dbInserted = true;
  } catch (err) {
    results.dbInserted = false;
    results.dbError = String(err);
  }

  return Response.json({ ok: true, ...results });
}

// =============================================
// PDF 生成 (Server-side HTML → PDF)
// =============================================
async function generateResumePdf(data: {
  candidateName: string;
  age?: number;
  gender?: string;
  phone?: string;
  email?: string;
  education?: string;
  experience?: string;
  experienceYears?: string;
  recentJob?: string;
  desiredTitle?: string;
  resumeText?: string;
  sourceId?: string;
  inviteDate: string;
  recruiterName: string;
  jobTitle?: string;
}): Promise<Buffer> {
  // 用純文字生成簡單 PDF (不依賴 DOM)
  // 在 Node.js server 環境用 jsPDF
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // jsPDF 不支援中文字型（預設只有 Latin），所以我們生成一個簡單的帶文字的 PDF
  // 實際中文支援需要嵌入字型。這裡先用簡單方式。
  const lines = [
    `104 Resume - ${data.candidateName}`,
    ``,
    `Name: ${data.candidateName}`,
    `Age: ${data.age || "N/A"} | Gender: ${data.gender || "N/A"}`,
    `Phone: ${data.phone || "N/A"}`,
    `Email: ${data.email || "N/A"}`,
    `Education: ${data.education || "N/A"}`,
    `Desired Title: ${data.desiredTitle || "N/A"}`,
    `Experience: ${data.experienceYears || "N/A"}`,
    `Recent Job: ${data.recentJob || "N/A"}`,
    `104 ID: ${data.sourceId || "N/A"}`,
    ``,
    `--- Invited ---`,
    `Date: ${data.inviteDate}`,
    `Recruiter: ${data.recruiterName}`,
    `Position: ${data.jobTitle || "N/A"}`,
    ``,
    `--- Full Resume ---`,
  ];

  // Add resume text lines
  if (data.resumeText) {
    // Split long text into lines that fit A4 width
    const resumeLines = data.resumeText.split("\n");
    for (const line of resumeLines) {
      // jsPDF can handle ~80 chars per line at font size 10
      if (line.length > 80) {
        for (let i = 0; i < line.length; i += 80) {
          lines.push(line.slice(i, i + 80));
        }
      } else {
        lines.push(line);
      }
    }
  }

  let y = 15;
  const pageHeight = 280;
  doc.setFontSize(10);

  for (const line of lines) {
    if (y > pageHeight) {
      doc.addPage();
      y = 15;
    }
    doc.text(line, 10, y);
    y += 5;
  }

  // Convert to Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

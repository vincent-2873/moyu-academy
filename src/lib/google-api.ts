import { google } from "googleapis";

/**
 * Google Drive + Sheets 自動化 helper
 *
 * 用 Service Account 做 server-to-server 驗證
 * 環境變數:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL — SA 的 email
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY — SA 的 private key (JSON escape 後的字串)
 *
 * 注意: SA 需要被加進 Google Drive 資料夾的共用者 (至少 Editor)
 *       SA 需要被加進 Google Sheet 的共用者 (至少 Editor)
 */

function getAuth() {
  // 支援 3 種設定方式：
  // 1. GOOGLE_SERVICE_ACCOUNT_JSON_B64 — 整個 JSON key file 的 base64（最可靠）
  // 2. GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";

  const jsonB64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (jsonB64) {
    try {
      const json = JSON.parse(Buffer.from(jsonB64, "base64").toString("utf8"));
      email = json.client_email;
      key = json.private_key;
    } catch { /* fallback to individual vars */ }
  }

  // Handle escaped \\n
  if (key && !key.includes("\n") && key.includes("\\n")) {
    key = key.replace(/\\n/g, "\n");
  }

  if (!email || !key) {
    throw new Error("Google Service Account 未設定 (需要 GOOGLE_SERVICE_ACCOUNT_JSON_B64 或 EMAIL+KEY)");
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/calendar",
    ],
  });
}

/** 檢查 Google credentials 是否有設定（不 throw） */
export function hasGoogleCredentials(): boolean {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64) return true;
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
}

// ============ Google Drive ============

/**
 * 上傳 Buffer (PDF/Image) 到 Google Drive 指定資料夾
 * @returns { id, webViewLink } — 檔案 ID + 可分享連結
 */
export async function uploadToDrive(opts: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  parentFolderId: string;
}): Promise<{ id: string; webViewLink: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  const { data } = await drive.files.create({
    requestBody: {
      name: opts.fileName,
      parents: [opts.parentFolderId],
    },
    media: {
      mimeType: opts.mimeType,
      body: require("stream").Readable.from(opts.buffer),
    },
    fields: "id,webViewLink",
  });
  return { id: data.id!, webViewLink: data.webViewLink! };
}

/**
 * 在 Google Drive 建立子資料夾
 */
export async function createDriveFolder(name: string, parentId: string) {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const { data } = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });
  return data.id!;
}

/**
 * 找或建指定名稱的子資料夾 (用於年度/季度自動分類)
 */
export async function findOrCreateFolder(name: string, parentId: string) {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const { data } = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  });
  if (data.files && data.files.length > 0) return data.files[0].id!;
  return createDriveFolder(name, parentId);
}

// ============ Google Sheets ============

/**
 * Google Sheet 邀約紀錄表的 ID 和 sheet name
 * 01.業務人員 > 邀約紀錄表(業務)
 */
const RECRUIT_SHEET_ID = "1APzwwNIpoOZfqkxdHKXZqkzYkxpu1a6eQdw56T2tsFw";
const RECRUIT_SHEET_NAME = "邀約紀錄表(業務)";

/**
 * 在邀約紀錄表最後一行新增一筆紀錄
 * 欄位: A=姓名, B=經銷據點/組別, C=負責人, E=履歷表(共用雲端), F=電話, G=邀約日期, H=邀約方式, I=聯繫管道, J=邀約紀錄
 */
export async function appendRecruitRecord(row: {
  name: string;
  branch?: string;
  recruiter: string;
  resumeLink?: string;
  phone?: string;
  inviteDate: string; // YYYY/MM/DD
  inviteMethod: string; // 信件邀約 / 電話邀約
  channel?: string; // 104 等
  jobType?: string; // 業務 / 客服 / 門市
}) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // 欄位: A B C D(hidden) E F G H I J
  const values = [
    [
      row.name,                   // A: 姓名
      row.branch || "",           // B: 經銷據點/組別
      row.recruiter,              // C: 負責人
      "",                         // D: (hidden column)
      row.resumeLink || "",       // E: 履歷表(放共用雲端)
      row.phone || "",            // F: 電話
      row.inviteDate,             // G: 邀約日期
      row.inviteMethod,           // H: 邀約方式
      row.channel || "",          // I: 聯繫管道
      row.jobType || "業務",      // J: 邀約紀錄
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: RECRUIT_SHEET_ID,
    range: `'${RECRUIT_SHEET_NAME}'!A:J`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

// ============ 據點/資料夾 mapping ============

/** Google Drive 資料夾 mapping — 01.業務人員底下的三個城市 */
const CITY_FOLDER_MAP: Record<string, string> = {
  台北: "1oM3mWgchjjTN2K04xZu7MjuHAXQhBJTB",
  台中: "1uwYrS7W_bBqa2QIuQTBR6L43FaEunowx", // 同根目錄
  高雄: "", // TODO: 從 Drive 取得 folder ID
};

/**
 * 根據城市 + 當前季度取得正確的 Google Drive 資料夾 ID
 * 例如: 台北 → 01.業務人員/台北/2026/2026Q2
 */
export async function getResumeFolder(city: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString();
  const quarter = `${year}Q${Math.ceil((now.getMonth() + 1) / 3)}`;

  const cityFolderId = CITY_FOLDER_MAP[city];
  if (!cityFolderId) {
    // Fallback: 用台北
    return CITY_FOLDER_MAP["台北"];
  }

  // 找或建 year folder
  const yearFolderId = await findOrCreateFolder(year, cityFolderId);
  // 找或建 quarter folder
  const quarterFolderId = await findOrCreateFolder(quarter, yearFolderId);
  return quarterFolderId;
}

// ============ 邀約紀錄表 讀取 / 更新 ============

/**
 * 讀取邀約紀錄表，篩選指定聯繫管道（墨凡/睿富）的記錄
 * 回傳含 row index 方便後續更新
 *
 * 欄位對照:
 * A=姓名 B=經銷據點/組別 C=負責人 D=是否撈取 E=履歷表 F=電話
 * G=邀約日期 H=邀約方式 I=聯繫管道 J=邀約紀錄
 * K=一面時間 L=一面主管 M=一面出席狀況 N=面試評估表 O=一面備註
 * P=是否安排二面 Q=二面時間 R=二面主管 S=二面出席狀況 T=是否錄取
 */
export interface RecruitSheetRow {
  rowIndex: number; // 1-based (Excel row number)
  name: string;
  branch: string;
  recruiter: string;
  resumeLink: string;
  phone: string;
  inviteDate: string;
  inviteMethod: string;
  channel: string;
  inviteRecord: string;
  interviewTime: string;
  interviewManager: string;
  attendanceStatus: string;
  interviewNote: string;
  isArrangeSecond: string;
  secondInterviewTime: string;
  secondManager: string;
  secondAttendance: string;
  isHired: string;
  offerDeadline: string;
  arrivalIntent: string;
  arrivalTime: string;
}

export async function readRecruitSheet(opts?: {
  channels?: string[];       // 篩選聯繫管道 e.g. ["墨凡", "睿富"]
  recruiter?: string;        // 篩選負責人
  daysBack?: number;         // 最近 N 天
  noInterviewOnly?: boolean; // 只找還沒有一面時間的
}): Promise<RecruitSheetRow[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: RECRUIT_SHEET_ID,
    range: `'${RECRUIT_SHEET_NAME}'!A:AJ`,
  });

  const rows = data.values || [];
  if (rows.length <= 1) return []; // header only

  const result: RecruitSheetRow[] = [];
  const cutoff = opts?.daysBack
    ? new Date(Date.now() - opts.daysBack * 24 * 3600 * 1000)
    : null;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = r[0] || "";
    if (!name || name.includes("遺留") || name.includes("問號")) continue;

    const channel = r[8] || "";
    const recruiter = r[2] || "";
    const inviteDate = r[6] || "";
    const interviewTime = r[10] || "";

    // 篩選條件
    if (opts?.channels && opts.channels.length > 0) {
      if (!opts.channels.some((c) => channel.includes(c))) continue;
    }
    if (opts?.recruiter && recruiter !== opts.recruiter) continue;
    if (opts?.noInterviewOnly && interviewTime) continue;
    if (cutoff && inviteDate) {
      const d = new Date(inviteDate);
      if (!isNaN(d.getTime()) && d < cutoff) continue;
    }

    result.push({
      rowIndex: i + 1, // 1-based
      name,
      branch: r[1] || "",
      recruiter,
      resumeLink: r[4] || "",
      phone: r[5] || "",
      inviteDate,
      inviteMethod: r[7] || "",
      channel,
      inviteRecord: r[9] || "",
      interviewTime,
      interviewManager: r[11] || "",
      attendanceStatus: r[12] || "",
      interviewNote: r[14] || "",
      isArrangeSecond: r[15] || "",
      secondInterviewTime: r[16] || "",
      secondManager: r[17] || "",
      secondAttendance: r[18] || "",
      isHired: r[19] || "",
      offerDeadline: r[21] || "",
      arrivalIntent: r[24] || "",
      arrivalTime: r[26] || "",
    });
  }

  return result;
}

/**
 * 更新邀約紀錄表指定行的指定欄位
 */
export async function updateRecruitSheetRow(
  rowIndex: number,
  updates: Record<string, string>
) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // 欄位名 → 列字母 mapping
  const colMap: Record<string, string> = {
    name: "A", branch: "B", recruiter: "C", resumeLink: "E", phone: "F",
    inviteDate: "G", inviteMethod: "H", channel: "I", inviteRecord: "J",
    interviewTime: "K", interviewManager: "L", attendanceStatus: "M",
    interviewForm: "N", interviewNote: "O", isArrangeSecond: "P",
    secondInterviewTime: "Q", secondManager: "R", secondAttendance: "S",
    isHired: "T", offerDeadline: "V", arrivalIntent: "Y", arrivalTime: "AA",
  };

  const requests = Object.entries(updates).map(([field, value]) => {
    const col = colMap[field];
    if (!col) return null;
    return {
      range: `'${RECRUIT_SHEET_NAME}'!${col}${rowIndex}`,
      values: [[value]],
    };
  }).filter(Boolean) as Array<{ range: string; values: string[][] }>;

  if (requests.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: RECRUIT_SHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: requests,
    },
  });
}

/**
 * 依照姓名查 sheet row，找不到就加一筆，然後更新指定欄位
 * 用於 104 自動化流程中事後補登 Sheet
 */
export async function findAndUpdateSheetByName(
  name: string,
  phone: string | null | undefined,
  updates: Record<string, string>,
  fallbackNewRow?: Parameters<typeof appendRecruitRecord>[0]
): Promise<{ rowIndex: number; created: boolean }> {
  if (!name) throw new Error("name required");
  const rows = await readRecruitSheet({ daysBack: 90 });
  // 用姓名 + (電話末4碼 or 空) 匹配最近一筆
  const phone4 = (phone || "").replace(/\D/g, "").slice(-4);
  const matched = rows.find((r) => {
    if (r.name.trim() !== name.trim()) return false;
    if (!phone4) return true;
    const rp4 = (r.phone || "").replace(/\D/g, "").slice(-4);
    return !rp4 || rp4 === phone4;
  }) || rows.find((r) => r.name.trim() === name.trim());

  if (matched) {
    await updateRecruitSheetRow(matched.rowIndex, updates);
    return { rowIndex: matched.rowIndex, created: false };
  }
  // 找不到：先 append 新 row（需要 fallback 資料），再 patch
  if (!fallbackNewRow) throw new Error("sheet row not found and no fallback");
  await appendRecruitRecord(fallbackNewRow);
  // 再讀一次找新 row
  const rows2 = await readRecruitSheet({ daysBack: 90 });
  const newRow = rows2.find((r) => r.name.trim() === name.trim());
  if (newRow) {
    await updateRecruitSheetRow(newRow.rowIndex, updates);
    return { rowIndex: newRow.rowIndex, created: true };
  }
  return { rowIndex: -1, created: true };
}

/**
 * 取得 Google Sheet 特定行的連結
 */
export function getSheetRowLink(rowIndex: number): string {
  // gid=0 是第一個 sheet tab，直接跳到指定行
  return `https://docs.google.com/spreadsheets/d/${RECRUIT_SHEET_ID}/edit#gid=0&range=A${rowIndex}`;
}

// ============ Google Calendar ============

/**
 * 建立 Google Calendar 面試事件
 */
export async function createCalendarEvent(opts: {
  calendarId: string;        // 招聘員的 email（或 'primary'）
  candidateName: string;
  location: string;          // 據點名稱
  startTime: string;         // ISO string
  endTime?: string;          // ISO string，預設 startTime + 1 hour
  attendees?: string[];      // 面試主管 email 列表
  description?: string;
}): Promise<{ eventId: string; htmlLink: string }> {
  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const start = new Date(opts.startTime);
  const end = opts.endTime
    ? new Date(opts.endTime)
    : new Date(start.getTime() + 60 * 60 * 1000); // +1hr

  const { data } = await calendar.events.insert({
    calendarId: opts.calendarId,
    requestBody: {
      summary: `面試 — ${opts.candidateName} — ${opts.location}`,
      location: opts.location,
      start: { dateTime: start.toISOString(), timeZone: "Asia/Taipei" },
      end: { dateTime: end.toISOString(), timeZone: "Asia/Taipei" },
      attendees: (opts.attendees || []).map((email) => ({ email })),
      description: opts.description || `面試候選人：${opts.candidateName}`,
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
    },
  });

  return { eventId: data.id!, htmlLink: data.htmlLink! };
}

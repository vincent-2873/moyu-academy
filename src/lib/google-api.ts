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
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY 未設定");
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
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

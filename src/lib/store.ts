// Client-side store using localStorage
// 2026-05-02 Wave 8 cleanup:HR/招募 全砍,移除 recruit CompanyType + sparringRecords (legacy)

export type CompanyType = "sales" | "hq" | "legal";

export interface User {
  email: string;
  password: string;
  name: string;
  brand: string;
  /** "sales" = 業務公司員工 */
  companyType?: CompanyType;
  role?: string;
  joinDate: string;
  /** legacy field, kept for back-compat — no longer drives UI */
  progress: number;
  /** legacy field, kept for back-compat — no longer drives UI */
  completedModules: number[];
  /** legacy field, kept for back-compat */
  quizScores: { moduleId: number; score: number; date: string }[];
  kpiData: {
    date: string;
    calls: number;
    validCalls: number;
    appointments: number;
    closures: number;
  }[];
}

const STORAGE_KEY = "moyu_academy_v2";

export function getUsers(): User[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveUsers(users: User[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const email = sessionStorage.getItem("moyu_current_user");
  if (!email) return null;
  const users = getUsers();
  return users.find((u) => u.email === email) || null;
}

export function setCurrentUser(email: string) {
  // 切換登入者時先清掉所有跟前一個使用者有關的 session/cookie 殘留
  try {
    sessionStorage.removeItem("adminSession");
    // 清 LINE OAuth / 忘記密碼流程 cookie
    document.cookie = "moyu_oauth_session=; Path=/; Max-Age=0";
    document.cookie = "moyu_oauth_state=; Path=/; Max-Age=0";
    document.cookie = "moyu_oauth_nonce=; Path=/; Max-Age=0";
  } catch {}
  sessionStorage.setItem("moyu_current_user", email);
}

export function logout() {
  sessionStorage.removeItem("moyu_current_user");
}

export function registerUser(
  email: string,
  password: string,
  name: string,
  brand: string,
  companyType: CompanyType = "sales"
): { success: boolean; error?: string } {
  const users = getUsers();
  if (users.find((u) => u.email === email)) {
    return { success: false, error: "此信箱已註冊" };
  }
  const newUser: User = {
    email,
    password,
    name,
    brand,
    companyType,
    joinDate: new Date().toISOString(),
    progress: 0,
    completedModules: [],
    quizScores: [],
    kpiData: [],
  };
  users.push(newUser);
  saveUsers(users);
  return { success: true };
}

export function loginUser(
  email: string,
  password: string
): { success: boolean; error?: string } {
  const users = getUsers();
  const user = users.find((u) => u.email === email);
  if (!user) return { success: false, error: "LOCAL_NOT_FOUND" };
  if (user.password !== password) return { success: false, error: "密碼錯誤" };
  setCurrentUser(email);
  return { success: true };
}

/**
 * Restore user from Supabase into localStorage so subsequent logins work.
 * 如果已有本地紀錄：更新雲端欄位 + 設為目前登入者
 * 如果沒有本地紀錄：新建 + 設為目前登入者
 * (舊版 bug：本地已存在時會提早 return 沒呼叫 setCurrentUser，
 *  導致 LINE OAuth 成功回來後 sessionStorage 沒設，永遠卡登入頁)
 */
export function restoreUserFromCloud(
  email: string,
  password: string,
  cloudUser: { name: string; brand: string; role?: string; companyType?: CompanyType }
) {
  const users = getUsers();
  const existingIdx = users.findIndex((u) => u.email === email);
  if (existingIdx >= 0) {
    // 已存在：更新雲端欄位，保留 kpiData / progress 等本地累積的東西
    users[existingIdx] = {
      ...users[existingIdx],
      name: cloudUser.name || users[existingIdx].name,
      brand: cloudUser.brand || users[existingIdx].brand,
      role: cloudUser.role || users[existingIdx].role,
      companyType: cloudUser.companyType || users[existingIdx].companyType || "sales",
    };
  } else {
    // 新建
    users.push({
      email,
      password,
      name: cloudUser.name,
      brand: cloudUser.brand,
      role: cloudUser.role,
      companyType: cloudUser.companyType || "sales",
      joinDate: new Date().toISOString(),
      progress: 0,
      completedModules: [],
      quizScores: [],
      kpiData: [],
    });
  }
  saveUsers(users);
  // 無論新建還舊帳號都要設為目前登入者
  setCurrentUser(email);
}

export function updateUser(email: string, updates: Partial<User>) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.email === email);
  if (idx === -1) return;
  users[idx] = { ...users[idx], ...updates };
  saveUsers(users);
}

export function addKpiEntry(
  email: string,
  entry: User["kpiData"][0]
) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.email === email);
  if (idx === -1) return;
  // Replace if same date exists
  const dateIdx = users[idx].kpiData.findIndex((k) => k.date === entry.date);
  if (dateIdx >= 0) {
    users[idx].kpiData[dateIdx] = entry;
  } else {
    users[idx].kpiData.push(entry);
  }
  saveUsers(users);
}

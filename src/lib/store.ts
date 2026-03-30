// Client-side store using localStorage

export interface User {
  email: string;
  password: string;
  name: string;
  brand: string;
  joinDate: string;
  progress: number;
  completedModules: number[];
  quizScores: { moduleId: number; score: number; date: string }[];
  kpiData: {
    date: string;
    calls: number;
    validCalls: number;
    appointments: number;
    closures: number;
  }[];
  sparringRecords: SparringRecord[];
}

export interface SparringRecord {
  id: string;
  date: string;
  personaId: string;
  personaName: string;
  moduleDay?: number;
  messages: { role: "user" | "assistant"; content: string }[];
  scores: SparringScores;
  feedback: string;
  duration: number; // seconds
}

export interface SparringScores {
  opening: number;
  spinCoverage: number;
  painPointDepth: number;
  solutionMatch: number;
  objectionHandling: number;
  closingPush: number;
  overall: number;
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
  sessionStorage.setItem("moyu_current_user", email);
}

export function logout() {
  sessionStorage.removeItem("moyu_current_user");
}

export function registerUser(
  email: string,
  password: string,
  name: string,
  brand: string
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
    joinDate: new Date().toISOString(),
    progress: 0,
    completedModules: [],
    quizScores: [],
    kpiData: [],
    sparringRecords: [],
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
  if (!user) return { success: false, error: "找不到此帳號" };
  if (user.password !== password) return { success: false, error: "密碼錯誤" };
  setCurrentUser(email);
  return { success: true };
}

export function updateUser(email: string, updates: Partial<User>) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.email === email);
  if (idx === -1) return;
  users[idx] = { ...users[idx], ...updates };
  saveUsers(users);
}

export function addSparringRecord(email: string, record: SparringRecord) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.email === email);
  if (idx === -1) return;
  users[idx].sparringRecords.push(record);
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

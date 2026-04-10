/**
 * Sync layer: bridges localStorage → Supabase
 * Every progress update writes to both localStorage (fast) and Supabase (persistent)
 */

const API_BASE = "";

/** Resolve user email to Supabase user ID (cached) */
const userIdCache: Record<string, string> = {};

async function resolveUserId(email: string): Promise<string | null> {
  if (userIdCache[email]) return userIdCache[email];
  try {
    const res = await fetch(`${API_BASE}/api/user-id?email=${encodeURIComponent(email)}`);
    if (!res.ok) return null;
    const { userId } = await res.json();
    if (userId) userIdCache[email] = userId;
    return userId;
  } catch {
    return null;
  }
}

/** Sync module completion progress to Supabase */
export async function syncProgress(
  email: string,
  completedModules: number[],
  progress: number,
  currentDay: number
): Promise<void> {
  try {
    const userId = await resolveUserId(email);
    if (!userId) return;
    await fetch(`${API_BASE}/api/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, completedModules, progress, currentDay }),
    });
  } catch {
    // Non-blocking: don't break the UI if sync fails
  }
}

/** Sync quiz score to Supabase */
export async function syncQuizScore(
  email: string,
  moduleId: number,
  score: number
): Promise<void> {
  try {
    const userId = await resolveUserId(email);
    if (!userId) return;
    await fetch(`${API_BASE}/api/quiz-scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, moduleId, score }),
    });
  } catch {}
}

/** Sync KPI entry to Supabase */
export async function syncKpiEntry(
  email: string,
  entry: { date: string; calls: number; validCalls: number; appointments: number; closures: number }
): Promise<void> {
  try {
    const userId = await resolveUserId(email);
    if (!userId) return;
    await fetch(`${API_BASE}/api/kpi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...entry }),
    });
  } catch {}
}

/** Sync video watch progress to Supabase */
export async function syncVideoProgress(
  email: string,
  videoId: string,
  watchSeconds: number,
  totalSeconds?: number
): Promise<void> {
  try {
    const userId = await resolveUserId(email);
    if (!userId) return;
    await fetch(`${API_BASE}/api/video-progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, videoId, watchSeconds, totalSeconds }),
    });
  } catch {}
}

/** Register user in Supabase (called during registration) */
export interface SyncRegisterResult {
  userId: string | null;
  error?: string;
  lineBindingRequired?: boolean;
  lineBindingCode?: string;
  lineBindingExpiresAt?: string;
  lineFriendUrl?: string | null;
}

export async function syncRegister(
  email: string,
  name: string,
  brand: string
): Promise<SyncRegisterResult> {
  const MAX_RETRIES = 2;
  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, brand }),
      });
      const data = await res.json();
      if (!res.ok) {
        lastError = data.error || `HTTP ${res.status}`;
        continue;
      }
      const { userId, lineBindingRequired, lineBindingCode, lineBindingExpiresAt, lineFriendUrl } = data;
      if (userId) userIdCache[email] = userId;
      return { userId, lineBindingRequired, lineBindingCode, lineBindingExpiresAt, lineFriendUrl };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Network error";
    }
  }

  return { userId: null, error: lastError || "Supabase 同步失敗，請稍後再試" };
}

/** One-time migration: push all localStorage data to Supabase */
export async function migrateLocalStorageToSupabase(user: {
  email: string;
  name?: string;
  brand?: string;
  completedModules?: number[];
  progress?: number;
  quizScores?: Array<{ moduleId: number; score: number; date: string }>;
  kpiData?: Array<{ date: string; calls: number; validCalls: number; appointments: number; closures: number }>;
}): Promise<void> {
  const SYNC_FLAG = `moyu_synced_v1_${user.email}`;
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SYNC_FLAG)) return;

  try {
    const userId = await resolveUserId(user.email);
    if (!userId) {
      // User doesn't exist in Supabase yet, create them with actual name/brand
      const result = await syncRegister(user.email, user.name || "", user.brand || "");
      if (!result.userId) return; // Can't migrate without a user ID
    }

    // Sync progress
    if (user.completedModules && user.completedModules.length > 0) {
      const currentDay = Math.max(...user.completedModules, 0) + 1;
      await syncProgress(user.email, user.completedModules, user.progress || 0, Math.min(currentDay, 9));
    }

    // Sync quiz scores
    if (user.quizScores) {
      for (const qs of user.quizScores) {
        await syncQuizScore(user.email, qs.moduleId, qs.score);
      }
    }

    // Sync KPI data
    if (user.kpiData) {
      for (const kpi of user.kpiData) {
        await syncKpiEntry(user.email, kpi);
      }
    }

    localStorage.setItem(SYNC_FLAG, new Date().toISOString());
  } catch {
    // Don't block on migration failure
  }
}

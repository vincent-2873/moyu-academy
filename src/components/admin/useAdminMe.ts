"use client";

/**
 * useAdminMe hook — Wave 8 #3
 *
 * 拿 caller 自己的 persona_role + permissions,給 admin 各頁面決定 read-only / 隱藏 button
 *
 * 30 秒 sessionStorage cache 避免每頁 fetch
 */

import { useEffect, useState } from "react";

export interface AdminMePermissions {
  is_human_ops: boolean;
  is_board_audience: boolean;
  can_approve: boolean;
  can_reject: boolean;
  can_manage_people: boolean;
  can_query_board: boolean;
}

export interface AdminMeUser {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  persona_role: string | null;
  brand: string | null;
}

export interface AdminMeData {
  user: AdminMeUser;
  permissions: AdminMePermissions;
}

const CACHE_KEY = "moyu_admin_me_v1";
const CACHE_TTL_MS = 30_000;

const DEFAULT_PERMS: AdminMePermissions = {
  is_human_ops: false,
  is_board_audience: false,
  can_approve: false,
  can_reject: false,
  can_manage_people: false,
  can_query_board: false,
};

export function useAdminMe(): { data: AdminMeData | null; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<AdminMeData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(forceFresh = false) {
    setLoading(true);
    try {
      // 看 cache
      if (!forceFresh) {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const obj = JSON.parse(cached) as { ts: number; data: AdminMeData };
            if (Date.now() - obj.ts < CACHE_TTL_MS) {
              setData(obj.data);
              setLoading(false);
              return;
            }
          } catch { /* ignore */ }
        }
      }

      const r = await fetch("/api/admin/me", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) {
        const payload: AdminMeData = { user: j.user, permissions: j.permissions };
        setData(payload);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: payload }));
        } catch { /* ignore */ }
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return { data, loading, refresh: () => load(true) };
}

/** 給尚未登入或 fetch 失敗的 fallback — 全 false(視為 read-only) */
export function defaultPermissions(): AdminMePermissions {
  return DEFAULT_PERMS;
}

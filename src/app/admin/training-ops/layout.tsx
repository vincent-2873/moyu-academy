"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

interface AdminSession {
  name: string;
  email: string;
  token: string;
}

const SUB_TABS = [
  { id: "students",  label: "訓練生戰況", icon: "📚" },
  { id: "attention", label: "需介入清單", icon: "🚨" },
  { id: "materials", label: "教材管理",   icon: "📖" },
  { id: "report",    label: "成效報告",   icon: "📊" },
] as const;

export default function TrainingOpsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("adminSession");
    if (!saved) {
      router.replace("/admin");
      return;
    }
    try {
      const parsed: AdminSession = JSON.parse(saved);
      setSession(parsed);
      setAuthChecked(true);
    } catch {
      router.replace("/admin");
    }
  }, [router]);

  if (!authChecked) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", color: "var(--text3)", fontSize: 13,
      }}>
        驗證中…
      </div>
    );
  }

  const activeTabId = SUB_TABS.find(t => pathname.includes(`/${t.id}`))?.id ?? "students";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <aside style={{
        width: 240,
        borderRight: "1px solid var(--border)",
        padding: 24,
        background: "var(--card)",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}>
        <div style={{ marginBottom: 28 }}>
          <Link href="/admin" style={{
            fontSize: 11, color: "var(--text3)", textDecoration: "none",
            display: "inline-block", padding: "4px 0",
          }}>
            ← 主控台
          </Link>
          <h1 style={{
            fontSize: 18, fontWeight: 600,
            color: "var(--text)",
            margin: "8px 0 4px",
            fontFamily: '"Noto Serif TC", serif',
          }}>
            訓練營運中心
          </h1>
          <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: "0.1em" }}>
            v2 · MOYU OPS
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {SUB_TABS.map(t => {
            const isActive = activeTabId === t.id;
            return (
              <Link
                key={t.id}
                href={`/admin/training-ops/${t.id}`}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px",
                  borderRadius: 8,
                  color: isActive ? "var(--accent)" : "var(--text2)",
                  background: isActive ? "var(--card2)" : "transparent",
                  border: isActive ? "1px solid var(--border)" : "1px solid transparent",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: "none",
                  transition: "background 150ms, color 150ms, border 150ms",
                }}
              >
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                {t.label}
              </Link>
            );
          })}
        </nav>

        {session && (
          <div style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            fontSize: 11,
            color: "var(--text3)",
            lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 500, color: "var(--text2)", marginBottom: 2 }}>
              {session.name}
            </div>
            <div style={{ wordBreak: "break-all" }}>{session.email}</div>
          </div>
        )}
      </aside>

      <main style={{
        flex: 1,
        padding: "32px 48px",
        maxWidth: 1200,
      }}>
        {children}
      </main>
    </div>
  );
}

import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";

export const metadata = { title: "HRBP 核心方法論 · 速查手冊" };
export const dynamic = "force-dynamic";

async function loadMethods(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "content/training/hrbp_series/HRBP_CORE_METHODS.md"),
    path.resolve(process.cwd(), "content/HRBP_CORE_METHODS.md"),
  ];
  for (const p of candidates) {
    try {
      return await fs.readFile(p, "utf8");
    } catch {
      // try next
    }
  }
  return "# 速查手冊尚未同步\n\n找不到 `content/training/hrbp_series/HRBP_CORE_METHODS.md`。";
}

export default async function MethodsPage() {
  const md = await loadMethods();
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px" }}>
      <nav style={{ fontSize: 14, marginBottom: 16 }}>
        <Link href="/training" style={{ color: "#6B7280", textDecoration: "none" }}>
          ← 新訓區域
        </Link>
      </nav>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          fontFamily: '-apple-system, "Segoe UI", "Noto Sans TC", sans-serif',
          fontSize: 15,
          lineHeight: 1.8,
          color: "#111827",
        }}
      >
        {md}
      </pre>
    </main>
  );
}

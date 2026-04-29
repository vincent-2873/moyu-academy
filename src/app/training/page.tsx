import Link from "next/link";
import { Card } from "@/components/wabi/Card";
import { KintsugiDivider } from "@/components/wabi/KintsugiDivider";
import { Stamp } from "@/components/wabi/Stamp";

export const metadata = { title: "新訓區域 · 墨宇學院" };

const series = [
  {
    id: "hrbp",
    title: "HRBP 招募訓練系列",
    subtitle: "新進 HRBP 入職 14 天內的核心能力訓練",
    units: 4,
    totalMinutes: 55,
    prerequisite: "HR-051 公司與品牌故事 · HR-052 電訪話術基礎",
    href: "/training/hrbp",
  },
];

export default function TrainingHomePage() {
  return (
    <main className="mx-auto max-w-[960px] px-5 py-8 bg-paper text-ink">
      <header className="mb-8">
        <div className="text-xs tracking-[0.2em] text-clay font-semibold font-mono">
          MOYU · TRAINING
        </div>
        <h1 className="text-3xl font-serif text-ink font-bold mt-1.5 leading-tight">
          新訓區域
        </h1>
        <p className="text-ink-2 mt-2 leading-relaxed">
          新進同仁的核心能力訓練系列。按系列順序學習,每集完成互動測驗解鎖下一集。
        </p>
        <div className="mt-4">
          <KintsugiDivider />
        </div>
      </header>

      <section className="grid gap-4">
        {series.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className="block no-underline text-inherit transition-colors duration-300"
          >
            <Card variant="paper" padding="md" className="hover:bg-paper-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-serif text-ink font-bold text-xl">{s.title}</div>
                  <div className="text-ink-2 mt-1 text-sm">{s.subtitle}</div>
                  <div className="mt-3 flex gap-4 text-sm text-ink-2 font-mono">
                    <span>{s.units} 集</span>
                    <span>約 {s.totalMinutes} 分鐘</span>
                  </div>
                  <div className="mt-2 text-xs text-ink-3 leading-relaxed">
                    前置：{s.prerequisite}
                  </div>
                </div>
                <Stamp text="進" size={48} variant="gold" />
              </div>
            </Card>
          </Link>
        ))}
      </section>

      <footer className="mt-12 pt-6">
        <KintsugiDivider />
        <Link
          href="/training/methods"
          className="mt-4 inline-block font-serif text-ink no-underline hover:text-clay transition-colors"
        >
          HRBP 核心方法論 · 速查手冊 →
        </Link>
      </footer>
    </main>
  );
}

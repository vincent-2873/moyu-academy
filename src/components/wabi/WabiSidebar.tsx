import Link from "next/link";
import { ReactNode } from "react";
import { MoyuLogo } from "@/components/wabi/MoyuLogo";
import { cn } from "@/lib/utils";

export interface SidebarItem {
  label: string;
  href: string;
  /** 用 lucide-react 線條 icon(stroke 1.5);傳 ReactNode 給彈性 */
  icon?: ReactNode;
}

interface SidebarProps {
  items?: SidebarItem[];
  /** 當前 active 路徑(用前綴比對)*/
  pathname?: string;
  /** footer:Vincent 頭像 + email */
  footer?: ReactNode;
  className?: string;
}

/**
 * Sidebar(設計系統 v0.1 §2.5 + Sprint 1 §2.1 layout)
 *
 * 寬 240px(桌機),手機 < 1024 隱藏(這個 component 不處理開合,父層用 RWD class 控制)。
 * Logo 最上;active 項用 ink 顏色 + 左側 2px gold 直條;不要 emoji icon。
 *
 * Sprint 1 minimum:1 個 link(`/admin/training/today`)。Wave 2-5 漸進加。
 */
export function Sidebar({
  items = [{ label: "今日推送", href: "/admin/training/today" }],
  pathname,
  footer,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col w-60 h-screen sticky top-0",
        "bg-paper border-r border-paper-3",
        className,
      )}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-paper-3">
        <Link href="/admin" aria-label="墨宇集團 首頁">
          <MoyuLogo variant="horizontal" size={28} />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map((item) => {
          const isActive = pathname?.startsWith(item.href) ?? false;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm",
                isActive
                  ? "text-ink font-medium"
                  : "text-ink-2 hover:bg-paper-2 hover:text-ink",
              )}
            >
              {/* active 左側 gold 直條 */}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-gold rounded-r-sm"
                />
              )}
              {item.icon && (
                <span aria-hidden className="text-ink-3 shrink-0">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer(帳號)*/}
      {footer && (
        <div className="px-3 py-4 border-t border-paper-3">{footer}</div>
      )}
    </aside>
  );
}

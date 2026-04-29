import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  /** 麵包屑 / 頁標題(serif)*/
  breadcrumb?: ReactNode;
  /** 右側區(帳號 dropdown / 通知)*/
  rightSlot?: ReactNode;
  className?: string;
}

/**
 * TopBar(設計系統 v0.1 §2.5 + Sprint 1 §2.1 layout)
 *
 * 56px / paper-2 底 / 左邊麵包屑(serif) / 右邊帳號 + 通知
 */
export function TopBar({ breadcrumb, rightSlot, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-14 bg-paper-2 border-b border-paper-3",
        "flex items-center justify-between px-4 md:px-6",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="font-serif text-ink text-base md:text-lg leading-tight">
          {breadcrumb}
        </div>
      </div>
      <div className="flex items-center gap-2">{rightSlot}</div>
    </header>
  );
}

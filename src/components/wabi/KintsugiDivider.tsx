import { cn } from "@/lib/utils";

interface KintsugiDividerProps {
  className?: string;
  /** false = 直接顯示已展開狀態(無進場動畫)。預設 true(0.8s 從左到右展開)。*/
  animate?: boolean;
}

/**
 * 金繕線分隔器(設計系統 v0.1 §1.4 b)
 *
 * 1px 漸層線:paper-3(底)+ 中間 5% 區段為 gold(模擬陶器金繕修補)。
 * 進場時 scaleX 0 → 1(0.8s),用於頁面區塊分隔,**不要替代 1px solid 用在卡片邊界**。
 */
export function KintsugiDivider({
  className,
  animate = true,
}: KintsugiDividerProps) {
  return (
    <div
      role="separator"
      aria-hidden
      className={cn("h-px w-full", animate && "kintsugi-draw", className)}
      style={{
        background:
          "linear-gradient(90deg, var(--color-paper-3) 0%, var(--color-paper-3) 30%, var(--color-gold) 30%, var(--color-gold) 35%, var(--color-paper-3) 35%, var(--color-paper-3) 100%)",
      }}
    />
  );
}

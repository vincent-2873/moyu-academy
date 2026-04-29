import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 底色:paper(主)/ paper-2(次,例如「已送」狀態)*/
  variant?: "paper" | "paper-2";
  padding?: "sm" | "md" | "lg";
}

/**
 * Card(設計系統 v0.1 §1.3 + 附錄 A.2)
 *
 * paper 底 + paper-3 邊框 + 微 paper shadow(outline + 1px 邊,**不浮起**)。
 * 不要做的事(設計系統附錄 B):
 *  - hover scale / elevation / glassmorphism / gradient
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "paper", padding = "md", className, children, ...props }, ref) => {
    const bgCls = variant === "paper-2" ? "bg-paper-2" : "bg-paper";

    const padCls =
      padding === "sm"
        ? "p-4 md:p-5"
        : padding === "md"
          ? "p-5 md:p-6"
          : "p-6 md:p-8";

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-md border border-paper-3 shadow-paper transition-colors duration-300",
          bgCls,
          padCls,
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";

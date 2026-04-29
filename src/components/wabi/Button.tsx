import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

/**
 * Button(設計系統 v0.1 §1.4 d + 附錄 A.1)
 *
 * variants:
 *  - primary:墨色填充,hover「墨水滲入」(.btn-ink-fill in globals.css)— 全頁焦點唯一
 *  - secondary:paper 底,hover 加深邊框
 *  - ghost:無邊框,hover 顯示底色
 *
 * 不要做的事(設計系統附錄 B):
 *  - 不漸層、不 scale、不光暈、不浮起
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className, children, ...props }, ref) => {
    const variantCls =
      variant === "primary"
        ? "bg-paper-2 text-ink border border-ink hover:text-paper btn-ink-fill"
        : variant === "secondary"
          ? "bg-paper text-ink border border-paper-3 hover:border-ink-2"
          : "bg-transparent text-ink-2 border border-transparent hover:bg-paper-2";

    const sizeCls =
      size === "sm"
        ? "px-3 py-1.5 text-sm"
        : size === "md"
          ? "px-6 py-3 text-base"
          : "px-8 py-4 text-lg";

    return (
      <button
        ref={ref}
        className={cn(
          "rounded-md font-medium transition-all duration-300",
          "focus:outline-none focus:ring-2 focus:ring-ink/20",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          variantCls,
          sizeCls,
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

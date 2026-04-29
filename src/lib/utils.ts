import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合併 Tailwind class names,自動 dedupe 衝突的 utility class。
 * 給 ui/layout 元件用。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "墨宇戰情中樞 | MOYU OPS",
  description: "業務戰力 × 招聘漏斗 即時監測系統",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}

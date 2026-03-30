import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "墨宇學院 2.0 | MOYU Academy",
  description: "AI 驅動的業務培訓與對練系統",
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

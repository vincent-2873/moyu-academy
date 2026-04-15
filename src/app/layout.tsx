import type { Metadata } from "next";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "墨宇戰情中樞 | MOYU OPS",
  description: "業務戰力 × 招聘漏斗 即時監測系統",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

// 在 hydration 前先套用主題，避免閃爍
const themeInitScript = `
(function(){try{
  var k='moyu-theme';
  var s=localStorage.getItem(k);
  var t=(s==='dark'||s==='light')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  document.documentElement.setAttribute('data-theme',t);
}catch(e){}})();
`.trim();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}

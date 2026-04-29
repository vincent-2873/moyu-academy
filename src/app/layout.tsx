import type { Metadata } from "next";
import {
  Inter,
  Noto_Sans_TC,
  Source_Serif_4,
  Noto_Serif_TC,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * 字型載入(設計系統 v0.1 §1.2 — 從 huance-copilot-app port，2026-04-29 中段轉向)
 * 5 family，全用 next/font/google，display:swap + subset
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  variable: "--font-noto-sans-tc",
  display: "swap",
  weight: ["400", "500", "700"],
});
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});
const notoSerifTC = Noto_Serif_TC({
  subsets: ["latin"],
  variable: "--font-noto-serif-tc",
  display: "swap",
  weight: ["400", "700"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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
    <html
      lang="zh-TW"
      suppressHydrationWarning
      className={`${inter.variable} ${notoSansTC.variable} ${sourceSerif.variable} ${notoSerifTC.variable} ${jetbrainsMono.variable}`}
    >
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

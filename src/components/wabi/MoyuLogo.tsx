interface MoyuLogoProps {
  /** 預設 32 px(高度;horizontal 變體寬約 3.5x)*/
  size?: number;
  /** 排版方向 */
  variant?: "horizontal" | "stacked";
  /** 是否顯示朱紅落款印章(寰)*/
  showStamp?: boolean;
  className?: string;
}

/**
 * MoyuLogo(設計系統 v0.1 附錄 C.1)
 *
 * 「墨宇」兩字 SVG,用 Noto Serif TC font weight 700 模擬書法質感,
 * 可選右上加朱紅落款「寰」。Wave 5 之前若 Vincent 找到書法家手寫版,直接替換 SVG path 即可。
 *
 * 用途:
 *  - Sidebar 頂部:`<MoyuLogo variant="horizontal" size={32} />`
 *  - 登入頁中央:`<MoyuLogo variant="stacked" size={64} showStamp />`
 *  - Discord bot avatar:export PNG 256×256(showStamp = true)
 */
export function MoyuLogo({
  size = 32,
  variant = "horizontal",
  showStamp = false,
  className,
}: MoyuLogoProps) {
  const isHorizontal = variant === "horizontal";

  return (
    <svg
      width={isHorizontal ? size * 3.5 : size}
      height={isHorizontal ? size : size * 1.5}
      viewBox={isHorizontal ? "0 0 112 32" : "0 0 32 48"}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="墨宇集團"
      role="img"
    >
      {/* 「墨宇」主字 */}
      <text
        x={isHorizontal ? 4 : 16}
        y={isHorizontal ? 24 : 22}
        textAnchor={isHorizontal ? "start" : "middle"}
        fontFamily="var(--font-noto-serif-tc), serif"
        fontSize="22"
        fontWeight="700"
        fill="var(--color-ink)"
        letterSpacing={isHorizontal ? "4" : "0"}
      >
        墨宇
      </text>

      {/* 「集團」副字(只 horizontal 顯示)*/}
      {isHorizontal && (
        <text
          x="68"
          y="22"
          fontFamily="var(--font-noto-serif-tc), serif"
          fontSize="14"
          fontWeight="400"
          fill="var(--color-ink-2)"
          letterSpacing="2"
        >
          集團
        </text>
      )}

      {/* 落款朱紅章(showStamp = true 時顯示)*/}
      {showStamp && (
        <g
          transform={
            isHorizontal
              ? "translate(98, 4) rotate(-6)"
              : "translate(20, 36) rotate(-6)"
          }
        >
          <rect width="10" height="10" fill="var(--color-stamp-red)" rx="1" />
          <text
            x="5"
            y="8.5"
            textAnchor="middle"
            fill="var(--color-paper)"
            fontSize="6"
            fontWeight="700"
            fontFamily="var(--font-noto-serif-tc), serif"
          >
            寰
          </text>
        </g>
      )}
    </svg>
  );
}

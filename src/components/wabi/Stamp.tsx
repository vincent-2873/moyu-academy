interface StampProps {
  /** 1-4 字最佳(例:「已送」「達標」「30 萬」)*/
  text: string;
  /** 預設 64px */
  size?: number;
  /** 預設 -8 度(微旋,落款感)*/
  rotation?: number;
  /** 預設 red(朱紅,只此一處用紅);gray = 已修;gold = 達標 */
  variant?: "red" | "gray" | "gold";
  className?: string;
}

const VARIANTS = {
  red:  { fill: "var(--color-stamp-red)",        stroke: "var(--color-stamp-red-stroke)" },
  gray: { fill: "var(--color-ink-3)",            stroke: "var(--color-ink-2)" },
  gold: { fill: "var(--color-gold)",             stroke: "#8E7548" },
};

/**
 * Stamp(設計系統 v0.1 §1.4 c + 附錄 A.4)
 *
 * SVG 朱紅圓章(日式落款風),用於:
 *  - 業訓推送發送後「已送」(red)
 *  - 北極星達成「達標」/「30 萬」(gold)
 *  - 編輯過的訊息「已修」(gray)
 *
 * 進場動畫由父層 .training-card[data-state="stamping"] 控制(globals.css)。
 */
export function Stamp({
  text,
  size = 64,
  rotation = -8,
  variant = "red",
  className,
}: StampProps) {
  const colors = VARIANTS[variant];
  const fontSize = text.length <= 2 ? 22 : 16;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ transform: `rotate(${rotation}deg)` }}
      className={`stamp inline-block ${className ?? ""}`}
      aria-label={text}
      role="img"
    >
      <circle cx="32" cy="32" r="28" fill={colors.fill} stroke={colors.stroke} strokeWidth="2" />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fill="var(--color-paper)"
        fontSize={fontSize}
        fontFamily="var(--font-noto-serif-tc), serif"
        fontWeight="700"
      >
        {text}
      </text>
    </svg>
  );
}

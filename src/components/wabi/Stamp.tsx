interface StampProps {
  /** 1-4 字最佳(例:「已送」「達標」「30 萬」)*/
  text: string;
  /** 預設 64px */
  size?: number;
  /** 預設 -8 度(微旋,落款感)*/
  rotation?: number;
  /** 預設 red(朱紅,只此一處用紅);gray = 已修;gold = 達標 */
  variant?: "red" | "gray" | "gold";
  /** 訓練系統印章稀有度: common(灰)/ rare(朱)/ epic(朱+雙環)/ legendary(金+雙環+尺寸) */
  rarity?: "common" | "rare" | "epic" | "legendary";
  className?: string;
}

const VARIANTS = {
  red:  { fill: "var(--color-stamp-red, #b91c1c)",        stroke: "var(--color-stamp-red-stroke, #8e1414)" },
  gray: { fill: "var(--color-ink-3, #4a4a4a)",            stroke: "var(--color-ink-2, #1a1a1a)" },
  gold: { fill: "var(--color-gold, #c9a96e)",             stroke: "#8E7548" },
};

const RARITY_VARIANT: Record<NonNullable<StampProps["rarity"]>, "red" | "gray" | "gold"> = {
  common: "gray",
  rare: "red",
  epic: "red",
  legendary: "gold",
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
  variant,
  rarity,
  className,
}: StampProps) {
  // rarity 優先(訓練系統用),否則用 variant
  const finalVariant = rarity ? RARITY_VARIANT[rarity] : (variant || "red");
  const colors = VARIANTS[finalVariant];
  const fontSize = text.length <= 2 ? 22 : text.length <= 4 ? 14 : 10;
  const finalSize = rarity === "legendary" ? size * 1.3 : size;
  const showDoubleRing = rarity === "epic" || rarity === "legendary";

  return (
    <svg
      width={finalSize}
      height={finalSize}
      viewBox="0 0 64 64"
      style={{ transform: `rotate(${rotation}deg)` }}
      className={`stamp inline-block ${className ?? ""}`}
      aria-label={text}
      role="img"
    >
      {/* 外圈(epic / legendary 才顯示)*/}
      {showDoubleRing && (
        <circle cx="32" cy="32" r="30" fill="none" stroke={colors.stroke} strokeWidth="0.8" opacity="0.7" />
      )}
      {/* 主章 */}
      <circle cx="32" cy="32" r="28" fill={colors.fill} stroke={colors.stroke} strokeWidth="2" />
      {/* 篆刻紋路(epic / legendary)*/}
      {showDoubleRing && (
        <circle cx="32" cy="32" r="25" fill="none" stroke="var(--color-paper, #f7f1e3)" strokeWidth="0.5" opacity="0.4" />
      )}
      <text
        x="32"
        y={text.length <= 2 ? 38 : text.length <= 4 ? 36 : 35}
        textAnchor="middle"
        fill="var(--color-paper, #f7f1e3)"
        fontSize={fontSize}
        fontFamily="var(--font-noto-serif-tc), serif"
        fontWeight="700"
      >
        {text.length <= 4 ? text : text.slice(0, 4)}
      </text>
      {/* legendary 多一行 */}
      {rarity === "legendary" && text.length > 4 && (
        <text
          x="32"
          y="46"
          textAnchor="middle"
          fill="var(--color-paper, #f7f1e3)"
          fontSize="8"
          fontFamily="var(--font-noto-serif-tc), serif"
          fontWeight="700"
        >
          {text.slice(4, 10)}
        </text>
      )}
    </svg>
  );
}

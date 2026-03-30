"use client";

import { SCORE_LABELS, getScoreColor } from "@/lib/scoring";
import type { SparringScores } from "@/lib/store";

interface ScoreRadarProps {
  scores: SparringScores;
  size?: number;
}

export default function ScoreRadar({ scores, size = 240 }: ScoreRadarProps) {
  const dimensions = Object.entries(SCORE_LABELS).filter(
    ([key]) => key !== "overall"
  ) as [keyof SparringScores, string][];

  const center = size / 2;
  const radius = size / 2 - 30;

  const points = dimensions.map(([key], i) => {
    const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
    const value = scores[key] / 100;
    return {
      x: center + radius * value * Math.cos(angle),
      y: center + radius * value * Math.sin(angle),
      labelX: center + (radius + 20) * Math.cos(angle),
      labelY: center + (radius + 20) * Math.sin(angle),
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Grid lines
  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid */}
        {gridLevels.map((level) => {
          const gridPoints = dimensions
            .map((_dim, i) => {
              const angle =
                (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
              return `${center + radius * level * Math.cos(angle)},${center + radius * level * Math.sin(angle)}`;
            })
            .join(" ");
          return (
            <polygon
              key={level}
              points={gridPoints}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
              opacity={0.5}
            />
          );
        })}

        {/* Axes */}
        {dimensions.map((_dim, i) => {
          const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={center + radius * Math.cos(angle)}
              y2={center + radius * Math.sin(angle)}
              stroke="var(--border)"
              strokeWidth="1"
              opacity={0.3}
            />
          );
        })}

        {/* Score area */}
        <polygon
          points={polygonPoints}
          fill={`${getScoreColor(scores.overall)}20`}
          stroke={getScoreColor(scores.overall)}
          strokeWidth="2"
        />

        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill={getScoreColor(scores[dimensions[i][0]])}
          />
        ))}

        {/* Labels */}
        {dimensions.map(([key, label], i) => (
          <text
            key={key}
            x={points[i].labelX}
            y={points[i].labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text2)"
            fontSize="11"
          >
            {label}
          </text>
        ))}
      </svg>

      {/* Score details */}
      <div className="grid grid-cols-3 gap-2 w-full">
        {dimensions.map(([key, label]) => (
          <div
            key={key}
            className="bg-[var(--card)] rounded-lg p-2 text-center"
          >
            <div className="text-[10px] text-[var(--text3)]">{label}</div>
            <div
              className="text-lg font-bold"
              style={{ color: getScoreColor(scores[key]) }}
            >
              {scores[key]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

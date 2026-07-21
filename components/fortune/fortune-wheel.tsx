"use client";

import type { CSSProperties } from "react";

import type { FortuneSegment } from "@/lib/fortune/data";
import styles from "./fortune.module.css";

function point(center: number, radius: number, angleDegrees: number) {
  const angle = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
}

function wedgePath(index: number, count: number) {
  const center = 250;
  const radius = 225;
  const step = 360 / count;
  const start = index * step;
  const end = start + step;
  const a = point(center, radius, start);
  const b = point(center, radius, end);
  return `M ${center} ${center} L ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${b.x} ${b.y} Z`;
}

function lines(label: string) {
  if (label.length <= 12) return [label];
  const words = label.split(/\s+/);
  if (words.length > 1) {
    const middle = Math.ceil(words.length / 2);
    return [words.slice(0, middle).join(" "), words.slice(middle).join(" ")];
  }
  return [label.slice(0, 10), label.slice(10, 20)];
}

export function FortuneWheel({
  segments,
  rotation,
  spinning = false,
  transitionMs = 3600,
  compact = false,
  selectedSegmentId = null,
  onSegmentClick,
}: {
  segments: FortuneSegment[];
  rotation: number;
  spinning?: boolean;
  transitionMs?: number;
  compact?: boolean;
  selectedSegmentId?: number | null;
  onSegmentClick?: (segment: FortuneSegment) => void;
}) {
  const active = segments.filter((segment) => segment.active);
  if (active.length === 0) {
    return <div className={styles.wheelEmpty}>Aucune case active sur cette roue.</div>;
  }
  const step = 360 / active.length;

  return (
    <div className={`${styles.wheelStage} ${compact ? styles.wheelStageCompact : ""}`}>
      <span className={styles.wheelPointer}>▼</span>
      <svg
        viewBox="0 0 500 500"
        className={`${styles.wheelSvg} ${spinning ? styles.wheelSpinning : ""}`}
        style={{
          "--fortune-rotation": `${rotation}deg`,
          "--fortune-duration": `${Math.max(0, transitionMs)}ms`,
        } as CSSProperties}
        aria-label="Roue de la Fortune"
      >
        {active.map((segment, index) => {
          const middleAngle = index * step + step / 2;
          const labelPosition = point(250, compact ? 138 : 151, middleAngle);
          const selected = selectedSegmentId === segment.id;
          return (
            <g
              key={segment.id}
              className={onSegmentClick ? styles.editableSegment : undefined}
              onClick={() => onSegmentClick?.(segment)}
              role={onSegmentClick ? "button" : undefined}
              tabIndex={onSegmentClick ? 0 : undefined}
              onKeyDown={(event) => {
                if (onSegmentClick && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onSegmentClick(segment);
                }
              }}
            >
              <path
                d={wedgePath(index, active.length)}
                fill={segment.color}
                stroke={selected ? "#fff" : "rgba(8,8,8,.72)"}
                strokeWidth={selected ? 7 : 3}
              />
              <text
                x={labelPosition.x}
                y={labelPosition.y}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${middleAngle}, ${labelPosition.x}, ${labelPosition.y})`}
                className={styles.wheelText}
              >
                {lines(segment.label).map((line, lineIndex) => (
                  <tspan
                    key={`${segment.id}-${lineIndex}`}
                    x={labelPosition.x}
                    dy={lineIndex === 0 ? "-0.35em" : "1.15em"}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        <circle cx="250" cy="250" r={compact ? 58 : 67} className={styles.wheelCenter} />
        <text x="250" y="244" textAnchor="middle" className={styles.wheelCenterTitle}>NOSTRA</text>
        <text x="250" y="270" textAnchor="middle" className={styles.wheelCenterSubtitle}>FORTUNE</text>
      </svg>
    </div>
  );
}

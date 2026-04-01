"use client";

import { useState } from "react";

interface CeremonyOverlayProps {
  mentorName: string;
  traineeName: string;
  managerName?: string;
  brandName: string;
  startDate: string;
  welcomeMessage?: string;
  onComplete: () => void;
}

export default function CeremonyOverlay({
  mentorName,
  traineeName,
  managerName,
  brandName,
  startDate,
  welcomeMessage,
  onComplete,
}: CeremonyOverlayProps) {
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = () => {
    setDismissing(true);
    setTimeout(() => {
      onComplete();
    }, 600);
  };

  // Build content lines with stagger delays
  const contentLines: { label: string; value: string; delay: number }[] = [];
  let lineIndex = 0;

  if (managerName) {
    contentLines.push({ label: "據點主管", value: managerName, delay: 1.6 + lineIndex * 0.3 });
    lineIndex++;
  }
  contentLines.push({ label: "師\u3000\u3000父", value: mentorName, delay: 1.6 + lineIndex * 0.3 });
  lineIndex++;
  contentLines.push({ label: "入門弟子", value: traineeName, delay: 1.6 + lineIndex * 0.3 });
  lineIndex++;

  const divider1Delay = 1.6 + lineIndex * 0.3;
  lineIndex++;

  contentLines.push({ label: "品\u3000\u3000牌", value: brandName, delay: 1.6 + lineIndex * 0.3 });
  lineIndex++;
  contentLines.push({ label: "入門日期", value: startDate, delay: 1.6 + lineIndex * 0.3 });
  lineIndex++;

  const divider2Delay = 1.6 + lineIndex * 0.3;
  lineIndex++;

  const messageDelay = welcomeMessage ? 1.6 + lineIndex * 0.3 : 0;
  if (welcomeMessage) lineIndex++;

  const stampDelay = 1.6 + lineIndex * 0.3;
  lineIndex++;
  const buttonDelay = stampDelay + 0.5;

  return (
    <>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes typewriter {
          from {
            clip-path: inset(0 100% 0 0);
          }
          to {
            clip-path: inset(0 0 0 0);
          }
        }

        @keyframes stampIn {
          0% {
            opacity: 0;
            transform: scale(1.5) rotate(-15deg);
          }
          60% {
            opacity: 1;
            transform: scale(0.95) rotate(0deg);
          }
          80% {
            transform: scale(1.05) rotate(1deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          to {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.85);
          }
        }

        @keyframes backdropFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes lineReveal {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          zIndex: 50,
          animation: dismissing
            ? "backdropFadeOut 0.6s ease-out forwards"
            : "fadeIn 0.5s ease-out forwards",
        }}
      />

      {/* Certificate Card */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 51,
          width: "90%",
          maxWidth: "28rem",
          background: "linear-gradient(170deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)",
          border: "4px double var(--gold, #d4a853)",
          borderRadius: "0.5rem",
          padding: "2.5rem 2rem 2rem",
          boxShadow: "0 0 60px rgba(212, 168, 83, 0.15), inset 0 0 30px rgba(0,0,0,0.3)",
          animation: dismissing
            ? "fadeOut 0.6s ease-out forwards"
            : "scaleIn 0.8s ease-out forwards",
          overflow: "hidden",
        }}
      >
        {/* Corner ornaments */}
        {["top-left", "top-right", "bottom-left", "bottom-right"].map((corner) => {
          const isTop = corner.includes("top");
          const isLeft = corner.includes("left");
          return (
            <div
              key={corner}
              style={{
                position: "absolute",
                [isTop ? "top" : "bottom"]: 8,
                [isLeft ? "left" : "right"]: 8,
                width: 20,
                height: 20,
                borderTop: isTop ? "2px solid var(--gold, #d4a853)" : "none",
                borderBottom: !isTop ? "2px solid var(--gold, #d4a853)" : "none",
                borderLeft: isLeft ? "2px solid var(--gold, #d4a853)" : "none",
                borderRight: !isLeft ? "2px solid var(--gold, #d4a853)" : "none",
                opacity: 0.5,
              }}
            />
          );
        })}

        {/* Title */}
        <h1
          style={{
            textAlign: "center",
            fontSize: "2rem",
            fontWeight: 700,
            color: "var(--gold, #d4a853)",
            letterSpacing: "0.5em",
            marginBottom: "2rem",
            paddingRight: "-0.5em",
            animation: "typewriter 1s steps(3) 0.8s both",
            fontFamily: "'Noto Serif TC', 'Noto Serif SC', serif",
          }}
        >
          拜師帖
        </h1>

        {/* Content lines */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {contentLines.slice(0, managerName ? 3 : 2).map((line, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "1rem",
                fontSize: "0.9375rem",
                animation: `lineReveal 0.5s ease-out ${line.delay}s both`,
              }}
            >
              <span style={{ color: "var(--text3, #888)", minWidth: "4.5em", textAlign: "right" }}>
                {line.label}：
              </span>
              <span style={{ color: "var(--text, #eee)", fontWeight: 500, minWidth: "5em" }}>
                {line.value}
              </span>
            </div>
          ))}

          {/* Divider 1 */}
          <div
            style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, var(--gold, #d4a853)40, transparent)",
              margin: "0.25rem 2rem",
              animation: `lineReveal 0.5s ease-out ${divider1Delay}s both`,
            }}
          />

          {contentLines.slice(managerName ? 3 : 2).map((line, i) => (
            <div
              key={`b${i}`}
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "1rem",
                fontSize: "0.9375rem",
                animation: `lineReveal 0.5s ease-out ${line.delay}s both`,
              }}
            >
              <span style={{ color: "var(--text3, #888)", minWidth: "4.5em", textAlign: "right" }}>
                {line.label}：
              </span>
              <span style={{ color: "var(--text, #eee)", fontWeight: 500, minWidth: "5em" }}>
                {line.value}
              </span>
            </div>
          ))}

          {/* Divider 2 */}
          <div
            style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, var(--gold, #d4a853)40, transparent)",
              margin: "0.25rem 2rem",
              animation: `lineReveal 0.5s ease-out ${divider2Delay}s both`,
            }}
          />

          {/* Welcome message */}
          {welcomeMessage && (
            <div
              style={{
                textAlign: "center",
                fontSize: "0.8125rem",
                color: "var(--text2, #aaa)",
                fontStyle: "italic",
                padding: "0.5rem 1rem",
                lineHeight: 1.6,
                animation: `lineReveal 0.5s ease-out ${messageDelay}s both`,
              }}
            >
              &ldquo;{welcomeMessage}&rdquo;
            </div>
          )}
        </div>

        {/* Seal / Stamp */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "3px solid var(--red, #e53e3e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: `stampIn 0.6s ease-out ${stampDelay}s both`,
            opacity: 0,
          }}
        >
          <span
            style={{
              color: "var(--red, #e53e3e)",
              fontSize: "0.875rem",
              fontWeight: 700,
              letterSpacing: "0.15em",
              fontFamily: "'Noto Serif TC', 'Noto Serif SC', serif",
            }}
          >
            墨宇
          </span>
        </div>

        {/* Dismiss button */}
        <div
          style={{
            textAlign: "center",
            marginTop: "2rem",
            animation: `fadeIn 0.5s ease-out ${buttonDelay}s both`,
          }}
        >
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            style={{
              background: "linear-gradient(135deg, var(--gold, #d4a853), #b8860b)",
              color: "#1a1a2e",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.625rem 1.75rem",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: dismissing ? "default" : "pointer",
              letterSpacing: "0.1em",
              transition: "box-shadow 0.2s, transform 0.2s",
              boxShadow: "0 2px 12px rgba(212, 168, 83, 0.3)",
            }}
            onMouseEnter={(e) => {
              if (!dismissing) {
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(212, 168, 83, 0.5)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 2px 12px rgba(212, 168, 83, 0.3)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            正式入門 →
          </button>
        </div>
      </div>
    </>
  );
}

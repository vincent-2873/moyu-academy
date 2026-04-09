"use client";

import { useState, useEffect } from "react";

interface MentorTeamCardProps {
  userEmail: string;
  onNavigate: (page: string) => void;
}

interface MentorshipData {
  manager?: { name: string; email: string };
  mentor?: { name: string; email: string };
  trainee: { name: string; email: string };
  pairStartDate?: string;
  currentWeekMode?: string;
}

export default function MentorTeamCard({ userEmail, onNavigate }: MentorTeamCardProps) {
  const [data, setData] = useState<MentorshipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/mentorship?user_email=${encodeURIComponent(userEmail)}`);
        if (!res.ok) throw new Error("Failed to fetch mentorship data");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userEmail]);

  const daysSince = (dateStr: string): number => {
    const start = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            height: "1.25rem",
            width: "60%",
            backgroundColor: "var(--bg2)",
            borderRadius: "0.375rem",
            marginBottom: "1rem",
            animation: "skeletonPulse 1.5s ease-in-out infinite",
          }}
        />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: "var(--bg2)",
                animation: "skeletonPulse 1.5s ease-in-out infinite",
              }}
            />
            <div
              style={{
                height: "0.875rem",
                width: "40%",
                backgroundColor: "var(--bg2)",
                borderRadius: "0.375rem",
                animation: "skeletonPulse 1.5s ease-in-out infinite",
              }}
            />
          </div>
        ))}
        <style jsx>{`
          @keyframes skeletonPulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.8; }
          }
        `}</style>
      </div>
    );
  }

  // Error state or no pair — show waiting state
  if (!data || !data.mentor) {
    return (
      <div
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <h3
          style={{
            margin: "0 0 1.25rem 0",
            fontSize: "1rem",
            background: "linear-gradient(135deg, var(--accent), var(--accent-light))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          🏮 我的師徒團隊
        </h3>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem 1rem",
            color: "var(--text3)",
            fontSize: "0.875rem",
          }}
        >
          <span style={{ fontSize: "2rem", marginBottom: "0.75rem", animation: "waitingPulse 2s ease-in-out infinite" }}>
            ⏳
          </span>
          <span style={{ animation: "waitingPulse 2s ease-in-out infinite" }}>等待配對中...</span>
        </div>
        <style jsx>{`
          @keyframes waitingPulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // Hierarchy levels
  const levels = [
    ...(data.manager
      ? [{ icon: "👑", name: data.manager.name, role: "據點主管", tint: "var(--gold)", isMe: data.manager.email === userEmail }]
      : []),
    { icon: "🛡️", name: data.mentor.name, role: "師父", tint: "#a78bfa", isMe: data.mentor.email === userEmail },
    { icon: "🌱", name: data.trainee.name, role: "我", tint: "var(--teal)", isMe: data.trainee.email === userEmail },
  ];

  const days = data.pairStartDate ? daysSince(data.pairStartDate) : 0;

  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
      }}
    >
      {/* Title */}
      <h3
        style={{
          margin: "0 0 1.25rem 0",
          fontSize: "1rem",
          fontWeight: 600,
          background: "linear-gradient(135deg, var(--accent), var(--accent-light))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        🏮 我的師徒團隊
      </h3>

      {/* Hierarchy */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: "1.25rem" }}>
        {levels.map((level, idx) => (
          <div key={idx}>
            {/* Person row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.5rem 0.625rem",
                borderRadius: "0.5rem",
                ...(level.isMe
                  ? {
                      background: `linear-gradient(135deg, ${level.tint}15, ${level.tint}08)`,
                      boxShadow: `0 0 12px ${level.tint}20`,
                    }
                  : {}),
              }}
            >
              {/* Avatar circle */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#fff",
                  backgroundColor: `${level.tint}30`,
                  border: `2px solid ${level.tint}`,
                  flexShrink: 0,
                }}
              >
                {level.icon}
              </div>

              {/* Name */}
              <span
                style={{
                  fontSize: "0.875rem",
                  color: level.isMe ? "var(--text)" : "var(--text2)",
                  fontWeight: level.isMe ? 600 : 400,
                  flex: 1,
                }}
              >
                {level.name}
              </span>

              {/* Role label */}
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: level.tint,
                  backgroundColor: `${level.tint}15`,
                  padding: "0.125rem 0.5rem",
                  borderRadius: "9999px",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {level.role}
              </span>
            </div>

            {/* Connecting vertical line */}
            {idx < levels.length - 1 && (
              <div
                style={{
                  width: 2,
                  height: 16,
                  marginLeft: "0.625rem",
                  marginTop: -2,
                  marginBottom: -2,
                  transform: "translateX(13px)",
                  background: `linear-gradient(to bottom, ${levels[idx].tint}60, ${levels[idx + 1].tint}60)`,
                  borderRadius: 1,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Bottom info */}
      {data.pairStartDate && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
            padding: "0.625rem 0",
            borderTop: "1px solid var(--border)",
            marginBottom: "0.75rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
            配對日期：{formatDate(data.pairStartDate)}
          </span>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--teal)",
              fontWeight: 600,
            }}
          >
            第 {days} 天
          </span>
          {data.currentWeekMode && (
            <span
              style={{
                fontSize: "0.6875rem",
                color: "var(--accent-light)",
                backgroundColor: "rgba(143,164,240,0.08)",
                padding: "0.125rem 0.5rem",
                borderRadius: "9999px",
                fontWeight: 500,
              }}
            >
              {data.currentWeekMode}
            </span>
          )}
        </div>
      )}

      {/* Navigate link */}
      <button
        onClick={() => onNavigate("mentorship")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--accent)",
          fontSize: "0.8125rem",
          fontWeight: 500,
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          transition: "opacity 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        查看詳情 →
      </button>
    </div>
  );
}

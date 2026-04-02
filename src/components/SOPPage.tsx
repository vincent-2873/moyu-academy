"use client";

import { useState } from "react";
import { sopSections, getSOPForBrand, type SOPSection, type SOPItem } from "@/data/sop";

interface SOPPageProps {
  brandId: string;
}

export default function SOPPage({ brandId }: SOPPageProps) {
  const sections = getSOPForBrand(brandId);
  const [activeSection, setActiveSection] = useState(sections[0]?.id || "");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const currentSection = sections.find((s) => s.id === activeSection);

  return (
    <div>
      <h1
        className="text-2xl font-bold mb-1"
        style={{
          background: "linear-gradient(135deg, var(--accent), var(--teal))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        SOP 規範
      </h1>
      <p className="text-sm text-[var(--text3)] mb-6">
        標準作業流程 — 名單撥打、CRM 紀錄、LINE 管理、後台操作
      </p>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSection === s.id
                ? "text-white shadow-lg"
                : "bg-[var(--card)] text-[var(--text2)] border border-[var(--border)] hover:border-[var(--accent)]"
            }`}
            style={
              activeSection === s.id
                ? { background: "var(--accent)", boxShadow: "0 4px 20px var(--accent)40" }
                : undefined
            }
          >
            {s.icon} {s.title}
          </button>
        ))}
      </div>

      {/* Section content */}
      {currentSection && (
        <div className="space-y-3">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-4">
            <p className="text-sm text-[var(--text2)]">{currentSection.description}</p>
          </div>

          {currentSection.items.map((item) => (
            <SOPItemCard
              key={item.id}
              item={item}
              expanded={expandedItems.has(item.id)}
              onToggle={() => toggleItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SOPItemCard({
  item,
  expanded,
  onToggle,
}: {
  item: SOPItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`bg-[var(--card)] border rounded-xl overflow-hidden transition-all ${
        item.important ? "border-[var(--accent)]" : "border-[var(--border)]"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[rgba(124,108,240,0.05)] transition-colors"
      >
        <div className="flex items-center gap-3">
          {item.important && (
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0" />
          )}
          <span className="font-semibold text-sm">{item.title}</span>
        </div>
        <span
          className="text-[var(--text3)] transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▼
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3 border-t border-[var(--border)] pt-3">
          <p className="text-sm text-[var(--text2)]">{item.content}</p>

          {item.format && (
            <div className="bg-[var(--bg2)] rounded-lg p-3">
              <p className="text-[10px] text-[var(--text3)] uppercase tracking-wider mb-1 font-bold">
                格式
              </p>
              <pre className="text-sm text-[var(--accent)] whitespace-pre-wrap font-mono">
                {item.format}
              </pre>
            </div>
          )}

          {item.example && (
            <div className="bg-[rgba(0,210,187,0.08)] rounded-lg p-3">
              <p className="text-[10px] text-[var(--teal)] uppercase tracking-wider mb-1 font-bold">
                範例
              </p>
              <pre className="text-sm text-[var(--text)] whitespace-pre-wrap font-mono">
                {item.example}
              </pre>
            </div>
          )}

          {item.tip && (
            <div className="flex items-start gap-2 text-xs text-[var(--gold)]">
              <span>💡</span>
              <span>{item.tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

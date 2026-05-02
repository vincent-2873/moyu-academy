"use client";

/**
 * TimeRangePicker + Provider(2026-05-02 Wave 8 #1)
 *
 * Vincent 拍板:整 admin 共用一個時段切換,切了 hub + board + sales/dashboard 全聯動。
 * Memo (Claude daily narrative) 不重產 — 它綁今日(預設)。
 *
 * 用法:
 *   1. admin/layout.tsx 在頂層 wrap <AdminDateRangeProvider>
 *   2. hub topbar 放 <TimeRangePicker />
 *   3. fetch 時用 const { range } = useAdminDateRange(); fetch(`/api/x?${dateRangeQS(range)}`)
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  DateRange,
  DateRangePreset,
  presetToRange,
  PRESET_OPTIONS,
  DEFAULT_PRESET,
} from "@/lib/dateRange";

interface DateRangeCtxValue {
  range: DateRange;
  setPreset: (p: DateRangePreset) => void;
  setCustom: (from: string, to: string) => void;
  hydrated: boolean;
}

const Ctx = createContext<DateRangeCtxValue | null>(null);

const STORAGE_KEY = "moyu_admin_date_range_v1";

export function AdminDateRangeProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [range, setRange] = useState<DateRange>(() => presetToRange(DEFAULT_PRESET));

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const obj = JSON.parse(stored) as { preset: DateRangePreset; from?: string; to?: string };
        if (obj.preset === "custom" && obj.from && obj.to) {
          setRange(presetToRange("custom", obj.from, obj.to));
        } else if (obj.preset) {
          setRange(presetToRange(obj.preset));
        }
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  function setPreset(p: DateRangePreset) {
    if (p === "custom") {
      // 維持目前 from/to 切到 custom 模式
      const next = presetToRange("custom", range.from, range.to);
      setRange(next);
      persist(next);
      return;
    }
    const next = presetToRange(p);
    setRange(next);
    persist(next);
  }

  function setCustom(from: string, to: string) {
    const next = presetToRange("custom", from, to);
    setRange(next);
    persist(next);
  }

  function persist(r: DateRange) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ preset: r.preset, from: r.from, to: r.to })
      );
    } catch { /* ignore */ }
  }

  const value = useMemo(() => ({ range, setPreset, setCustom, hydrated }), [range, hydrated]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminDateRange(): DateRangeCtxValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // SSR safety — 給空殼 fallback
    return {
      range: presetToRange(DEFAULT_PRESET),
      setPreset: () => {},
      setCustom: () => {},
      hydrated: false,
    };
  }
  return ctx;
}

/** Picker UI — 7 預設 button + custom 兩個 date input */
export function TimeRangePicker({ compact = false }: { compact?: boolean }) {
  const { range, setPreset, setCustom, hydrated } = useAdminDateRange();
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo, setCustomTo] = useState(range.to);

  useEffect(() => {
    setCustomFrom(range.from);
    setCustomTo(range.to);
  }, [range.from, range.to]);

  if (!hydrated) {
    return (
      <div className="trp-shell" data-compact={compact}>
        <span className="trp-label">時段</span>
        <span className="trp-chip trp-chip--active">本月迄今</span>
      </div>
    );
  }

  return (
    <div className="trp-shell" data-compact={compact}>
      <span className="trp-label">時段</span>
      {PRESET_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => {
            if (opt.value === "custom") {
              setShowCustom(true);
              setPreset("custom");
            } else {
              setShowCustom(false);
              setPreset(opt.value);
            }
          }}
          className={`trp-chip${range.preset === opt.value ? " trp-chip--active" : ""}`}
        >
          {opt.label}
        </button>
      ))}
      <span className="trp-current" title={`${range.from} ~ ${range.to}`}>
        {range.label}
      </span>
      {(range.preset === "custom" || showCustom) && (
        <div className="trp-custom-row">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="trp-date"
          />
          <span style={{ color: "var(--ds-text-3)" }}>~</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="trp-date"
          />
          <button
            type="button"
            onClick={() => {
              if (customFrom && customTo && customFrom <= customTo) {
                setCustom(customFrom, customTo);
                setShowCustom(false);
              }
            }}
            className="ds-btn ds-btn--primary ds-btn--sm"
          >
            套用
          </button>
        </div>
      )}
    </div>
  );
}

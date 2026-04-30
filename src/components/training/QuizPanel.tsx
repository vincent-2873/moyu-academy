"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Option = { id: string; text: string; correct?: boolean };
type Question = {
  id: string;
  text: string;
  type: "single_choice" | "multi_choice" | "text";
  options?: Option[];
  expected_answer?: string;
  explanation?: string;
};
type Content = { questions?: Question[]; pass_score?: number };

interface Props {
  moduleId: string;
  userEmail: string;
  content: Content;
  onComplete?: (r: { score: number; pass: boolean }) => void;
}

export default function QuizPanel({ moduleId, userEmail, content, onComplete }: Props) {
  const questions = content.questions || [];
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  if (questions.length === 0) {
    return <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-mid)", padding: 12, background: "rgba(217,119,6,0.06)", borderRadius: 4 }}>此 module 是 quiz 但沒題目 — 請後台補 content.questions</div>;
  }

  function setAns(qid: string, value: any) {
    setAnswers((a) => ({ ...a, [qid]: value }));
  }

  function toggleMulti(qid: string, optionId: string) {
    setAnswers((a) => {
      const cur = Array.isArray(a[qid]) ? a[qid] : [];
      return { ...a, [qid]: cur.includes(optionId) ? cur.filter((x: string) => x !== optionId) : [...cur, optionId] };
    });
  }

  async function submit() {
    setSubmitting(true);
    setErr(null);
    try {
      const r = await fetch("/api/me/training/quiz-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: userEmail, module_id: moduleId, answers }),
      });
      const j = await r.json();
      if (!r.ok) setErr(j.error || `HTTP ${r.status}`);
      else { setResult(j); onComplete?.({ score: j.score, pass: j.pass }); }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  function reset() { setAnswers({}); setResult(null); setErr(null); }

  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ marginTop: 12, padding: 16, background: "var(--bg-elev)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600 }}>結果</span>
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}
            style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 28, fontWeight: 700, color: result.pass ? "var(--gold-thread, #c9a96e)" : "var(--accent-red)" }}>
            {result.score}
          </motion.span>
          <span style={{ fontSize: 12, color: result.pass ? "var(--gold-thread, #c9a96e)" : "var(--accent-red)", letterSpacing: 1 }}>
            {result.pass ? "✓ 通過" : "× 未過"} · {result.got}/{result.total}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {questions.map((q, idx) => {
            const b = (result.breakdown || []).find((x: any) => x.id === q.id);
            return (
              <div key={q.id} style={{ padding: 10, background: "var(--bg-paper)", borderLeft: `3px solid ${b?.correct ? "var(--gold-thread, #c9a96e)" : "var(--accent-red)"}`, borderRadius: 2 }}>
                <div style={{ fontSize: 12, color: "var(--ink-deep)", marginBottom: 4 }}>{idx + 1}. {q.text}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mid)", fontFamily: "var(--font-jetbrains-mono)" }}>
                  {b?.correct ? "✓ 答對" : `× 你答 ${JSON.stringify(b?.user_answer)} · 正解 ${JSON.stringify(b?.correct_answer)}`}
                </div>
                {q.explanation && !b?.correct && (
                  <div style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 4, lineHeight: 1.6 }}>※ {q.explanation}</div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={reset} style={{ marginTop: 12, padding: "4px 10px", background: "transparent", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 4, fontSize: 11, color: "var(--ink-mid)", cursor: "pointer" }}>
          再答一次
        </button>
      </motion.div>
    );
  }

  return (
    <div style={{ marginTop: 12, padding: 16, background: "var(--bg-elev)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", borderRadius: 6 }}>
      <div style={{ fontSize: 11, color: "var(--ink-mid)", letterSpacing: 2, fontWeight: 600, marginBottom: 12 }}>QUIZ · {questions.length} 題</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {questions.map((q, idx) => (
          <motion.div key={q.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
            <div style={{ fontFamily: "var(--font-noto-serif-tc)", fontSize: 14, color: "var(--ink-deep)", marginBottom: 8, letterSpacing: 1 }}>
              {idx + 1}. {q.text}
            </div>
            {q.type === "single_choice" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(q.options || []).map((o) => (
                  <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: answers[q.id] === o.id ? "rgba(185,28,28,0.06)" : "var(--bg-paper)", borderRadius: 4, cursor: "pointer", border: "1px solid", borderColor: answers[q.id] === o.id ? "var(--accent-red)" : "transparent" }}>
                    <input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => setAns(q.id, o.id)} />
                    <span style={{ fontSize: 13, color: "var(--ink-deep)" }}>{o.text}</span>
                  </label>
                ))}
              </div>
            )}
            {q.type === "multi_choice" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(q.options || []).map((o) => {
                  const checked = (answers[q.id] || []).includes(o.id);
                  return (
                    <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: checked ? "rgba(185,28,28,0.06)" : "var(--bg-paper)", borderRadius: 4, cursor: "pointer", border: "1px solid", borderColor: checked ? "var(--accent-red)" : "transparent" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleMulti(q.id, o.id)} />
                      <span style={{ fontSize: 13, color: "var(--ink-deep)" }}>{o.text}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {q.type === "text" && (
              <input value={answers[q.id] || ""} onChange={(e) => setAns(q.id, e.target.value)}
                placeholder="輸入答案" style={{ width: "100%", padding: "8px 12px", borderRadius: 4, background: "var(--bg-paper)", border: "1px solid var(--border-soft, rgba(26,26,26,0.10))", color: "var(--ink-deep)", fontSize: 13 }} />
            )}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {err && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ marginTop: 12, padding: "8px 12px", background: "rgba(185,28,28,0.1)", border: "1px solid var(--accent-red)", borderRadius: 4, color: "var(--accent-red)", fontSize: 12 }}>
            錯誤: {err}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button whileHover={{ scale: submitting ? 1 : 1.02 }} whileTap={{ scale: submitting ? 1 : 0.98 }} onClick={submit} disabled={submitting}
        style={{ marginTop: 16, padding: "10px 24px", borderRadius: 4, background: submitting ? "var(--ink-mid)" : "var(--accent-red)", color: "var(--bg-paper)", border: "none", fontSize: 13, fontFamily: "var(--font-noto-serif-tc)", letterSpacing: 4, cursor: submitting ? "wait" : "pointer" }}>
        {submitting ? "閱卷中…" : "📝 交 卷"}
      </motion.button>
    </div>
  );
}

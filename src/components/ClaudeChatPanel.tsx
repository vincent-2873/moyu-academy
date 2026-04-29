"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ClaudeChatPanel — 全頁面常駐對話側欄(Spec /home /work /learn 全頁)
 *
 * Skeleton (C 骨架):
 *   - 右下角朱紅圓形觸發 button(墨字,wabi 風格)
 *   - 展開後從右側 slide in 380px 寬 panel
 *   - 對話歷史從 /api/claude-panel/messages 撈
 *   - 送訊息 POST /api/claude-panel/chat,SSE 回應
 *   - 預留 metadata: stage / brand / page(F1 RAG retrieval 接口)
 *   - 主管查看 = 另一個後台 tab,本元件不處理
 *
 * 使用方式: <ClaudeChatPanel userEmail={...} stage={...} brand={...} /> 放 layout.tsx
 */

type Msg = {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
};

interface Props {
  userEmail: string | null;
  stage?: string;
  brand?: string;
}

export default function ClaudeChatPanel({ userEmail, stage, brand }: Props) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // session 從 localStorage 讀, 首次進入創新
  useEffect(() => {
    if (!open || !userEmail) return;
    const cacheKey = `__claude_session_${userEmail}`;
    let sid = localStorage.getItem(cacheKey);
    if (!sid) {
      sid = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(cacheKey, sid);
    }
    setSessionId(sid);
  }, [open, userEmail]);

  // 載入對話歷史
  useEffect(() => {
    if (!sessionId || !userEmail) return;
    fetch(`/api/claude-panel/messages?email=${encodeURIComponent(userEmail)}&session_id=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.messages && Array.isArray(d.messages)) {
          setMessages(d.messages);
        }
      })
      .catch(() => {});
  }, [sessionId, userEmail]);

  // 自動滾到底
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!input.trim() || sending || !userEmail || !sessionId) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg, { role: "assistant", content: "..." }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/claude-panel/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          session_id: sessionId,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          metadata: { stage, brand, page: typeof window !== "undefined" ? window.location.pathname : null },
        }),
      });

      if (!res.ok || !res.body) {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: `(錯誤 ${res.status})` };
          return copy;
        });
        setSending(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const text = acc;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: text };
          return copy;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "(連線異常)" };
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  if (!userEmail) return null;

  return (
    <>
      {/* 觸發 button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="打開戰情官對話"
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
          style={{
            background: "var(--accent-red, #b91c1c)",
            color: "var(--bg-paper, #f7f1e3)",
            fontFamily: "var(--font-noto-serif-tc, serif)",
            fontSize: "22px",
            fontWeight: 600,
          }}
        >
          墨
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed top-0 right-0 z-40 h-full flex flex-col shadow-2xl"
          style={{
            width: "380px",
            background: "var(--bg-paper, #f7f1e3)",
            borderLeft: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--border-soft, rgba(26,26,26,0.10))" }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-noto-serif-tc, serif)",
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--ink-deep, #1a1a1a)",
                }}
              >
                戰情官
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--ink-mid, #4a4a4a)",
                  marginTop: "2px",
                }}
              >
                {stage && `${stage} · `}{brand || "墨宇"}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="收起"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5"
              style={{ color: "var(--ink-mid, #4a4a4a)" }}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.length === 0 && (
              <div
                style={{
                  fontFamily: "var(--font-noto-serif-tc, serif)",
                  color: "var(--ink-mid, #4a4a4a)",
                  fontSize: "14px",
                  lineHeight: 1.7,
                }}
              >
                我是你的戰情官。問我任何事 — 今日該做什麼、卡關怎麼解、想找誰幫忙。
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={m.id || i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[85%] px-4 py-2.5 rounded-md"
                  style={{
                    background:
                      m.role === "user"
                        ? "var(--ink-deep, #1a1a1a)"
                        : "var(--bg-elev, rgba(247,241,227,0.85))",
                    color:
                      m.role === "user"
                        ? "var(--bg-paper, #f7f1e3)"
                        : "var(--ink-deep, #1a1a1a)",
                    fontSize: "14px",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    border: m.role === "assistant" ? "1px solid var(--border-soft, rgba(26,26,26,0.10))" : undefined,
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div
            className="px-4 py-3"
            style={{ borderTop: "1px solid var(--border-soft, rgba(26,26,26,0.10))" }}
          >
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="說話… (Enter 送出)"
                rows={2}
                className="flex-1 px-3 py-2 rounded-md resize-none focus:outline-none"
                style={{
                  background: "var(--bg-paper, #f7f1e3)",
                  border: "1px solid var(--border-soft, rgba(26,26,26,0.10))",
                  color: "var(--ink-deep, #1a1a1a)",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  fontFamily: "var(--font-noto-sans-tc, sans-serif)",
                }}
                disabled={sending}
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="px-4 py-2 rounded-md transition-opacity disabled:opacity-40"
                style={{
                  background: "var(--ink-deep, #1a1a1a)",
                  color: "var(--bg-paper, #f7f1e3)",
                  fontSize: "13px",
                  fontFamily: "var(--font-noto-serif-tc, serif)",
                }}
              >
                送
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

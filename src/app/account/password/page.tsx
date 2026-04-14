"use client";

import { useState, useEffect } from "react";

export default function ChangePasswordPage() {
  const [email, setEmail] = useState("");
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const e = sessionStorage.getItem("moyu_current_user");
    if (e) setEmail(e);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPwd !== confirmPwd) {
      setMsg({ type: "err", text: "兩次輸入的新密碼不一致" });
      return;
    }
    if (newPwd.length < 4) {
      setMsg({ type: "err", text: "新密碼至少 4 字" });
      return;
    }
    if (newPwd === "0000") {
      setMsg({ type: "err", text: "新密碼不可為預設 0000" });
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, oldPassword: oldPwd, newPassword: newPwd }),
      });
      const d = await r.json();
      if (r.ok) {
        setMsg({ type: "ok", text: "密碼已更新 ✓ 下次登入請用新密碼" });
        setOldPwd(""); setNewPwd(""); setConfirmPwd("");
      } else {
        setMsg({ type: "err", text: d.error || "變更失敗" });
      }
    } catch {
      setMsg({ type: "err", text: "無法連接伺服器" });
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, maxWidth: 420, width: "100%", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>🔑 變更密碼</h1>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6, marginBottom: 24 }}>
          {email || "尚未登入"}
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>舊密碼（預設 0000）</label>
            <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} required style={inputStyle} placeholder="0000" />
          </div>
          <div>
            <label style={labelStyle}>新密碼（至少 4 字、不可為 0000）</label>
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>確認新密碼</label>
            <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required style={inputStyle} />
          </div>

          {msg && (
            <div style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: msg.type === "ok" ? "#f0fdf4" : "#fef2f2",
              color: msg.type === "ok" ? "#16a34a" : "#dc2626",
              fontSize: 13,
              border: `1px solid ${msg.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
            }}>{msg.text}</div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: 12, borderRadius: 10, border: "none",
            background: loading ? "#cbd5e1" : "#4f46e5", color: "#fff",
            fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer",
          }}>
            {loading ? "更新中..." : "變更密碼"}
          </button>

          <a href="/" style={{ textAlign: "center", fontSize: 12, color: "#64748b", textDecoration: "none", marginTop: 4 }}>← 返回</a>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" };

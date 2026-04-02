"use client";

import React, { useState, useEffect } from "react";

interface ProfilePageProps {
  userEmail: string;
  userName: string;
  brandId: string;
  brandColor?: string;
  onNameChange?: (newName: string) => void;
}

interface Profile {
  id: string;
  name: string;
  email: string;
  brand: string;
  role: string;
  status: string;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  created_at: string;
}

const AVATAR_EMOJIS = [
  "😊", "😎", "🤓", "🧑‍💼", "👩‍💼", "🦁", "🐯", "🐻", "🦊", "🐨",
  "🐼", "🐸", "🐙", "🦋", "🌟", "🔥", "💎", "🚀", "🎯", "🏆",
  "🎨", "🎸", "🎮", "📚", "💡", "⚡", "🌈", "🍀", "🌸", "🌙",
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "超級管理員",
  brand_manager: "品牌主管",
  team_leader: "業務主管",
  admin: "管理員",
  manager: "據點主管",
  trainer: "培訓師",
  reserve_cadre: "儲備幹部",
  mentor: "師父",
  sales_rep: "業務人員",
};

export default function ProfilePage({
  userEmail,
  userName,
  brandId,
  brandColor = "#7c6cf0",
  onNameChange,
}: ProfilePageProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPhone, setEditPhone] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      try {
        const res = await fetch(`/api/profile?email=${encodeURIComponent(userEmail)}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setEditName(data.profile.name || "");
          setEditAvatar(data.profile.avatar_url || "");
          setEditBio(data.profile.bio || "");
          setEditPhone(data.profile.phone || "");
        }
      } catch {
        // Profile may not exist in Supabase yet
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [userEmail]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          name: editName.trim() || userName,
          avatar_url: editAvatar || null,
          bio: editBio.trim() || null,
          phone: editPhone.trim() || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setMessage("儲存成功！");
        if (onNameChange && editName.trim() && editName.trim() !== userName) {
          onNameChange(editName.trim());
        }
      } else {
        const err = await res.json();
        setMessage(`儲存失敗: ${err.error}`);
      }
    } catch {
      setMessage("網路錯誤，請稍後再試");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const avatarDisplay = editAvatar || (editName || userName).charAt(0);
  const isEmoji = editAvatar && AVATAR_EMOJIS.includes(editAvatar);

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
        <div className="h-12 bg-[var(--bg2)] rounded-lg animate-pulse" />
        <div className="h-64 bg-[var(--bg2)] rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">個人檔案</h1>
        <p className="text-sm text-[var(--text3)] mt-1">管理您的個人資訊與顯示設定</p>
      </div>

      {/* Avatar Section */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[var(--text2)] mb-4">頭像</h3>
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-3xl shrink-0 cursor-pointer transition-transform hover:scale-105"
            style={{
              background: isEmoji ? "var(--bg2)" : `linear-gradient(135deg, ${brandColor}, var(--teal))`,
              color: isEmoji ? undefined : "#fff",
              border: "2px solid var(--border)",
            }}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            {avatarDisplay}
          </div>
          <div className="flex-1">
            <p className="text-sm text-[var(--text)]">點擊頭像選擇表情符號</p>
            <p className="text-xs text-[var(--text3)] mt-1">或留空使用姓名首字</p>
            {editAvatar && (
              <button
                onClick={() => setEditAvatar("")}
                className="text-xs text-[var(--red)] mt-2 hover:underline"
              >
                清除頭像，使用預設
              </button>
            )}
          </div>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="mt-4 p-3 bg-[var(--bg2)] rounded-lg border border-[var(--border)]">
            <p className="text-xs text-[var(--text3)] mb-2">選擇一個表情符號作為頭像</p>
            <div className="grid grid-cols-10 gap-1">
              {AVATAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setEditAvatar(emoji);
                    setShowEmojiPicker(false);
                  }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl hover:bg-[var(--border)] transition-colors ${
                    editAvatar === emoji ? "bg-[var(--accent)]/20 ring-2 ring-[var(--accent)]" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Profile Info */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-5">
        <h3 className="text-sm font-semibold text-[var(--text2)]">基本資訊</h3>

        {/* Name */}
        <div>
          <label className="block text-xs text-[var(--text3)] mb-1.5">顯示名稱</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors text-sm"
            placeholder="輸入顯示名稱"
          />
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-xs text-[var(--text3)] mb-1.5">Email</label>
          <input
            type="email"
            value={userEmail}
            disabled
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text3)] outline-none text-sm cursor-not-allowed"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs text-[var(--text3)] mb-1.5">手機號碼</label>
          <input
            type="tel"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors text-sm"
            placeholder="例: 0912-345-678"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-xs text-[var(--text3)] mb-1.5">自我介紹</label>
          <textarea
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            rows={3}
            maxLength={200}
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors text-sm resize-none"
            placeholder="簡單介紹一下自己..."
          />
          <p className="text-[10px] text-[var(--text3)] mt-1 text-right">
            {editBio.length}/200
          </p>
        </div>
      </div>

      {/* Role & Status (read-only) */}
      {profile && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-[var(--text2)] mb-4">帳號資訊</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-[var(--text3)]">角色</span>
              <p className="text-[var(--text)] font-medium mt-0.5">
                {ROLE_LABELS[profile.role] || profile.role}
              </p>
            </div>
            <div>
              <span className="text-xs text-[var(--text3)]">狀態</span>
              <p className="mt-0.5">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded"
                  style={{
                    background: profile.status === "active" ? "#22c55e22" : "#f8717122",
                    color: profile.status === "active" ? "var(--green)" : "var(--red)",
                  }}
                >
                  {profile.status === "active" ? "啟用中" : "已停用"}
                </span>
              </p>
            </div>
            <div>
              <span className="text-xs text-[var(--text3)]">品牌</span>
              <p className="text-[var(--text)] font-medium mt-0.5">{profile.brand}</p>
            </div>
            <div>
              <span className="text-xs text-[var(--text3)]">加入日期</span>
              <p className="text-[var(--text)] font-medium mt-0.5">
                {new Date(profile.created_at).toLocaleDateString("zh-TW")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, ${brandColor}, var(--teal))`,
          }}
        >
          {saving ? "儲存中..." : "儲存變更"}
        </button>
        {message && (
          <span
            className="text-sm font-medium"
            style={{
              color: message.includes("成功") ? "var(--green)" : "var(--red)",
            }}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import WhisperBatchUploader from "@/components/admin/WhisperBatchUploader";

/**
 * /admin/legal/knowledge — 法律知識上傳介面
 *
 * 對齊 system-tree v2 §法務管理 + Vincent 鐵則:
 *   - pillar=legal 隔離(法務員看法務,業務員看不到)
 *   - 接受:契約 docx/pdf · 律師信 · 法律意見書 · 庭審錄音 wav/mp4
 *   - 跟業務 RAG 完全分流(知識撈取時透過 pillar filter)
 */
export default function AdminLegalKnowledgePage() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📚 法律知識管理</h1>
        <p style={{ fontSize: 13, color: "var(--text3, #888)", marginTop: 6 }}>
          上傳法律契約 / 律師信 / 庭審錄音 / 判例 → <code>knowledge_chunks(pillar=legal)</code>{" "}
          · 跟業務 sales pillar 完全分流(權限矩陣自動隔離)
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <WhisperBatchUploader
          pillar="legal"
          hideBrandSelector
          title="🎤 法律錄音上傳 → RAG(法務 pillar)"
          description={
            <>
              庭審錄音 / 律師會議 / 法律諮詢通話(任意大小 wav / mp3 / mp4 / mov / m4a)
              → server 端 ffmpeg 自動處理 → <code>pillar=legal</code> 知識池
              <br />
              <strong>法務員 / 法務主管 / Vincent 看得到,業務員完全看不到</strong>(權限矩陣 RLS)
            </>
          }
        />

        <div style={{
          background: "var(--ink-paper, #FAFAF7)",
          border: "1px dashed var(--ink-line, #E5E2DA)",
          borderRadius: 10, padding: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📄 文件上傳(契約 / 判例 / 律師信)</h2>
          <div style={{ fontSize: 13, color: "var(--text2, #666)", lineHeight: 1.7 }}>
            待 Phase 6 polish:
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>.docx 契約 / 律師信 → mammoth 轉純文字 → pillar=legal</li>
              <li>.pdf 判例 → 待 pdf-parse / pdfjs 整合</li>
              <li>純文字貼上 → 已有 RagUploadPanel,可直接 pillar=legal 使用</li>
            </ul>
            目前只有錄音 / 影片 ingest 介面(上方),文件介面下個 sprint 補。
          </div>
        </div>
      </div>
    </div>
  );
}

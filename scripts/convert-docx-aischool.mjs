// 一次性 script:把 ~/Downloads 的 4 個 AI 未來學院開發逐字稿 .docx 轉 .md
// 寫進 content/training/sales/aischool/ 等 ingest 進 RAG
//
// 對齊 Vincent 鐵則「不從零生」+「不只 nSchool」(aischool 是 5 品牌之一)
// 跑法:cd moyu-academy && node scripts/convert-docx-aischool.mjs

import mammoth from "mammoth";
import fs from "fs";
import path from "path";

const SOURCE = "C:/Users/USER/Downloads/訓練資料/資料/AI未來學院";
const TARGET = "content/training/sales/aischool";

const FILES = [
  "博宇開發逐字稿.docx",
  "嘉賢開發逐字稿.docx",
  "婉婷開發逐字稿.docx",
  "昱賢開發逐字稿.docx",
];

if (!fs.existsSync(TARGET)) fs.mkdirSync(TARGET, { recursive: true });

let okCount = 0;
let totalChars = 0;

for (const fname of FILES) {
  const src = path.join(SOURCE, fname);
  if (!fs.existsSync(src)) {
    console.log(`❌ 來源不存在:${src}`);
    continue;
  }

  try {
    const result = await mammoth.convertToMarkdown({ path: src });
    const speaker = fname.replace("開發逐字稿.docx", "");
    const md = `# AI 未來學院 — ${speaker} 開發 Call 逐字稿

> Source: ~/Downloads/訓練資料/資料/AI未來學院/${fname}
> Brand: aischool
> 用途:對練 persona / Whisper 三點評估 / RAG sales pillar
> 對齊 nSchool 真實 8 步驟(破冰/信任建立/需求探索/介紹品牌/補充資訊/領域架構/產品引導與價值說明/行動邀請)

---

${result.value}
`;
    const outPath = path.join(TARGET, `${speaker}-開發逐字.md`);
    fs.writeFileSync(outPath, md, "utf8");
    okCount++;
    totalChars += result.value.length;
    console.log(`✅ ${fname} → ${outPath}(${result.value.length} chars)`);
    if (result.messages?.length) {
      result.messages.slice(0, 3).forEach(m => console.log(`   ⚠️ ${m.message}`));
    }
  } catch (e) {
    console.log(`❌ ${fname}: ${e.message}`);
  }
}

console.log(`\n總結:${okCount}/${FILES.length} 個檔成功,共 ${totalChars} chars`);

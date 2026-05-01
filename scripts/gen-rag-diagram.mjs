import fs from "fs";
import path from "path";

// 3 張關鍵圖,中文,色票對齊系統(米黃 / 朱紅 / 墨綠 / 老金)

const DIAGRAMS = {
  "1-architecture": `flowchart TB
    classDef src fill:#FAF7E8,stroke:#D4C896,color:#806848
    classDef sales fill:#FFE8DD,stroke:#B8474A,color:#2A2622
    classDef legal fill:#E8F0E8,stroke:#6B7A5A,color:#2A2622
    classDef common fill:#F0EFEA,stroke:#B89968,color:#806848
    classDef pipe fill:#FAFAF7,stroke:#6B7E94,color:#2A2622

    A([👤 Vincent / 法務員 / 業務員<br/>後台拖檔])

    A --> B1["/admin/claude/knowledge<br/>業務上傳口（已建）"]:::sales
    A --> B2["/admin/legal/knowledge<br/>法務上傳口（即將建）"]:::legal

    B1 --> P1["ffmpeg-static<br/>切片 + 提取音訊"]:::pipe
    B2 --> P1
    B1 --> P2["mammoth<br/>docx 轉純文字"]:::pipe
    B2 --> P2

    P1 --> P3["Groq Whisper Large v3<br/>並行轉錄"]:::pipe

    P3 --> S1[("Supabase<br/>knowledge_chunks<br/>pillar=sales<br/>業務池")]:::sales
    P3 --> S2[("Supabase<br/>knowledge_chunks<br/>pillar=legal<br/>法務池")]:::legal
    P2 --> S1
    P2 --> S2
    P2 --> S3[("Supabase<br/>knowledge_chunks<br/>pillar=common<br/>通用池")]:::common`,

  "2-permission": `flowchart LR
    classDef sales fill:#FFE8DD,stroke:#B8474A,color:#2A2622
    classDef legal fill:#E8F0E8,stroke:#6B7A5A,color:#2A2622
    classDef common fill:#F0EFEA,stroke:#B89968,color:#806848
    classDef user fill:#FAF7E8,stroke:#D4C896,color:#806848

    P1[("業務 RAG 池<br/>pillar=sales")]:::sales
    P2[("法務 RAG 池<br/>pillar=legal")]:::legal
    P3[("通用 RAG 池<br/>pillar=common")]:::common

    U1([🧑‍💼 業務員]):::user
    U2([⚖️ 法務員]):::user
    U3([👑 Vincent / 高層]):::user

    P1 --> U1
    P3 --> U1
    P2 -.X 看不到.-> U1

    P2 --> U2
    P3 --> U2
    P1 -.X 看不到.-> U2

    P1 --> U3
    P2 --> U3
    P3 --> U3`,

  "3-whisper-pipeline": `sequenceDiagram
    participant V as Vincent 拖檔
    participant U as 後台 UI<br/>WhisperBatchUploader
    participant I as /init endpoint
    participant C as /chunk endpoint
    participant F as /finalize endpoint
    participant FF as ffmpeg-static
    participant G as Groq Whisper
    participant DB as Supabase<br/>knowledge_chunks

    V->>U: 選任意大小<br/>wav/mp3/mp4/mov
    U->>I: 檔名 + 大小 + chunks 數
    I-->>U: 拿 upload_id

    loop 每塊 1MB
        U->>C: 第 N 塊（避免 platform body 上限）
        C-->>U: 累積進度 N/total
    end

    U->>F: 全 chunks 收齊 → 開始處理
    F->>FF: 拼接檔 + 提取音訊 + 切 10 分鐘段
    FF-->>F: 多段 mp3 16kHz mono

    par 並行 3 段
        F->>G: 段 1 轉錄
        F->>G: 段 2 轉錄
        F->>G: 段 3 轉錄
    end
    G-->>F: transcript

    F->>DB: INSERT pillar=sales/legal<br/>brand 自動推斷
    F-->>U: ✅ 完成`,

  "4-frontend-usage": `flowchart TB
    classDef sales fill:#FFE8DD,stroke:#B8474A,color:#2A2622
    classDef legal fill:#E8F0E8,stroke:#6B7A5A,color:#2A2622
    classDef sidebar fill:#FAF7E8,stroke:#D4C896,color:#806848

    R1([🧑‍💼 業務員])
    R2([⚖️ 法務員])
    R3([👑 Vincent])

    R1 --> Q1["/sales/practice<br/>AI 對練 + Whisper 三點評估"]:::sales
    R1 --> Q2["/sales/knowledge<br/>問 Claude（業務 RAG）"]:::sales
    R2 --> Q3["/legal/draft<br/>Claude 起草助手"]:::legal
    R2 --> Q4["/legal/knowledge<br/>問 Claude（法務 RAG）"]:::legal
    R3 --> Q5["/admin/board/inquiry<br/>質詢 Claude（全 pillar）"]
    R1 --> Q6["戰情官側欄<br/>右下角朱紅墨字<br/>全頁面常駐"]:::sidebar
    R2 --> Q6
    R3 --> Q6

    Q1 --> S1[("業務 RAG")]:::sales
    Q2 --> S1
    Q3 --> S2[("法務 RAG")]:::legal
    Q4 --> S2
    Q5 --> SA[("全 pillar")]
    Q6 --> SA`,
};

const docsDir = path.join(process.cwd(), "docs");
const imgDir = path.join(process.cwd(), "docs", "img");
fs.mkdirSync(docsDir, { recursive: true });
fs.mkdirSync(imgDir, { recursive: true });

const urlsFile = path.join(imgDir, "_mermaid-urls.txt");
const urlLines = [];

for (const [name, code] of Object.entries(DIAGRAMS)) {
  const b64 = Buffer.from(code, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const url = `https://mermaid.ink/img/${b64}?theme=default&bgColor=FAFAF7`;
  const svgUrl = `https://mermaid.ink/svg/${b64}`;
  urlLines.push(`${name}:`);
  urlLines.push(`  PNG: ${url}`);
  urlLines.push(`  SVG: ${svgUrl}`);
  urlLines.push("");
  console.log(`✅ ${name}`);
  console.log(`   ${url.slice(0, 80)}...`);
}

fs.writeFileSync(urlsFile, urlLines.join("\n"));
console.log(`\n📁 URLs: ${urlsFile}`);
console.log(`📁 Mermaid source: ${docsDir}/RAG-ARCHITECTURE.md(會生成下一步)`);

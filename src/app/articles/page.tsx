"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

/* ───── types ───── */
type Category = "財經時事" | "銷售技巧" | "心態建設" | "產業趨勢" | "成功案例";

interface Article {
  id: number;
  title: string;
  category: Category;
  summary: string;
  source: string;
  date: string;
  link: string;
  takeaways: string[];
  featured?: boolean;
}

/* ───── category colors ───── */
const CATEGORY_COLORS: Record<Category, string> = {
  財經時事: "var(--accent)",
  銷售技巧: "var(--teal)",
  心態建設: "var(--gold)",
  產業趨勢: "var(--orange, #fb923c)",
  成功案例: "var(--green)",
};

const CATEGORIES: Category[] = [
  "財經時事",
  "銷售技巧",
  "心態建設",
  "產業趨勢",
  "成功案例",
];

/* ───── hardcoded articles ───── */
const ARTICLES: Article[] = [
  // 財經時事
  {
    id: 1,
    title: "2026 台股趨勢：AI 概念股持續領漲",
    category: "財經時事",
    summary:
      "隨著全球 AI 基礎設施投資持續擴大，台灣半導體供應鏈受惠明顯。台積電、聯發科等龍頭股帶動大盤突破兩萬點關卡，分析師預估下半年仍有上行空間。投資人應留意資金輪動節奏，適時調整部位。",
    source: "財經M平方",
    date: "2026/03/28",
    link: "#",
    takeaways: [
      "AI 伺服器需求帶動台廠營收年增 30%",
      "半導體 ETF 資金流入創歷史新高",
      "下半年需留意庫存調整風險",
    ],
    featured: true,
  },
  {
    id: 2,
    title: "Fed 利率決策對台灣投資人的影響",
    category: "財經時事",
    summary:
      "聯準會維持利率不變的決策，讓市場鬆了一口氣。台幣匯率短期走強有利於進口型企業，但出口導向的科技股可能承壓。作為業務人員，了解利率環境有助於與客戶討論資產配置策略。",
    source: "經濟日報",
    date: "2026/03/25",
    link: "#",
    takeaways: [
      "Fed 暫停升息，市場預期年底前降息一碼",
      "台幣升值對不同產業影響分歧",
      "與客戶溝通時可用利率趨勢切入理財話題",
    ],
  },
  {
    id: 3,
    title: "ETF 投資新手指南：從 0050 到主題式 ETF",
    category: "財經時事",
    summary:
      "ETF 已成為台灣投資人最熱門的入門工具。從元大台灣 50（0050）到各種主題式 ETF，選擇越來越多。本文整理 2026 年最受歡迎的 ETF 類型，幫助業務同仁快速掌握客戶常問的產品知識。",
    source: "MoneyDJ",
    date: "2026/03/22",
    link: "#",
    takeaways: [
      "高股息 ETF 仍是台灣散戶最愛",
      "主題式 ETF（AI、電動車）成長最快",
      "了解 ETF 費用率是推薦產品的基本功",
    ],
    featured: true,
  },
  // 銷售技巧
  {
    id: 4,
    title: "SPIN 銷售法：如何用問題引導客戶需求",
    category: "銷售技巧",
    summary:
      "SPIN 銷售法是頂尖業務的必備技能。透過情境（Situation）、問題（Problem）、暗示（Implication）、需求回報（Need-payoff）四階段提問，自然引導客戶發現自身需求，而非強硬推銷。",
    source: "業務力學院",
    date: "2026/03/27",
    link: "#",
    takeaways: [
      "先問情境問題建立信任，再挖掘痛點",
      "暗示問題讓客戶自己意識到問題的嚴重性",
      "需求回報問題讓客戶主動說出想要的解方",
    ],
    featured: true,
  },
  {
    id: 5,
    title: "電話行銷的黃金 30 秒：開場白決定一切",
    category: "銷售技巧",
    summary:
      "電話響起的前 30 秒決定客戶是否願意繼續聽下去。好的開場白應包含：自我介紹、價值主張、開放式問題。避免一開口就推銷產品，而是先創造對話的理由。本文提供 5 種經過驗證的開場白模板。",
    source: "銷售加速器",
    date: "2026/03/26",
    link: "#",
    takeaways: [
      "開場先提供價值，而非索取時間",
      "用客戶的產業痛點作為切入點",
      "準備 3 種以上開場白應對不同情境",
    ],
  },
  {
    id: 6,
    title: "處理「太貴了」異議的 5 種方法",
    category: "銷售技巧",
    summary:
      "「太貴了」是業務最常聽到的異議。但價格異議往往不是真正的問題，背後可能是信任不足、價值未被認知、或預算確實有限。學會區分這三種情況，並用對應的策略化解，是成交的關鍵。",
    source: "Top Sales Magazine",
    date: "2026/03/24",
    link: "#",
    takeaways: [
      "先確認是真異議還是煙霧彈",
      "用「成本 vs 價值」重新框架對話",
      "提供分期或方案比較降低決策門檻",
    ],
  },
  {
    id: 7,
    title: "從邀約到成交：Demo 的關鍵轉化點",
    category: "銷售技巧",
    summary:
      "Demo 不是產品展示，而是解決方案的演示。成功的 Demo 應該聚焦在客戶的痛點上，而非功能的炫技。本文分析了 200 場 Demo 的數據，找出影響成交率的 3 個關鍵轉化點。",
    source: "SaaS 銷售研究所",
    date: "2026/03/20",
    link: "#",
    takeaways: [
      "Demo 前先做需求確認，命中率提升 40%",
      "前 5 分鐘展示最高價值功能",
      "Demo 結束前設定明確的下一步行動",
    ],
  },
  {
    id: 8,
    title: "客戶說「我要想想」？3 步化解拖延",
    category: "銷售技巧",
    summary:
      "「讓我想想」是最常見的拖延話術。頂尖業務不會就此放棄，而是用三個步驟化解：確認疑慮、量化拖延成本、設定回訪時間。關鍵是不讓對話在模糊中結束，而是創造一個具體的下一步。",
    source: "成交心理學",
    date: "2026/03/18",
    link: "#",
    takeaways: [
      "直接問：「您主要在考慮哪個部分？」",
      "量化等待的機會成本讓客戶感受緊迫性",
      "當場約定下次聯繫時間，避免對話斷裂",
    ],
  },
  // 心態建設
  {
    id: 9,
    title: "業務新人的第一週：如何度過挫折期",
    category: "心態建設",
    summary:
      "業務新人第一週往往是最容易放棄的時期。面對陌生的產品、拒絕的客戶、和達不到的 KPI，心態崩潰是正常的。本文採訪了 10 位年收百萬的業務前輩，分享他們當初是如何撐過第一週的。",
    source: "職場新鮮人",
    date: "2026/03/29",
    link: "#",
    takeaways: [
      "設定「學習目標」而非「業績目標」",
      "每天記錄 3 件做得好的事情",
      "找到一位願意帶你的學長姐是關鍵",
    ],
  },
  {
    id: 10,
    title: "被拒絕 100 次後的心態重建",
    category: "心態建設",
    summary:
      "拒絕是業務工作的日常，但如何面對拒絕決定了你能走多遠。心理學研究顯示，將「被拒絕」重新定義為「篩選」能大幅降低情緒衝擊。每一次拒絕都在幫你篩選出真正需要你的客戶。",
    source: "心理韌性研究所",
    date: "2026/03/23",
    link: "#",
    takeaways: [
      "拒絕是「篩選」而非「否定」",
      "記錄拒絕原因，找出可改善的模式",
      "設定每日拒絕配額，將恐懼轉為遊戲",
    ],
  },
  {
    id: 11,
    title: "為什麼頂尖業務都是早起的人",
    category: "心態建設",
    summary:
      "研究顯示 78% 的頂尖業務有固定的晨間習慣。早起不只是紀律的展現，更是為一天的高效工作做好心理和身體的準備。本文分享 5 位百萬業務的晨間 routine，以及如何建立屬於自己的早起系統。",
    source: "高效能業務",
    date: "2026/03/15",
    link: "#",
    takeaways: [
      "晨間 30 分鐘的規劃能提升全天效率 25%",
      "運動 + 閱讀 + 目標確認是最常見的三件套",
      "從提早 15 分鐘開始，不要一次調整太多",
    ],
  },
  // 產業趨勢
  {
    id: 12,
    title: "線上理財教育市場 2026 展望",
    category: "產業趨勢",
    summary:
      "全球線上理財教育市場預估 2026 年將達到 150 億美元，年成長率 18%。台灣市場也快速崛起，從 YouTube 財經頻道到付費課程平台，投資人的學習方式正在改變。這對金融產品業務來說既是挑戰也是機會。",
    source: "數位金融觀察",
    date: "2026/03/30",
    link: "#",
    takeaways: [
      "客戶越來越懂，業務必須更專業",
      "內容行銷成為獲客的重要管道",
      "建立個人品牌的業務成交率高出 3 倍",
    ],
  },
  {
    id: 13,
    title: "Z 世代的投資行為：從 TikTok 理財到專業學習",
    category: "產業趨勢",
    summary:
      "Z 世代（1997-2012 年出生）正成為投資市場的新主力。他們從社群媒體接觸理財知識，偏好低門檻的投資工具，但也逐漸轉向專業化學習。了解這群客戶的行為特徵，是未來業務開發的關鍵。",
    source: "未來商業",
    date: "2026/03/21",
    link: "#",
    takeaways: [
      "Z 世代偏好影音內容勝過文字說明",
      "「體驗式銷售」比傳統話術更有效",
      "社群媒體經營是接觸年輕客戶的必要投資",
    ],
  },
  // 成功案例
  {
    id: 14,
    title: "從月薪 3 萬到年收百萬：業務轉型之路",
    category: "成功案例",
    summary:
      "小陳原本是行政人員，月薪 3 萬出頭。轉職業務後的前三個月幾乎零成交，但他沒有放棄。透過系統化學習、大量實戰、和持續覆盤，第一年就達成年收百萬。他的故事證明：業務能力是可以被訓練的。",
    source: "業務人生",
    date: "2026/03/31",
    link: "#",
    takeaways: [
      "每天回聽自己的電話錄音，找出改善點",
      "建立客戶管理系統，不漏掉任何跟進",
      "投資自己的學習，ROI 是所有投資中最高的",
    ],
    featured: true,
  },
  {
    id: 15,
    title: "新人第一個月就成交：他做對了什麼？",
    category: "成功案例",
    summary:
      "大部分業務新人需要 2-3 個月才能拿到第一張訂單，但 Alex 第一個月就成交了 3 筆。秘訣不是天賦，而是方法：他在入職前就研究了 50 個客戶案例，入職後每天比別人多打 20 通電話，並且嚴格執行師傅教的銷售流程。",
    source: "新人破蛋日記",
    date: "2026/03/19",
    link: "#",
    takeaways: [
      "入職前的準備功課決定了起跑速度",
      "量大是成交的基礎，質量再慢慢提升",
      "100% 執行標準流程比自創話術更有效",
    ],
  },
  {
    id: 16,
    title: "ESG 投資浪潮：綠色金融商品的銷售機會",
    category: "產業趨勢",
    summary:
      "ESG（環境、社會、治理）投資在台灣快速成長，2026 年 ESG 相關基金規模突破千億。越來越多投資人在追求報酬的同時，也關注企業的社會責任。這為業務人員打開了全新的對話切入點。",
    source: "綠色金融報",
    date: "2026/03/17",
    link: "#",
    takeaways: [
      "ESG 基金近三年平均報酬不輸傳統基金",
      "年輕客群對 ESG 議題接受度最高",
      "用「價值觀投資」角度切入能提升客戶認同感",
    ],
  },
];

/* ───── component ───── */
export default function ArticlesPage() {
  const [activeCategory, setActiveCategory] = useState<Category | "全部">("全部");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let list = ARTICLES;
    if (activeCategory !== "全部") {
      list = list.filter((a) => a.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.takeaways.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeCategory, searchQuery]);

  const featuredArticles = ARTICLES.filter((a) => a.featured).slice(0, 3);

  const recommendedArticles = ARTICLES.filter(
    (a) => a.category === "銷售技巧" || a.category === "心態建設"
  ).slice(0, 3);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "var(--bg2)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Auto-refresh banner */}
        <div
          style={{
            background: "linear-gradient(90deg, var(--accent), var(--teal))",
            padding: "6px 16px",
            fontSize: 13,
            textAlign: "center",
            color: "#fff",
            fontWeight: 500,
            letterSpacing: 0.5,
          }}
        >
          📡 內容每日自動更新 · 上次更新: 2026/04/01
        </div>

        {/* Header */}
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
          className="articles-header-inner"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--text2)",
                textDecoration: "none",
                fontSize: 14,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text)";
                e.currentTarget.style.borderColor = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text2)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              ← 返回學院
            </Link>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                業務專欄
              </h1>
              <p style={{ fontSize: 13, color: "var(--text3)", margin: 0, marginTop: 2 }}>
                精選文章，助你成為頂尖業務
              </p>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: "relative", minWidth: 240, maxWidth: 360, flex: 1 }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text3)",
                fontSize: 16,
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="搜尋文章..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 16px 10px 38px",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>
        </div>

        {/* Category tabs */}
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px 12px",
            display: "flex",
            gap: 8,
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {(["全部", ...CATEGORIES] as const).map((cat) => {
            const isActive = activeCategory === cat;
            const color = cat === "全部" ? "var(--accent)" : CATEGORY_COLORS[cat as Category];
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as Category | "全部")}
                style={{
                  padding: "8px 18px",
                  borderRadius: 20,
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s",
                  background: isActive ? color : "var(--card)",
                  color: isActive ? "#fff" : "var(--text2)",
                  boxShadow: isActive ? `0 2px 12px ${color}44` : "none",
                }}
              >
                {cat}
                {cat !== "全部" && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 12,
                      opacity: 0.7,
                    }}
                  >
                    {ARTICLES.filter((a) => a.category === cat).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div
        className="articles-grid"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px",
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left: article list */}
        <div>
          {filtered.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "var(--text3)",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <div style={{ fontSize: 16 }}>找不到符合條件的文章</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>試試其他關鍵字或分類</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {filtered.map((article, idx) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  index={idx}
                  expanded={expandedId === article.id}
                  onToggle={() =>
                    setExpandedId(expandedId === article.id ? null : article.id)
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Featured */}
          <div
            style={{
              background: "var(--card)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              padding: 20,
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--gold)",
                margin: "0 0 16px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              ⭐ 今日精選
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {featuredArticles.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 12,
                    background: "var(--bg2)",
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    border: "1px solid transparent",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "transparent")
                  }
                  onClick={() => setExpandedId(a.id)}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: `linear-gradient(135deg, var(--accent), var(--teal))`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text)",
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {a.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: CATEGORY_COLORS[a.category],
                        marginTop: 4,
                        fontWeight: 500,
                      }}
                    >
                      {a.category}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI recommended */}
          <div
            style={{
              background: "var(--card)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              padding: 20,
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--teal)",
                margin: "0 0 4px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              🤖 AI 為你推薦
            </h3>
            <p style={{ fontSize: 12, color: "var(--text3)", margin: "0 0 14px 0" }}>
              根據你目前的訓練進度推薦
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recommendedArticles.map((a) => (
                <div
                  key={a.id}
                  style={{
                    padding: 12,
                    background: "var(--bg2)",
                    borderRadius: 10,
                    borderLeft: `3px solid ${CATEGORY_COLORS[a.category]}`,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--card2, #212940)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--bg2)")
                  }
                  onClick={() => setExpandedId(a.id)}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text)",
                      lineHeight: 1.4,
                      marginBottom: 4,
                    }}
                  >
                    {a.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>
                    {a.source} · {a.date}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div
            style={{
              background: "var(--card)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              padding: 20,
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text)",
                margin: "0 0 14px 0",
              }}
            >
              📊 專欄統計
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {CATEGORIES.map((cat) => {
                const count = ARTICLES.filter((a) => a.category === cat).length;
                const maxCount = Math.max(
                  ...CATEGORIES.map(
                    (c) => ARTICLES.filter((a) => a.category === c).length
                  )
                );
                return (
                  <div key={cat}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        color: "var(--text2)",
                        marginBottom: 4,
                      }}
                    >
                      <span>{cat}</span>
                      <span>{count} 篇</span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "var(--bg)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${(count / maxCount) * 100}%`,
                          height: "100%",
                          background: CATEGORY_COLORS[cat],
                          borderRadius: 3,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: AI recommendation section */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px 40px",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, var(--card) 0%, var(--bg2) 100%)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                background: "linear-gradient(135deg, var(--accent), var(--teal))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              AI 學習建議
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--text3)",
                background: "var(--bg)",
                padding: "4px 10px",
                borderRadius: 12,
              }}
            >
              依據你的訓練天數推薦
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {[
              {
                phase: "第 1-3 天",
                focus: "心態建設 + 基礎知識",
                articles: ["業務新人的第一週：如何度過挫折期", "ETF 投資新手指南"],
                color: "var(--gold)",
              },
              {
                phase: "第 4-7 天",
                focus: "銷售技巧 + 實戰演練",
                articles: ["SPIN 銷售法", "電話行銷的黃金 30 秒"],
                color: "var(--teal)",
              },
              {
                phase: "第 8-14 天",
                focus: "進階成交 + 案例學習",
                articles: ["處理「太貴了」異議的 5 種方法", "從月薪 3 萬到年收百萬"],
                color: "var(--accent)",
              },
            ].map((phase) => (
              <div
                key={phase.phase}
                style={{
                  background: "var(--bg)",
                  borderRadius: 12,
                  padding: 18,
                  borderLeft: `3px solid ${phase.color}`,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: phase.color,
                    marginBottom: 4,
                  }}
                >
                  {phase.phase}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text2)",
                    marginBottom: 10,
                  }}
                >
                  重點：{phase.focus}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {phase.articles.map((title) => (
                    <div
                      key={title}
                      style={{
                        fontSize: 12,
                        color: "var(--text3)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ color: phase.color }}>→</span>
                      {title}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .articles-grid {
            grid-template-columns: 1fr !important;
          }
          .articles-header-inner {
            flex-direction: column;
            align-items: stretch !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ───── Article Card ───── */
function ArticleCard({
  article,
  index,
  expanded,
  onToggle,
}: {
  article: Article;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const catColor = CATEGORY_COLORS[article.category];

  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: 16,
        border: "1px solid var(--border)",
        padding: 22,
        transition: "all 0.25s ease",
        animation: `fadeIn 0.4s ease-out ${index * 0.05}s both`,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = catColor;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 24px ${catColor}18`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
      onClick={onToggle}
    >
      {/* Top row: category + date */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: catColor,
            background: `${catColor}18`,
            padding: "4px 12px",
            borderRadius: 12,
            letterSpacing: 0.3,
          }}
        >
          {article.category}
        </span>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>
          {article.source} · {article.date}
        </span>
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: "var(--text)",
          margin: "0 0 10px 0",
          lineHeight: 1.5,
        }}
      >
        {article.title}
      </h3>

      {/* Summary */}
      <p
        style={{
          fontSize: 14,
          color: "var(--text2)",
          lineHeight: 1.7,
          margin: "0 0 14px 0",
        }}
      >
        {article.summary}
      </p>

      {/* Takeaways (expanded) */}
      {expanded && (
        <div
          style={{
            background: "var(--bg2)",
            borderRadius: 10,
            padding: 16,
            marginBottom: 14,
            borderLeft: `3px solid ${catColor}`,
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: catColor,
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            💡 AI 重點摘要
          </div>
          {article.takeaways.map((t, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 8,
                fontSize: 13,
                color: "var(--text2)",
                lineHeight: 1.6,
                marginBottom: i < article.takeaways.length - 1 ? 8 : 0,
              }}
            >
              <span style={{ color: catColor, flexShrink: 0 }}>•</span>
              {t}
            </div>
          ))}
        </div>
      )}

      {/* Bottom row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          style={{
            fontSize: 13,
            color: catColor,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {expanded ? "收起" : "閱讀更多 →"}
        </button>
        {article.featured && (
          <span
            style={{
              fontSize: 11,
              color: "var(--gold)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ⭐ 精選
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * RAG 池 helper — role → pillar mapping + retrieval filter
 *
 * Vincent 2026-05-01 拍板:HR 體系全砍 + 依 system-tree 走。
 * RAG 池只剩 sales / legal / common 三種;'hr' 保留在 type union 是為了向後相容
 * 既有 DB row(D19 已 reclassify hr → common,但保留 string 兼容)。
 *
 * 設計:
 *   - 有效 pillar:legal / sales / common
 *   - 'hr' deprecated:不再有新 hr 內容,既有 22 chunks 已改 pillar='common'
 *   - role → 可看的 pillar 清單(common 永遠可見)
 *   - allowed_roles[] 額外 ACL(細粒度)
 */

export type Pillar = "legal" | "sales" | "common" | "hr"; // 'hr' deprecated 2026-05-01,留型兼容既有 DB 資料

/** Role → 該 role 可看的 pillar 清單(common 自動可見)*/
const ROLE_PILLAR_MAP: Record<string, Pillar[]> = {
  // 業務體系
  sales_rep: ["sales", "common"],
  sales_rookie: ["sales", "common"],
  sales_manager: ["sales", "common"],

  // 招募類 role(架構沒 HR pillar,合併至 common)
  recruiter: ["common"],
  hr: ["common"],
  recruit_manager: ["common"],

  // 法務體系
  legal_staff: ["legal", "common"],
  legal_manager: ["legal", "common"],

  // 跨 pillar(中層)
  brand_manager: ["sales", "common"],
  team_leader: ["sales", "common"],
  trainer: ["sales", "common"], // 訓練師對業務 + 通用(HR 已砍)
  mentor: ["sales", "common"],

  // 學員
  student: ["common"],

  // 高層(全看 — sales + legal + common)
  super_admin: ["legal", "sales", "common"],
  ceo: ["legal", "sales", "common"],
  coo: ["legal", "sales", "common"],
  cfo: ["legal", "sales", "common"],
  director: ["legal", "sales", "common"],
};

const DEFAULT_PILLARS: Pillar[] = ["common"];

export function getRolePillars(role: string | null | undefined): Pillar[] {
  if (!role) return DEFAULT_PILLARS;
  return ROLE_PILLAR_MAP[role] || DEFAULT_PILLARS;
}

/**
 * 從本機 training md 路徑推斷 pillar
 *
 * 規則(2026-05-01 後):
 *   content/training/legal/        → legal
 *   content/training/sales/        → sales (新建)
 *   content/training/foundation/   → common
 *   其他                          → common(safe default)
 *
 * (legacy hrbp_series 路徑 2026-05-01 已砍,如果遇到舊資料 fallback common)
 */
export function inferPillarFromPath(filePath: string): Pillar {
  const lower = filePath.toLowerCase().replace(/\\/g, "/");
  if (/\/legal\//.test(lower)) return "legal";
  if (/\/sales\//.test(lower)) return "sales";
  return "common";
}

/**
 * 從 Notion database id 推斷 pillar
 *
 * (僅 legal/sales 是有效新值;舊 hr config 視為 common)
 */
export function pillarFromNotionDbId(
  dbId: string,
  dbConfigs: Array<{ id: string; notion_database_id: string | null }>,
): Pillar {
  const found = dbConfigs.find((c) => c.notion_database_id === dbId);
  if (found && (found.id === "legal" || found.id === "sales")) {
    return found.id as Pillar;
  }
  return "common";
}

/**
 * 對 supabase chunks query 加 pillar + allowed_roles filter
 */
export function applyPillarFilter<
  T extends { in: (col: string, vals: unknown[]) => T; or: (filter: string) => T },
>(query: T, userRole: string | null | undefined): T {
  const pillars = getRolePillars(userRole);
  query = query.in("pillar", pillars);
  if (userRole) {
    query = query.or(`allowed_roles.is.null,allowed_roles.cs.{${userRole}}`);
  } else {
    query = query.or("allowed_roles.is.null");
  }
  return query;
}

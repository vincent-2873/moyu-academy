/**
 * RAG 三池 helper — role → pillar mapping + retrieval filter
 *
 * Vincent 2026-04-30 反饋:RAG 要分 HR / 法務 / 業務 3 個 namespace
 *
 * 設計:
 *   - pillar 4 種:hr / legal / sales / common
 *   - role → 可看的 pillar 清單(common 永遠可見)
 *   - allowed_roles[] 額外 ACL(細粒度,e.g. 公司年度策略 限 ceo/director)
 */

export type Pillar = "hr" | "legal" | "sales" | "common";

/** Role → 該 role 可看的 pillar 清單(common 自動加入) */
const ROLE_PILLAR_MAP: Record<string, Pillar[]> = {
  // 員工層級
  sales_rep: ["sales", "common"],
  sales_rookie: ["sales", "common"],
  sales_manager: ["sales", "common"],

  recruiter: ["hr", "common"],
  hr: ["hr", "common"],
  recruit_manager: ["hr", "common"],

  legal_staff: ["legal", "common"],
  legal_manager: ["legal", "common"],

  // 跨 pillar(中層)
  brand_manager: ["sales", "common"],     // 業務管理 — 只看自己 brand
  team_leader: ["sales", "common"],
  trainer: ["hr", "sales", "common"],     // 訓練師需要看員工資料
  mentor: ["hr", "sales", "common"],

  // 學員(只看 common training material)
  student: ["common"],

  // 高層(全看)
  super_admin: ["hr", "legal", "sales", "common"],
  ceo: ["hr", "legal", "sales", "common"],
  coo: ["hr", "legal", "sales", "common"],
  cfo: ["hr", "legal", "sales", "common"],
  director: ["hr", "legal", "sales", "common"],
};

const DEFAULT_PILLARS: Pillar[] = ["common"];

/** 取出該 role 可看的 pillar 清單 */
export function getRolePillars(role: string | null | undefined): Pillar[] {
  if (!role) return DEFAULT_PILLARS;
  return ROLE_PILLAR_MAP[role] || DEFAULT_PILLARS;
}

/**
 * 從本機 training md 路徑推斷 pillar
 *
 * 規則:
 *   content/training/hrbp_series/  → hr
 *   content/training/legal/        → legal
 *   content/training/sales/        → sales (新建)
 *   content/training/foundation/   → common
 *   content/training/source_materials/ → common
 *   其他                          → common(safe default)
 */
export function inferPillarFromPath(filePath: string): Pillar {
  const lower = filePath.toLowerCase().replace(/\\/g, "/");
  if (/\/hrbp_series\//.test(lower) || /\/hr\//.test(lower)) return "hr";
  if (/\/legal\//.test(lower)) return "legal";
  if (/\/sales\//.test(lower)) return "sales";
  return "common";
}

/**
 * 從 Notion database id 推斷 pillar(由 rag_notion_config 表查 — caller 應 pre-fetch)
 *
 * Caller pattern:
 *   const cfg = await sb.from('rag_notion_config').select('id').eq('notion_database_id', dbId).maybeSingle();
 *   const pillar = (cfg?.data?.id as Pillar) || 'common';
 */
export function pillarFromNotionDbId(dbId: string, dbConfigs: Array<{ id: string; notion_database_id: string | null }>): Pillar {
  const found = dbConfigs.find((c) => c.notion_database_id === dbId);
  if (found && (found.id === "hr" || found.id === "legal" || found.id === "sales")) {
    return found.id as Pillar;
  }
  return "common";
}

/**
 * 對 supabase chunks query 加 pillar + allowed_roles filter
 *
 * 用法:
 *   let q = sb.from('knowledge_chunks').select(...);
 *   q = applyPillarFilter(q, userRole);
 *   const { data } = await q;
 */
export function applyPillarFilter<T extends { in: (col: string, vals: unknown[]) => T; or: (filter: string) => T }>(
  query: T,
  userRole: string | null | undefined
): T {
  const pillars = getRolePillars(userRole);
  // pillar IN (...)
  query = query.in("pillar", pillars);
  // allowed_roles IS NULL OR userRole = ANY(allowed_roles)
  // Postgrest format: 'allowed_roles.is.null,allowed_roles.cs.{role}'
  if (userRole) {
    query = query.or(`allowed_roles.is.null,allowed_roles.cs.{${userRole}}`);
  } else {
    query = query.or("allowed_roles.is.null");
  }
  return query;
}

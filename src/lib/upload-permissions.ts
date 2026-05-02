/**
 * 2026-04-30 第三輪 末段:RAG 上傳權限控制
 * 2026-05-02 Wave 8 cleanup:HR/招募 全砍,移除 recruit_manager
 *
 * Vincent 反饋:只有以下 3 種 role 可以上傳到 RAG:
 *   - super_admin(超級管理員)
 *   - sales_manager(業務管理)
 *   - legal_manager(法務管理)
 *
 * 適用所有上傳模式:admin / staff / self(任何 source 都要 role check)
 *
 * 設計理由:
 *   - 員工亂上傳會污染 RAG 池
 *   - 3 個 role 就是各 pillar 的負責人 + super_admin
 */

export const RAG_UPLOAD_ROLES = new Set([
  "super_admin",
  "sales_manager",
  "legal_manager",
]);

export function canUploadRag(role: string | null | undefined): boolean {
  if (!role) return false;
  return RAG_UPLOAD_ROLES.has(role);
}

export const RAG_UPLOAD_ROLE_LABELS: Record<string, string> = {
  super_admin: "超級管理員",
  sales_manager: "業務主管",
  legal_manager: "法務主管",
};

export function uploadDeniedReason(role: string | null | undefined): string {
  if (!role) return "未登入,請先登入";
  return `你的角色 (${role}) 沒有上傳 RAG 權限。只有以下 role 可上傳:${Array.from(RAG_UPLOAD_ROLES).join(" / ")}`;
}

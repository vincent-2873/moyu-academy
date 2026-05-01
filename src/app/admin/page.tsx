// 後台根入口(2026-05-01 大砍重建後)
// 進 /admin → redirect 到投資人中心 default landing(對齊 system-tree v2)

import { redirect } from "next/navigation";

export default function AdminRoot() {
  redirect("/admin/board/quarterly");
}

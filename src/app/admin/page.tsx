// 後台根入口 — 進 /admin → 直接跳業務戰況
// (Vincent 2026-05-02 拍板:default landing 改成最常用的業務戰況,不要看空白 quarterly)

import { redirect } from "next/navigation";

export default function AdminRoot() {
  redirect("/admin/sales/dashboard");
}

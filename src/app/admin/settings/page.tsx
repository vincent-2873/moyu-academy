import { redirect } from "next/navigation";

export default function AdminSettingsRoot() {
  redirect("/admin/settings/people");
}

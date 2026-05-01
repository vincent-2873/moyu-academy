"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function AdminSettingsRoot() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/settings/people"); }, [router]);
  return null;
}

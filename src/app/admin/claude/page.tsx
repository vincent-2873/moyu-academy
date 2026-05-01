"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function AdminClaudeRoot() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/claude/live"); }, [router]);
  return null;
}

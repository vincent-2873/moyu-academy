"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function AdminLegalRoot() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/legal/cases"); }, [router]);
  return null;
}

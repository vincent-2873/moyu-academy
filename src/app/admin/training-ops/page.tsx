"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function AdminTrainingOpsRoot() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/training-ops/students"); }, [router]);
  return null;
}

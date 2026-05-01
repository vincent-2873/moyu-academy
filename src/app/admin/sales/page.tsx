"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function AdminSalesRoot() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/sales/dashboard"); }, [router]);
  return null;
}

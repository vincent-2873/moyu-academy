"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function AdminHumanRoot() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/human/sos"); }, [router]);
  return null;
}

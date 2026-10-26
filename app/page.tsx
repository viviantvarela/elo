"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { firstAccessibleHref } from "@/lib/constants";
import { useCurrentUser } from "@/lib/current-user";

/**
 * Entra pela primeira página do menu de quem está usando o Elo — a maioria
 * cai em "/painel", mas um papel sem painel (ex.: professor) cai direto na
 * primeira página que ele enxerga, em vez de esbarrar num "sem acesso".
 */
export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (isLoading) return;
    router.replace(firstAccessibleHref(user?.role ?? "coordinator"));
  }, [isLoading, user?.role, router]);

  return null;
}

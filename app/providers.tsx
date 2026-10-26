"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

import { useSupabaseAuthSync } from "@/lib/current-user";
import { useUi } from "@/store/ui";

function AuthSync() {
  useSupabaseAuthSync();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const hydrate = useUi((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={client}>
      <AuthSync />
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            borderRadius: "14px",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontSize: "13px",
          },
        }}
      />
    </QueryClientProvider>
  );
}

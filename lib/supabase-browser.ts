"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let persistBrowserSession = true;

export function isSupabaseClientConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isDemoModeEnabled() {
  return process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
}

export function setSupabaseSessionPersistence(persist: boolean) {
  if (persistBrowserSession === persist) return;
  persistBrowserSession = persist;
  browserClient = null;
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseClientConfigured()) return null;
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      {
        auth: {
          persistSession: persistBrowserSession,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  }
  return browserClient;
}

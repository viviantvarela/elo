import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Role } from "../types";
import type { Database } from "./seed";

export interface VerifiedAuthUser {
  id: string;
  email: string;
  metadata: Record<string, unknown>;
}

export interface Actor {
  mode: "supabase" | "demo";
  role: Role;
  studentId?: string;
  monitorId?: string;
  email?: string;
}

export function isDemoAllowed() {
  return process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
}

function parseBearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

function decodeJwtPayloadDevOnly(token: string, expectedUrl: string): VerifiedAuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(json) as {
      sub?: string;
      email?: string;
      iss?: string;
      exp?: number;
      user_metadata?: Record<string, unknown>;
    };
    const expectedIss = `${expectedUrl.replace(/\/$/, "")}/auth/v1`;
    if (!payload.sub || !payload.email) return null;
    if (payload.iss !== expectedIss) return null;
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return {
      id: payload.sub,
      email: payload.email.toLowerCase(),
      metadata: payload.user_metadata ?? {},
    };
  } catch {
    return null;
  }
}

export async function verifySupabaseToken(token: string): Promise<VerifiedAuthUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user?.email) return null;
    return {
      id: data.user.id,
      email: data.user.email.toLowerCase(),
      metadata: (data.user.user_metadata as Record<string, unknown>) ?? {},
    };
  } catch (error) {
    // Apenas em ambiente de desenvolvimento isolado sem saída de rede externa
    // (ex.: sandbox local), aceita claims emitidos pelo projeto configurado.
    // Em produção (`NODE_ENV === "production"`), exige verificação online no GoTrue.
    if (process.env.NODE_ENV !== "production") {
      const message = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : "";
      if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
        return decodeJwtPayloadDevOnly(token, url);
      }
    }
    return null;
  }
}

export function mapAuthUserToActor(authUser: VerifiedAuthUser, db: Database): Actor | null {
  const email = authUser.email.toLowerCase();

  const linked = db.accounts.find((acc) => acc.email.toLowerCase() === email);
  if (linked) {
    if (linked.role === "coordinator") {
      return { mode: "supabase", role: "coordinator", email };
    }
    if (linked.role === "monitor" && linked.monitorId && db.monitors.some((m) => m.id === linked.monitorId)) {
      return { mode: "supabase", role: "monitor", monitorId: linked.monitorId, email };
    }
    if (linked.role === "student" && linked.studentId && db.students.some((s) => s.id === linked.studentId)) {
      return { mode: "supabase", role: "student", studentId: linked.studentId, email };
    }
  }

  if (db.profile.email && db.profile.email.toLowerCase() === email) {
    return { mode: "supabase", role: "coordinator", email };
  }

  const monitor = db.monitors.find((m) => m.email?.toLowerCase() === email);
  if (monitor) {
    return { mode: "supabase", role: "monitor", monitorId: monitor.id, email };
  }

  const student = db.students.find((s) => s.email?.toLowerCase() === email);
  if (student) {
    return { mode: "supabase", role: "student", studentId: student.id, email };
  }

  return null;
}

export async function resolveActor(request: Request, db: Database): Promise<Actor | null> {
  const token = parseBearer(request);
  if (token) {
    const authUser = await verifySupabaseToken(token);
    if (!authUser) return null;
    return mapAuthUserToActor(authUser, db);
  }

  if (!isDemoAllowed()) {
    return null;
  }

  const rawActor = request.headers.get("x-elo-actor")?.trim() ?? "";
  if (!rawActor || rawActor === "coordinator") {
    return { mode: "demo", role: "coordinator" };
  }

  const [rolePart, idPart] = rawActor.split(":");
  if (rolePart === "student") {
    const student = db.students.find((s) => s.id === idPart) ?? db.students[0];
    if (!student) return null;
    return { mode: "demo", role: "student", studentId: student.id };
  }
  if (rolePart === "monitor") {
    const monitor = db.monitors.find((m) => m.id === idPart) ?? db.monitors[0];
    if (!monitor) return null;
    return { mode: "demo", role: "monitor", monitorId: monitor.id };
  }

  return { mode: "demo", role: "coordinator" };
}

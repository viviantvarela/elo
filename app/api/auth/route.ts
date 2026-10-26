import { badRequest, forbidden, ok, readJson, serverError, unauthorized } from "@/lib/server/http";
import { isDemoAllowed, mapAuthUserToActor, resolveActor, verifySupabaseToken } from "@/lib/server/auth";
import { readDb, updateDb } from "@/lib/server/db";
import { nextId } from "@/lib/server/repository";
import { cleanText, isInstitutionalEmail, sanitizePastel } from "@/lib/server/validate";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SyncPayload {
  name?: string;
  className?: string;
  course?: string;
  campus?: string;
  desiredRole?: Role;
  guardianConsent?: boolean;
  acceptConsent?: boolean;
}

export async function GET(request: Request) {
  try {
    const db = await readDb();
    const actor = await resolveActor(request, db);
    return ok({
      supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      demoEnabled: isDemoAllowed(),
      actor,
    });
  } catch {
    return serverError("Não foi possível verificar a sessão.");
  }
}

/**
 * Sincroniza um usuário autenticado no Supabase Auth com o cadastro do Elo:
 *  - Se já existir vínculo em `elo_accounts` (ou por e-mail em perfil/monitores/estudantes), reutiliza
 *  - Se for novo cadastro institucional, cria o registro correspondente e salva o vínculo
 */
export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim();
  if (!token) return unauthorized("Token de autenticação ausente.");

  const authUser = await verifySupabaseToken(token);
  if (!authUser) return unauthorized("Sessão do Supabase inválida ou expirada.");

  const body = (await readJson<SyncPayload>(request)) ?? {};
  const email = authUser.email.toLowerCase();

  try {
    const current = await readDb();
    const existingActor = mapAuthUserToActor(authUser, current);

    const meta = authUser.metadata;
    const rawName = cleanText(body.name ?? meta.name, 80);
    const rawClass = cleanText(body.className ?? meta.className, 60);
    const rawCourse = cleanText(body.course ?? meta.course, 60);
    const rawCampus = cleanText(body.campus ?? meta.campus, 80);
    const desiredRole: Role =
      body.desiredRole === "coordinator" || meta.desiredRole === "coordinator" ? "coordinator" : "student";

    if (!existingActor && !isInstitutionalEmail(email)) {
      return forbidden("Use seu e-mail institucional do IFRN (@escolar.ifrn.edu.br ou @ifrn.edu.br).");
    }

    const db = await updateDb((draft) => {
      const nowIso = new Date().toISOString();

      // 1) Se já existe monitor com este e-mail, garante vínculo em `accounts`
      const monitor = draft.monitors.find((m) => m.email?.toLowerCase() === email);
      if (monitor) {
        if (rawName && !monitor.name) monitor.name = rawName;
        const acc = draft.accounts.find((a) => a.email.toLowerCase() === email);
        if (acc) {
          acc.authUserId = authUser.id;
          acc.role = "monitor";
          acc.monitorId = monitor.id;
        } else {
          draft.accounts.push({
            email,
            authUserId: authUser.id,
            role: "monitor",
            monitorId: monitor.id,
            createdAt: nowIso,
          });
        }
        return;
      }

      // 2) Conta da coordenação: se o e-mail já é da coordenação OU se não há
      //    coordenador cadastrado ainda e o usuário é servidor (@ifrn.edu.br)
      const isStaffDomain = email.endsWith("@ifrn.edu.br") && !email.endsWith("@escolar.ifrn.edu.br");
      const hasCoordinator =
        Boolean(draft.profile.email) || draft.accounts.some((a) => a.role === "coordinator");

      if (
        draft.profile.email?.toLowerCase() === email ||
        draft.accounts.some((a) => a.email.toLowerCase() === email && a.role === "coordinator") ||
        (desiredRole === "coordinator" && isStaffDomain && !hasCoordinator)
      ) {
        if (rawName && !draft.profile.name) draft.profile.name = rawName;
        if (!draft.profile.email) draft.profile.email = email;
        if (rawClass) draft.profile.className = rawClass;
        if (rawCampus) draft.profile.campus = rawCampus;

        const acc = draft.accounts.find((a) => a.email.toLowerCase() === email);
        if (acc) {
          acc.authUserId = authUser.id;
          acc.role = "coordinator";
        } else {
          draft.accounts.push({
            email,
            authUserId: authUser.id,
            role: "coordinator",
            createdAt: nowIso,
          });
        }
        return;
      }

      // 3) Estudante: vincula existente pelo e-mail ou cria registro novo
      let student = draft.students.find(
        (s) =>
          s.email?.toLowerCase() === email ||
          draft.accounts.some((a) => a.email.toLowerCase() === email && a.studentId === s.id),
      );

      if (!student) {
        const fallbackName = email
          .split("@")[0]
          .split(/[._-]+/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");

        student = {
          id: nextId("a", draft.students),
          name: rawName || fallbackName || "Estudante IFRN",
          className: rawClass || "1º ano INFO",
          course: rawCourse || "Informática",
          color: sanitizePastel(["peach", "blue", "sage", "sand", "lilac"][draft.students.length % 5]),
          guardianConsent: Boolean(body.guardianConsent ?? meta.guardianConsent ?? true),
          email,
          consentAcceptedAt: body.acceptConsent || meta.acceptConsent ? nowIso : undefined,
        };
        draft.students.push(student);
      } else if (body.acceptConsent && !student.consentAcceptedAt) {
        student.consentAcceptedAt = nowIso;
      }

      const acc = draft.accounts.find((a) => a.email.toLowerCase() === email);
      if (acc) {
        acc.authUserId = authUser.id;
        acc.role = "student";
        acc.studentId = student.id;
      } else {
        draft.accounts.push({
          email,
          authUserId: authUser.id,
          role: "student",
          studentId: student.id,
          createdAt: nowIso,
        });
      }
    });

    const actor = mapAuthUserToActor(authUser, db);
    if (!actor) return serverError("Conta autenticada, mas não pôde ser vinculada.");

    return ok({ actor });
  } catch {
    return serverError("Não foi possível sincronizar sua conta no Elo.");
  }
}

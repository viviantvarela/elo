import { ok, serverError } from "@/lib/server/http";
import { readDb } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * Quem pode estar usando o Elo: a conta da coordenação, os estudantes e os
 * monitores. Alimenta o menu do usuário e a troca de usuário enquanto não há
 * tela de login.
 */
export async function GET() {
  try {
    const db = await readDb();
    return ok({ coordinator: db.profile, students: db.students, monitors: db.monitors, topics: db.topics });
  } catch {
    return serverError("Não foi possível carregar os usuários.");
  }
}

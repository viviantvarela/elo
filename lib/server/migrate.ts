import { blankCoordinatorProfile, type Database } from "./seed";

/**
 * Ajustes para bases criadas por versões anteriores da semente.
 *
 * Roda em toda leitura (é barato) e o resultado é gravado junto com a próxima
 * escrita — vale para `data/elo.json`, Postgres e Supabase.
 */

/** coordenadora fictícia que vinha fixa na semente antiga (comparação sem caixa) */
export const LEGACY_PROFILE_NAME = "marina duarte";
export const LEGACY_PROFILE_EMAIL = "marina.duarte@ifrn.edu.br";

export function migrate(database: Database): Database {
  if (!Array.isArray(database.accounts)) {
    database.accounts = [];
  }

  if (!database.profile) {
    database.profile = blankCoordinatorProfile();
    return database;
  }

  const profile = database.profile;

  // A conta da coordenação começa em branco e é preenchida por quem usa o Elo;
  // bases antigas ainda guardam a pessoa fictícia da semente.
  if ((profile.name ?? "").trim().toLowerCase() === LEGACY_PROFILE_NAME) profile.name = "";
  if ((profile.email ?? "").trim().toLowerCase() === LEGACY_PROFILE_EMAIL) profile.email = "";

  profile.role = "coordinator";
  profile.coordinatorView = true;

  return database;
}

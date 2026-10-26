import { blankCoordinatorProfile, type Database } from "./seed";

/**
 * Ajustes para bases criadas por versões anteriores da semente.
 *
 * Roda em toda leitura (é barato) e o resultado é gravado junto com a próxima
 * escrita — vale tanto para `data/elo.json` quanto para o Postgres (Neon).
 */

/** coordenadora fictícia que vinha fixa na semente antiga (comparação sem caixa) */
export const LEGACY_PROFILE_NAME = "marina duarte";
export const LEGACY_PROFILE_EMAIL = "marina.duarte@ifrn.edu.br";

export function migrate(database: Database): Database {
  // bases gravadas antes do Espaço de alinhamento (professor ↔ monitor) não têm estas listas
  if (!database.teachers) database.teachers = [];
  if (!database.alignmentMessages) database.alignmentMessages = [];
  if (!database.alignmentMeetings) database.alignmentMeetings = [];

  if (!database.profile) {
    database.profile = blankCoordinatorProfile();
    return database;
  }

  const profile = database.profile;

  // A conta da coordenação agora começa em branco e é preenchida por quem usa
  // o Elo; bases antigas ainda guardam a pessoa fictícia da semente.
  if ((profile.name ?? "").trim().toLowerCase() === LEGACY_PROFILE_NAME) profile.name = "";
  if ((profile.email ?? "").trim().toLowerCase() === LEGACY_PROFILE_EMAIL) profile.email = "";

  // O perfil salvo é sempre a conta da coordenação. Quem está usando o Elo em
  // cada navegador (estudante, monitor ou coordenação) é escolhido no cliente.
  profile.role = "coordinator";
  profile.coordinatorView = true;

  return database;
}

import "server-only";

/**
 * Integração com a Google Meet REST API (`meet.googleapis.com`).
 *
 * Mesmo padrão de "troca automática" do restante do projeto (ver
 * `lib/server/db.ts`, que troca entre JSON e Postgres pela presença de
 * `DATABASE_URL`): aqui, com `GOOGLE_MEET_CLIENT_ID` + `GOOGLE_MEET_CLIENT_SECRET`
 * + `GOOGLE_MEET_REFRESH_TOKEN` configurados, cada reunião cria um espaço de
 * verdade via API; sem essas variáveis (ou se a chamada falhar), o Elo gera um
 * link de demonstração — a tela deixa claro qual dos dois está em uso.
 *
 * Como configurar a API real (resumo; passo a passo completo no README):
 *  1. Google Cloud Console → crie/abra um projeto, ative a "Google Meet API".
 *  2. Tela de consentimento OAuth + credencial "ID do cliente OAuth" (tipo
 *     "App para computador" funciona bem para gerar o refresh token).
 *  3. Autorize o escopo `https://www.googleapis.com/auth/meetings.space.created`
 *     com uma conta Google (Workspace ou pessoal) e troque o código por um
 *     refresh token (ex.: via OAuth 2.0 Playground do Google).
 *  4. Defina GOOGLE_MEET_CLIENT_ID, GOOGLE_MEET_CLIENT_SECRET e
 *     GOOGLE_MEET_REFRESH_TOKEN nas variáveis de ambiente do deploy.
 *
 * Importante: este sandbox de desenvolvimento não tem saída de rede para
 * `googleapis.com`, então a chamada real não pode ser validada por aqui — o
 * código está pronto para rodar em produção (Vercel ou qualquer ambiente com
 * acesso à internet).
 */

export interface CreatedMeeting {
  meetLink: string;
  meetCode: string;
  provider: "google-meet-api" | "demo";
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SPACES_URL = "https://meet.googleapis.com/v2/spaces";

function env(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

/** Há credenciais suficientes para tentar a API real do Google Meet? */
export function googleMeetConfigured() {
  return Boolean(env("GOOGLE_MEET_CLIENT_ID") && env("GOOGLE_MEET_CLIENT_SECRET") && env("GOOGLE_MEET_REFRESH_TOKEN"));
}

async function getAccessToken(): Promise<string> {
  const clientId = env("GOOGLE_MEET_CLIENT_ID");
  const clientSecret = env("GOOGLE_MEET_CLIENT_SECRET");
  const refreshToken = env("GOOGLE_MEET_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Credenciais do Google Meet não configuradas.");
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha ao renovar o token do Google (${response.status}). ${detail}`.trim());
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Resposta do Google sem access_token.");
  return payload.access_token;
}

/**
 * Cria um espaço de reunião via `POST https://meet.googleapis.com/v2/spaces`.
 * A API de espaços não recebe título/horário — por isso data, duração e título
 * ficam guardados no Elo (`AlignmentMeeting`) e o link é só o ponto de entrada.
 */
export async function createGoogleMeetSpace(): Promise<CreatedMeeting> {
  if (!googleMeetConfigured()) {
    return demoMeeting();
  }

  try {
    const accessToken = await getAccessToken();
    const response = await fetch(SPACES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Google Meet API respondeu ${response.status}. ${detail}`.trim());
    }

    const payload = (await response.json()) as {
      name?: string;
      meetingUri?: string;
      meetingCode?: string;
    };

    if (!payload.meetingUri || !payload.meetingCode) {
      throw new Error("Resposta da Google Meet API sem meetingUri/meetingCode.");
    }

    return { meetLink: payload.meetingUri, meetCode: payload.meetingCode, provider: "google-meet-api" };
  } catch (error) {
    // Não trava o agendamento por falha de rede/credencial — cai para o link de
    // demonstração e deixa o motivo nos logs do servidor.
    console.error("[google-meet] falha ao criar espaço pela API, usando link de demonstração:", error);
    return demoMeeting();
  }
}

function demoMeeting(): CreatedMeeting {
  const code = randomMeetCode();
  return { meetLink: `https://meet.google.com/${code}`, meetCode: code, provider: "demo" };
}

function randomMeetCode() {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const block = (length: number) =>
    Array.from({ length }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  return `${block(3)}-${block(4)}-${block(3)}`;
}

# Guia de Deploy — Elo (Supabase + Vercel)

O projeto **Elo** já está provisionado e populado na sua organização do **Supabase** (`ELO's Org`) na região **South America (São Paulo — `sa-east-1`)**.

---

## 1. Projeto Supabase Provisionado

| Item | Valor |
| --- | --- |
| **Organização** | `ELO's Org` (`bsywvmzmmgjjnnecnxrr`) |
| **Projeto** | `elo` |
| **Project Ref** | `euvlzkbafqwzonlwlhvd` |
| **Região** | `sa-east-1` (São Paulo) |
| **URL da API** | `https://euvlzkbafqwzonlwlhvd.supabase.co` |
| **Tabelas criadas** | 16 tabelas `public.elo_*` com **Row Level Security (RLS)** ativado |
| **RPCs transacionais** | `public.elo_read_snapshot()` e `public.elo_write_snapshot(jsonb)` (restritas à `service_role`) |
| **Auth** | E-mail/senha habilitado (`@escolar.ifrn.edu.br` e `@ifrn.edu.br`) com `mailer_autoconfirm = true` para o piloto |

### Semente inicial já carregada no banco em nuvem
- **6** tópicos curriculares (`História` sem monitor para evidenciar demanda reprimida)
- **22** estudantes
- **8** monitores / colegas apoiadores
- **4** professores (com conversas e reunião de alinhamento com os monitores)
- **33** pedidos de ajuda
- **37** sessões registradas

---

## 2. Variáveis de Ambiente na Vercel

Ao importar este repositório na [Vercel](https://vercel.com/new), adicione as variáveis abaixo em **Settings → Environment Variables**:

| Variável | Obrigatória | Onde obter / Valor |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | `https://euvlzkbafqwzonlwlhvd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Supabase Dashboard → **Project Settings → API** → `anon` / `publishable` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Supabase Dashboard → **Project Settings → API** → `service_role` secret *(nunca exponha com `NEXT_PUBLIC_`)* |
| `NEXT_PUBLIC_DEMO_MODE` | Opcional | `true` para manter o seletor rápido de apresentação junto ao login; `false` para exigir exclusivamente autenticação institucional |
| `GOOGLE_MEET_CLIENT_ID` / `GOOGLE_MEET_CLIENT_SECRET` / `GOOGLE_MEET_REFRESH_TOKEN` | Opcional | Credenciais OAuth da Google Meet API para criar salas reais no Espaço de Alinhamento (sem elas, gera links de demonstração automaticamente) |

> **Alternativa via conexão TCP (`pg.Pool`):** Caso prefira usar conexão Postgres direta (Session/Transaction Pooler do Supabase ou Neon), basta definir `DATABASE_URL` no lugar de `SUPABASE_SERVICE_ROLE_KEY`. O driver `postgres` usa transação explícita em cliente único (`pool.connect()`) com `pg_advisory_xact_lock` cobrindo leitura + mutação + gravação.

---

## 3. Configuração de URLs do Supabase Auth (Produção)

Depois do primeiro deploy na Vercel (ex.: `https://elo-ifrn.vercel.app`):

1. Abra o [Supabase Dashboard](https://supabase.com/dashboard/project/euvlzkbafqwzonlwlhvd/auth/url-configuration).
2. Em **Authentication → URL Configuration**:
   - **Site URL:** `https://seu-dominio.vercel.app`
   - **Redirect URLs:** `https://seu-dominio.vercel.app/**`
3. Para exigir confirmação de e-mail por link após a fase de apresentação, desative **Confirm email → Auto-confirm** em **Authentication → Providers → Email**.

---

## 4. Verificação Pós-Deploy

Após o deploy finalizar:

1. Acesse `GET https://seu-dominio.vercel.app/api/health` e confirme:
   ```json
   {
     "ok": true,
     "driver": "supabase",
     "supabaseAuthConfigured": true,
     "counts": {
       "topics": 6,
       "students": 22,
       "monitors": 8,
       "teachers": 4,
       "requests": 33,
       "sessions": 37,
       "alignmentMessages": 7,
       "alignmentMeetings": 1
     }
   }
   ```
2. Acesse `/entrar` para criar uma conta institucional (`@escolar.ifrn.edu.br` para discente ou `@ifrn.edu.br` para docente/coordenação) ou testar os atalhos de apresentação.

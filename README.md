# Elo — Plataforma de Monitoria entre Pares (IFRN)

Aplicação completa do projeto de extensão **Elo** (IFRN — Campus Parnamirim): conecta estudantes que precisam de apoio em um tópico curricular a monitores bolsistas e colegas apoiadores considerando afinidade no conteúdo, compatibilidade de horários, nota histórica e equilíbrio de carga semanal — gerando relatórios automáticos de horas, indicadores de demanda para a coordenação e um **Espaço de alinhamento** direto entre professores e monitores com **Google Meet**.

Construído com **Next.js 16 (App Router)** + **React 19** + **TypeScript strict** + **Tailwind CSS v4** + **Supabase (Database + Auth)** + **Zustand** + **TanStack Query**.

---

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha as chaves do projeto Supabase (veja DEPLOY.md)
npm run dev                  # http://localhost:3000 (TZ=America/Sao_Paulo)
```

### Validação e testes automatizados

```bash
npm run typecheck    # verificação estática TypeScript (tsc --noEmit)
npm run build        # build de produção Next.js
npm run test:db      # testa schema de 16 tabelas, transações e snapshot num Postgres real (PGlite)
npm run test:db:pg   # teste ponta-a-ponta: pg.Pool + concorrência + RBAC + LGPD + ciclo de pedidos
```

---

## Arquitetura de Persistência e Autenticação

- **Três drivers sob um único contrato transacional (`lib/server/db.ts`):**
  1. **`supabase`** *(produção recomendada na Vercel)*: usa as funções RPC transacionais `elo_read_snapshot()` e `elo_write_snapshot(jsonb)` com `pg_advisory_xact_lock` via HTTPS (`SUPABASE_SERVICE_ROLE_KEY`), com RLS ativado nas 16 tabelas `public.elo_*`.
  2. **`postgres`**: usa `pg.Pool` com transação única (`BEGIN ... COMMIT`) e `pg_advisory_xact_lock` num mesmo `PoolClient` cobrindo todo o ciclo ler-mutar-gravar (`DATABASE_URL`).
  3. **`json`**: fallback local atômico em `data/elo.json` quando nenhuma credencial de banco remoto é informada.
- **Autenticação institucional + Modo Demonstração (`/entrar`):**
  - **Supabase Auth real**: cadastro e login com e-mail institucional (`@escolar.ifrn.edu.br` para discentes e `@ifrn.edu.br` para docentes/coordenação), validação JWT nas rotas `/api/*` e vínculo automático por e-mail/UID (`public.elo_accounts`).
  - **Modo Demonstração** (`NEXT_PUBLIC_DEMO_MODE=true`): permite alternar rapidamente entre Coordenação, Monitores, Professores e Estudantes durante bancas e apresentações. Em produção estrita, basta definir `NEXT_PUBLIC_DEMO_MODE=false`.

---

## Telas e Funcionalidades por Perfil

| Tela | O que mostra |
| --- | --- |
| **Painel** | Coordenação: pedidos abertos, % pareado em 48 h, horas do mês, satisfação, série semanal, pontos de atenção. Estudante e monitor: os próprios números, avisos e próximos atendimentos. |
| **Pedidos** | Fila com filtros e busca; detalhe com **ranking de monitores pontuado** e o porquê de cada score; parear ou aceitar, agendar/remarcar com local ou link remoto, avaliar atendimento, cancelar e devolver à fila. |
| **Monitores** | Quem domina cada tópico (nível 1–5), disponibilidade por dia, carga da semana vs. capacidade, avaliação e CRUD pela coordenação. |
| **Agenda** | Semana completa (incluindo fins de semana quando há sessão) com as sessões de quem está usando; registrar presença ou falta direto do card. |
| **Alinhamento** | Espaço restrito a **professor(a)** e **monitor(a)** do mesmo tópico: conversa para combinar mudanças nas aulas e reuniões agendadas direto no **Google Meet**. |
| **Relatórios** | Os 6 indicadores da proposta com meta e progresso; relatório de horas realizadas por monitor; demanda por tópico (inclusive **sem monitor**); SLA, distribuição de notas e exportação CSV com proteção LGPD. |
| **Configurações** | **Meu perfil** de cada usuário, gestão de tópicos e estudantes (coordenação), pesos do algoritmo com soma normalizada, paleta e tema, garantias de LGPD e reset. |

| Papel | O que vê e pode fazer |
| --- | --- |
| **Estudante** | Cria pedidos com consentimento LGPD, acompanha progresso e local/link remoto da sessão, cancela pedidos antes da conclusão e **avalia atendimentos concluídos (1–5 estrelas + comentário)**. |
| **Monitor(a)** | Vê pedidos abertos dos seus tópicos com score de compatibilidade, aceita, agenda e **remarca** sessões informando **sala presencial ou link remoto**, devolve pedidos à fila se imprevistos ocorrerem, registra presença/falta, acompanha horas certificáveis e participa do **Alinhamento** com os professores dos seus tópicos. |
| **Professor(a)** | Acessa **Alinhamento** (tópicos que leciona) e Configurações; conversa com os monitores dos seus componentes e agenda reuniões no **Google Meet**. |
| **Coordenação** | Painel completo e relatórios (6 metas do piloto + exportação CSV + modo agregado LGPD), pareamento manual assistido por ranking, **CRUD de monitores**, **catálogo de tópicos curriculares**, **gestão de estudantes e autorizações de responsáveis (LGPD)**, calibração de pesos e restauração da semente. |

---

## Espaço de alinhamento e Google Meet API

Conversa e agenda de reuniões exclusiva de quem leciona um componente e de quem monitora aquele mesmo tópico — nem estudante, nem coordenação têm acesso (validado tanto no menu quanto no servidor via `resolveActor` + `canUseAlignmentTopic`).

O botão **"Agendar no Meet"** cria um espaço real via [Google Meet API](https://developers.google.com/workspace/meet/api/guides/overview) (`POST https://meet.googleapis.com/v2/spaces`) quando as credenciais abaixo estão configuradas; sem elas, gera automaticamente um link de demonstração (`meet.google.com/xxx-yyyy-zzz`):

```bash
GOOGLE_MEET_CLIENT_ID="..."
GOOGLE_MEET_CLIENT_SECRET="..."
GOOGLE_MEET_REFRESH_TOKEN="..."
```

Consulte [`DEPLOY.md`](DEPLOY.md) para detalhes do projeto Supabase (`euvlzkbafqwzonlwlhvd`) e publicação na Vercel.

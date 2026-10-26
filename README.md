# Elo — Plataforma de Monitoria entre Pares (IFRN)

Aplicação completa do projeto de extensão **Elo** (IFRN — Campus Parnamirim): conecta estudantes que precisam de apoio em um tópico curricular a monitores bolsistas e colegas apoiadores considerando afinidade no conteúdo, compatibilidade de horários, nota histórica e equilíbrio de carga semanal — gerando relatórios automáticos de horas e indicadores de demanda para a coordenação.

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
npm run test:db      # testa schema de 12 tabelas, transações e snapshot num Postgres real (PGlite)
npm run test:db:pg   # teste ponta-a-ponta: pg.Pool + concorrência + RBAC + LGPD + ciclo de pedidos
```

---

## Arquitetura de Persistência e Autenticação

- **Três drivers sob um único contrato transacional (`lib/server/db.ts`):**
  1. **`supabase`** *(produção recomendada na Vercel)*: usa as funções RPC transacionais `elo_read_snapshot()` e `elo_write_snapshot(jsonb)` com `pg_advisory_xact_lock` via HTTPS (`SUPABASE_SERVICE_ROLE_KEY`), com RLS ativado nas 12 tabelas `public.elo_*`.
  2. **`postgres`**: usa `pg.Pool` com transação única (`BEGIN ... COMMIT`) e `pg_advisory_xact_lock` num mesmo `PoolClient` cobrindo todo o ciclo ler-mutar-gravar (`DATABASE_URL`).
  3. **`json`**: fallback local atômico em `data/elo.json` quando nenhuma credencial de banco remoto é informada.
- **Autenticação institucional + Modo Demonstração (`/entrar`):**
  - **Supabase Auth real**: cadastro e login com e-mail institucional (`@escolar.ifrn.edu.br` para discentes e `@ifrn.edu.br` para servidores/coordenação), validação JWT nas rotas `/api/*` e vínculo automático por e-mail/UID (`public.elo_accounts`).
  - **Modo Demonstração** (`NEXT_PUBLIC_DEMO_MODE=true`): permite alternar rapidamente entre Coordenação, Monitores e Estudantes durante bancas e apresentações. Em produção estrita, basta definir `NEXT_PUBLIC_DEMO_MODE=false`.

---

## Funcionalidades por Perfil

| Papel | O que vê e pode fazer |
| --- | --- |
| **Estudante** | Cria pedidos com consentimento LGPD, acompanha progresso e local/link remoto da sessão, cancela pedidos antes da conclusão e **avalia atendimentos concluídos (1–5 estrelas + comentário)**. |
| **Monitor(a)** | Vê pedidos abertos dos seus tópicos com score de compatibilidade, aceita, agenda e **remarca** sessões informando **sala presencial ou link remoto**, devolve pedidos à fila se imprevistos ocorrerem, registra presença/falta e acompanha horas certificáveis. |
| **Coordenação** | Painel completo e relatórios (6 metas do piloto + exportação CSV + modo agregado LGPD), pareamento manual assistido por ranking, **CRUD de monitores**, **catálogo de tópicos curriculares**, **gestão de estudantes e autorizações de responsáveis (LGPD)**, calibração de pesos e restauração da semente. |

Consulte [`DEPLOY.md`](DEPLOY.md) para detalhes do projeto Supabase (`euvlzkbafqwzonlwlhvd`) e publicação na Vercel.

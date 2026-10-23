# Elo — plataforma de monitoria entre pares (IFRN)

Demonstração funcional da proposta de projeto de extensão **Elo**: conectar estudantes que
precisam de ajuda em um tópico a monitores e colegas que dominam esse conteúdo, considerando
tópico e disponibilidade de horário — e transformar cada atendimento em horas registradas e
dados para a coordenação.

Construído sobre a mesma base do **Frenly** (projeto anterior da equipe): Next.js 16 (App
Router) + React 19 + TypeScript strict + Tailwind v4 + Motion + Zustand + TanStack Query. O
design system é o mesmo; o domínio é do Elo.

**Banco:** Postgres (Neon) em produção, arquivo JSON no desenvolvimento — a troca é
automática, pela presença de `DATABASE_URL`. Deploy passo a passo em [`DEPLOY.md`](DEPLOY.md).

---

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000  (TZ=America/Sao_Paulo)
npm run build      # build de produção (turbopack)
npm run typecheck  # tsc --noEmit

npm run test:db    # testa o store Postgres contra um Postgres real (PGlite)
npm run test:db:pg # testa o caminho completo pg.Pool → store → repositório
```

Para restaurar a base de demonstração:

```bash
curl -X POST localhost:3000/api/admin/reset
# ou: rm data/elo.json (com o servidor parado)
```

---

## O que a demonstração cobre

| Tela | O que mostra | No documento da proposta |
| --- | --- | --- |
| **Painel** | coordenação: pedidos abertos, % pareado em 48 h, horas do mês, satisfação, série semanal, pontos de atenção. Estudante e monitor: os próprios números, avisos e próximos atendimentos | indicadores de resultado (Parte 3) |
| **Pedidos** | fila com filtros e busca; detalhe com **ranking de monitores pontuado** e o porquê de cada score; parear ou aceitar, agendar, cancelar e devolver à fila | "pedido de ajuda por tópico", "pareamento", "algoritmo" |
| **Monitores** | quem domina cada tópico (nível 1–5), disponibilidade por dia, carga da semana vs. capacidade, avaliação | "estudantes monitores e colegas" |
| **Agenda** | semana com as sessões de quem está usando; registros pendentes; registrar presença ou falta direto do card | "agenda, registro de sessão" |
| **Relatórios** | os 6 indicadores da proposta com meta e progresso; relatório de horas por monitor; demanda por tópico (inclusive **sem monitor**); SLA e distribuição de notas; export CSV | "relatório de horas", "painel agregado" |
| **Configurações** | **Meu perfil** de cada usuário, pesos do algoritmo com soma normalizada, paleta e tema, garantias de LGPD e reset | "pesos calibrados no piloto", LGPD |

### Usuários e papéis (antes do login)

Ainda não há tela de login. Quem está usando o Elo é escolhido no **menu do usuário, no
topo → Trocar de usuário** (também em ⌘K e em Configurações): a Coordenação, um dos
estudantes ou um dos monitores. A escolha fica salva no navegador.

| Papel | Vê | Pode |
| --- | --- | --- |
| **Estudante** | seus pedidos, sua agenda, monitores | abrir pedido para si, cancelar enquanto não foi agendado, editar nome, turma e curso |
| **Monitor** | pedidos abertos dos tópicos que atende + os seus, sua agenda, monitores, relatórios | aceitar, agendar, registrar atendimento (presença ou falta), devolver à fila, editar o perfil (bio, disponibilidade e janelas de atendimento) |
| **Coordenação** | tudo | parear qualquer pedido, ajustar pesos, restaurar a base |

O perfil da coordenação começa **em branco**: preencha nome e e-mail em Configurações →
Meu perfil (até lá, o topo mostra só "Coordenação"). Restaurar os dados de demonstração
mantém o perfil.

**Onde o login vai entrar:** a identidade vive em `store/ui.ts` (`role` + `studentId` /
`monitorId`) e é resolvida em um ponto só, `useCurrentUser()` em `lib/current-user.ts`. As
telas leem tudo dali, e as regras de quem vê o quê estão em `canAccess` (`lib/constants.ts`)
e `requestPermissions` / `visibleRequests` (`lib/current-user.ts`). A tela de login só precisa
preencher essa identidade a partir da sessão. O servidor já recusa transições inválidas
(409 — ex.: cancelar um pedido concluído ou registrar o mesmo atendimento duas vezes);
conferir o papel de quem chama passa a ser possível quando houver sessão.

### Fluxo para demonstrar em 3 minutos

1. **Trocar de usuário → Estudantes** (ex.: Isabela Freitas) → **Pedidos → Novo pedido**:
   tópico ("Matemática"), a dúvida e duas janelas de horário.
2. Volte para a **Coordenação**: o pedido está na fila e, ao abri-lo, aparece o **ranking**:
   score /100 e a quebra em tópico, horário, nota e folga — com as frases ("Domina o tópico",
   "13:00–14:00 em comum").
3. **Parear** com o melhor match — ou entre como esse monitor e use **Aceitar pedido** →
   escolha a janela (as "em comum" batem com a agenda dele) → **Agendar**: a sessão aparece na
   agenda do estudante e do monitor.
4. **Registrar atendimento**: presença, duração e nota (ou "Faltou", que não soma horas). As
   horas entram no relatório do monitor e o painel/indicadores recalculam.
5. **Relatórios**: mostre "Demanda por tópico" com **História sem monitor** — o argumento de que
   a plataforma produz o dado que a coordenação não tem.
6. **Configurações**: mexa nos pesos e volte ao pedido para ver o ranking mudar. É a resposta
   pronta para "e se o peso estiver errado?".

---

## Algoritmo de pareamento

`lib/pairing.ts` — cada monitor recebe uma pontuação de 0 a 100:

```
score = (afinidade·w1 + horário·w2 + avaliação·w3 + folga·w4) / (w1+w2+w3+w4)
```

- **afinidade**: nível declarado no tópico (1–5) normalizado; monitor sem o tópico é descartado
- **horário**: sobreposição entre as janelas pedidas e a agenda do monitor (cobertura acima de
  2 h não agrega)
- **avaliação**: média recebida / 5
- **folga**: `1 − horas na semana / capacidade` — evita sobrecarga
- empate: quem tem menos horas na semana (`tieBreak`)

Os pesos vivem em `settings.weights` (editáveis em Configurações) e a proposta promete
calibrá-los no piloto — a tela existe exatamente para isso.

---

## Decisões de escopo (e o que dizer na apresentação)

- **Login fica para a próxima etapa.** Por enquanto, "Trocar de usuário" (menu do topo)
  escolhe quem está usando, e cada papel tem navegação, painel e ações próprias. É uma
  simulação declarada — não finge segurança que não existe. Veja acima onde o login se encaixa.
- **Duas persistências, um contrato.** `lib/server/db.ts` escolhe o driver: com
  `DATABASE_URL` usa Postgres (Neon), via 11 tabelas relacionais em `db/schema.sql`, criadas
  automaticamente no primeiro acesso; sem a variável, grava em `data/elo.json` com escrita
  atômica. `lib/server/repository.ts` e as rotas de API não sabem a diferença.
  Cada mutação grava um snapshot completo em transação com advisory lock — simples e seguro
  na escala do piloto (~35 KB); quando crescer, o próximo passo é trocar por updates
  incrementais, sem tocar na interface.
- **Dados fictícios** com semente determinística (`lib/server/seed.ts`): 22 estudantes, 8
  monitores, 35 pedidos, 6 tópicos (História sem monitor, para evidenciar demanda desassistida).
- **Acessibilidade**: foco visível global, `aria-pressed` nos chips, `role="dialog"` com Esc e
  travamento de scroll, `prefers-reduced-motion` respeitado em todas as animações.

## Estrutura

```
app/
  (app)/layout.tsx        shell: canvas verde + janela + sidebar + topbar + drawer mobile
  (app)/painel            dashboard
  (app)/pedidos           fila + detalhe com ranking de pareamento
  (app)/monitores         diretório de monitores
  (app)/agenda            semana de sessões
  (app)/relatorios        indicadores, horas, demanda, SLA
  (app)/configuracoes     pesos, aparência, perfil, LGPD, reset
  api/                    dashboard · people · students · requests · sessions · monitors · reports · settings · profile · health · admin/reset
components/               ui.tsx (panel, chip, button, dialog, segmented…), charts, stat-card, requests/, shell/, profile/
lib/
  types.ts                modelo de domínio (HelpRequest, Monitor, Session, Match…)
  pairing.ts              algoritmo + SLA
  current-user.ts         useCurrentUser(): quem está usando + o que pode ver e fazer
  server/seed.ts          semente determinística
  server/db.ts            fachada: Postgres (Neon) ou JSON, conforme DATABASE_URL
  server/store/json.ts    store em arquivo, escrita atômica
  server/store/postgres.ts store Postgres (DDL, snapshot, leitura)
  server/repository.ts    agregados e mutações
  server/migrate.ts       ajustes em dados salvos por versões anteriores
  api.ts                  camada de acesso do cliente (contrato)
store/ui.ts               identidade (papel + estudante/monitor), accent, tema, sidebar (Zustand)
docs/screens/             capturas de QA (desktop, mobile, dark, fluxo completo)
db/schema.sql             esquema relacional (11 tabelas) — referência legível
scripts/                  testes do driver Postgres (PGlite) e servidor de teste
```

### Endpoint de diagnóstico

`GET /api/health` responde qual driver está ativo, a latência e a contagem de registros —
é o primeiro lugar para olhar depois de configurar o banco no Vercel:

```json
{ "ok": true, "driver": "postgres", "latencyMs": 42,
  "counts": { "topics": 6, "students": 22, "monitors": 8, "requests": 33, "sessions": 37 } }
```

## O que ficou fora (por decisão)

- Tela de login e autenticação real — a próxima etapa; a identidade já passa por um ponto
  só (`useCurrentUser`).
- Notificações push/e-mail (o pedido pareado não avisa ninguém — na vida real, avisaria).
- Integração com SUAP para importar turmas e matrículas.
- Aplicativo instalável (PWA): o documento prevê, a demo roda no navegador.
- Migração para tabelas normalizadas com updates incrementais — hoje o schema já é
  relacional, mas a escrita ainda é snapshot completo (ver `db/schema.sql`).
- Chat entre estudante e monitor.

## Referências usadas no desenho

Vygotsky (zona de desenvolvimento proximal), Topping (2005, aprendizagem entre pares),
Brooke (1996, escala SUS — a mesma que a Meta 5 vai aplicar), LGPD (Lei 13.709/2018) e a
Resolução CNE/CES nº 7/2018.

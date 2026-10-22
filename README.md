# Elo — plataforma de monitoria entre pares (IFRN)

Demonstração funcional da proposta de projeto de extensão **Elo**: conectar estudantes que
precisam de ajuda em um tópico a monitores e colegas que dominam esse conteúdo, considerando
tópico e disponibilidade de horário — e transformar cada atendimento em horas registradas e
dados para a coordenação.

Construído sobre a mesma base do **Frenly** (projeto anterior da equipe): Next.js 16 (App
Router) + React 19 + TypeScript strict + Tailwind v4 + Motion + Zustand + TanStack Query, com
backend REST em JSON atômico. O design system é o mesmo; o domínio é do Elo.

---

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000  (TZ=America/Sao_Paulo)
npm run build      # build de produção (turbopack)
npm run typecheck  # tsc --noEmit
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
| **Painel** | pedidos abertos, % pareado em 48 h, horas do mês, satisfação, série semanal, pontos de atenção, fila e próximos atendimentos | indicadores de resultado (Parte 3) |
| **Pedidos** | fila com filtros e busca; detalhe com **ranking de monitores pontuado** e o porquê de cada score; parear, agendar e cancelar | "pedido de ajuda por tópico", "pareamento", "algoritmo" |
| **Monitores** | quem domina cada tópico (nível 1–5), disponibilidade por dia, carga da semana vs. capacidade, avaliação | "estudantes monitores e colegas" |
| **Agenda** | semana com as sessões confirmadas; registrar atendimento direto do card | "agenda, registro de sessão" |
| **Relatórios** | os 6 indicadores da proposta com meta e progresso; relatório de horas por monitor; demanda por tópico (inclusive **sem monitor**); SLA e distribuição de notas; export CSV | "relatório de horas", "painel agregado" |
| **Configurações** | pesos do algoritmo com soma normalizada, paleta e tema, perfil, garantias de LGPD e reset | "pesos calibrados no piloto", LGPD |

### Fluxo para demonstrar em 3 minutos

1. **Pedidos → Novo pedido**: escolha estudante, tópico ("Matemática"), escreva a dúvida e
   marque duas janelas de horário.
2. O pedido entra na fila e, ao abri-lo, aparece o **ranking**: score /100 e a quebra em
   tópico, horário, nota e folga — com as frases ("Domina o tópico", "13:00–14:00 em comum").
3. **Parear** com o melhor match → escolha a janela → **Agendar**: a sessão nasce na Agenda.
4. **Registrar atendimento**: presença, duração e nota. As horas entram no relatório do monitor
   e o painel/indicadores recalculam.
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

- **Não há autenticação.** O Frenly é single-tenant e este projeto também. O seletor **"Ver
  como"** na topbar troca entre Estudante, Monitor e Coordenação, mudando navegação e painel.
  É uma simulação declarada — não finge segurança que não existe.
- **Banco JSON no servidor** (`data/elo.json`), escrita atômica (tmp + rename) e fila de escrita.
  O contrato de `lib/api.ts` + `lib/server/repository.ts` é o que muda numa migração para
  Postgres/Supabase — nenhum componente precisa ser tocado.
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
  api/                    dashboard · requests · sessions · monitors · reports · settings · profile · admin/reset
components/               ui.tsx (panel, chip, button, dialog, segmented…), charts, stat-card, requests/, shell/
lib/
  types.ts                modelo de domínio (HelpRequest, Monitor, Session, Match…)
  pairing.ts              algoritmo + SLA
  server/seed.ts          semente determinística
  server/db.ts            store JSON atômico
  server/repository.ts    agregados e mutações
  api.ts                  camada de acesso do cliente (contrato)
store/ui.ts               papel, accent, tema, sidebar (Zustand)
docs/screens/             capturas de QA (desktop, mobile, dark, fluxo completo)
```

## O que ficou fora (por decisão)

- Autenticação real, multiusuário e permissões.
- Notificações push/e-mail (o pedido pareado não avisa ninguém — na vida real, avisaria).
- Integração com SUAP para importar turmas e matrículas.
- Aplicativo instalável (PWA): o documento prevê, a demo roda no navegador.
- Chat entre estudante e monitor.

## Referências usadas no desenho

Vygotsky (zona de desenvolvimento proximal), Topping (2005, aprendizagem entre pares),
Brooke (1996, escala SUS — a mesma que a Meta 5 vai aplicar), LGPD (Lei 13.709/2018) e a
Resolução CNE/CES nº 7/2018.

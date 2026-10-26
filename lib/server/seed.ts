import type {
  AccountLink,
  AlignmentMeeting,
  AlignmentMessage,
  DemoProfile,
  HelpRequest,
  Monitor,
  Session,
  Settings,
  Student,
  Teacher,
  Topic,
} from "../types";

export interface Database {
  topics: Topic[];
  students: Student[];
  monitors: Monitor[];
  teachers: Teacher[];
  requests: HelpRequest[];
  sessions: Session[];
  alignmentMessages: AlignmentMessage[];
  alignmentMeetings: AlignmentMeeting[];
  accounts: AccountLink[];
  settings: Settings;
  profile: DemoProfile;
  meta: { createdAt: string; version: number };
}

/** PRNG determinístico — a semente não muda entre reinícios. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const topics: Topic[] = [
  { id: "mat", name: "Matemática", component: "Matemática I", color: "sage" },
  { id: "port", name: "Língua Portuguesa", component: "Língua Portuguesa I", color: "peach" },
  { id: "fis", name: "Física", component: "Física I", color: "blue" },
  { id: "prog", name: "Programação", component: "Lógica e Programação", color: "lilac" },
  { id: "quim", name: "Química", component: "Química I", color: "sand" },
  // tópico sem monitor no piloto — evidencia a demanda desassistida
  { id: "hist", name: "História", component: "História I", color: "peach" },
];

const studentsSeed: Student[] = [
  { id: "a1", name: "Ana Beatriz Lima", className: "1º ano INFO", course: "Informática", color: "peach", guardianConsent: true, email: "ana.lima@escolar.ifrn.edu.br" },
  { id: "a2", name: "Caio Ferreira", className: "1º ano INFO", course: "Informática", color: "blue", guardianConsent: true, email: "caio.ferreira@escolar.ifrn.edu.br" },
  { id: "a3", name: "Maria Eduarda Souza", className: "1º ano INFO", course: "Informática", color: "sage", guardianConsent: true, email: "eduarda.souza@escolar.ifrn.edu.br" },
  { id: "a4", name: "João Pedro Alves", className: "1º ano INFO", course: "Informática", color: "sand", guardianConsent: true, email: "joao.alves@escolar.ifrn.edu.br" },
  { id: "a5", name: "Larissa Nunes", className: "1º ano INFO", course: "Informática", color: "lilac", guardianConsent: true, email: "larissa.nunes@escolar.ifrn.edu.br" },
  { id: "a6", name: "Gabriel Moreira", className: "2º ano INFO", course: "Informática", color: "blue", guardianConsent: false },
  { id: "a7", name: "Beatriz Cavalcanti", className: "2º ano INFO", course: "Informática", color: "peach", guardianConsent: false },
  { id: "a8", name: "Ryan Silva", className: "2º ano INFO", course: "Informática", color: "sage", guardianConsent: false },
  { id: "a9", name: "Sofia Martins", className: "2º ano INFO", course: "Informática", color: "sand", guardianConsent: false },
  { id: "a10", name: "Pedro Henrique Rocha", className: "3º ano MEC", course: "Mecatrônica", color: "lilac", guardianConsent: false },
  { id: "a11", name: "Alice Barbosa", className: "3º ano MEC", course: "Mecatrônica", color: "peach", guardianConsent: false },
  { id: "a12", name: "Miguel Araújo", className: "1º ano MEC", course: "Mecatrônica", color: "blue", guardianConsent: true, email: "miguel.araujo@escolar.ifrn.edu.br" },
  { id: "a13", name: "Isabela Freitas", className: "1º ano MEC", course: "Mecatrônica", color: "sage", guardianConsent: true, email: "isabela.freitas@escolar.ifrn.edu.br" },
  { id: "a14", name: "Lucas Dantas", className: "2º ano MEC", course: "Mecatrônica", color: "sand", guardianConsent: false },
  { id: "a15", name: "Valentina Costa", className: "2º ano MEC", course: "Mecatrônica", color: "lilac", guardianConsent: false },
  { id: "a16", name: "Enzo Carvalho", className: "1º ano MEC", course: "Mecatrônica", color: "peach", guardianConsent: true },
  { id: "a17", name: "Heloísa Barros", className: "1º ano INFO", course: "Informática", color: "lilac", guardianConsent: true },
  { id: "a18", name: "Bernardo Melo", className: "2º ano INFO", course: "Informática", color: "sage", guardianConsent: false },
  { id: "a19", name: "Júlia Rebouças", className: "3º ano MEC", course: "Mecatrônica", color: "blue", guardianConsent: false },
  { id: "a20", name: "Thiago Bento", className: "1º ano MEC", course: "Mecatrônica", color: "sand", guardianConsent: true },
  { id: "a21", name: "Marina Lopes", className: "2º ano MEC", course: "Mecatrônica", color: "peach", guardianConsent: false },
  { id: "a22", name: "Igor Fontes", className: "3º ano INFO", course: "Informática", color: "lilac", guardianConsent: false },
];

const S = {
  segTarde: { day: 1, start: 13 * 60, end: 15 * 60 },
  terTarde: { day: 2, start: 15 * 60, end: 17 * 60 },
  terNoite: { day: 2, start: 18 * 60, end: 20 * 60 },
  quaTarde: { day: 3, start: 13 * 60, end: 14 * 60 },
  quaNoite: { day: 3, start: 17 * 60, end: 19 * 60 },
  quiTarde: { day: 4, start: 13 * 60, end: 16 * 60 },
  sexTarde: { day: 5, start: 15 * 60, end: 18 * 60 },
  sexInicio: { day: 5, start: 13 * 60, end: 15 * 60 },
} as const;

const locations = [
  "Biblioteca — Mesa de estudos",
  "Lab de Informática 1",
  "Sala de Monitoria",
] as const;

const monitors: Monitor[] = [
  {
    id: "m1",
    name: "Helena Prado",
    className: "3º ano INFO",
    kind: "bolsista",
    topics: [
      { topicId: "mat", level: 5 },
      { topicId: "fis", level: 4 },
    ],
    availability: [S.segTarde, S.quaNoite, S.sexInicio],
    rating: 4.9,
    ratingCount: 21,
    sessions: 23,
    weeklyHours: 4,
    capacityHours: 8,
    color: "sage",
    online: true,
    bio: "Monitora de Matemática desde o 2º ano. Gosta de resolver exercício junto, no quadro.",
    email: "helena.prado@escolar.ifrn.edu.br",
  },
  {
    id: "m2",
    name: "Arthur Bezerra",
    className: "3º ano INFO",
    kind: "bolsista",
    topics: [
      { topicId: "prog", level: 5 },
      { topicId: "mat", level: 4 },
    ],
    availability: [S.terTarde, S.terNoite, S.sexTarde],
    rating: 4.7,
    ratingCount: 17,
    sessions: 18,
    weeklyHours: 5,
    capacityHours: 8,
    color: "lilac",
    online: true,
    bio: "Ajuda em lógica e estruturas de repetição. Prefere exemplos com código curto.",
    email: "arthur.bezerra@escolar.ifrn.edu.br",
  },
  {
    id: "m3",
    name: "Clara Menezes",
    className: "2º ano MEC",
    kind: "voluntario",
    topics: [
      { topicId: "port", level: 5 },
      { topicId: "quim", level: 3 },
    ],
    availability: [S.segTarde, S.quiTarde, S.sexTarde],
    rating: 4.8,
    ratingCount: 14,
    sessions: 15,
    weeklyHours: 3,
    capacityHours: 6,
    color: "peach",
    online: false,
    bio: "Foca em interpretação de texto e estrutura da redação do integrado.",
    email: "clara.menezes@escolar.ifrn.edu.br",
  },
  {
    id: "m4",
    name: "Davi Lustosa",
    className: "3º ano MEC",
    kind: "bolsista",
    topics: [
      { topicId: "fis", level: 5 },
      { topicId: "mat", level: 3 },
    ],
    availability: [S.quaTarde, S.quaNoite, S.sexTarde],
    rating: 4.5,
    ratingCount: 11,
    sessions: 12,
    weeklyHours: 6,
    capacityHours: 8,
    color: "blue",
    online: true,
    bio: "Explica cinemática com gráficos feitos à mão. Agenda cheia nas quintas.",
    email: "davi.lustosa@escolar.ifrn.edu.br",
  },
  {
    id: "m5",
    name: "Manuella Rocha",
    className: "2º ano INFO",
    kind: "voluntario",
    topics: [{ topicId: "quim", level: 5 }],
    availability: [S.terTarde, S.quiTarde, S.quaTarde],
    rating: 4.6,
    ratingCount: 8,
    sessions: 9,
    weeklyHours: 2,
    capacityHours: 6,
    color: "sand",
    online: false,
    bio: "Única monitora de Química com nível avançado no campus.",
    email: "manuella.rocha@escolar.ifrn.edu.br",
  },
  {
    id: "m6",
    name: "Vinícius Tavares",
    className: "3º ano INFO",
    kind: "bolsista",
    topics: [
      { topicId: "mat", level: 5 },
      { topicId: "quim", level: 4 },
    ],
    availability: [S.segTarde, S.terTarde, S.quaTarde, S.quiTarde],
    rating: 4.9,
    ratingCount: 25,
    sessions: 21,
    weeklyHours: 7,
    capacityHours: 8,
    color: "sage",
    online: true,
    bio: "Atende em grupo quando o assunto é o mesmo. Bom em funções e progressões.",
    email: "vinicius.tavares@escolar.ifrn.edu.br",
  },
  {
    id: "m7",
    name: "Cecília Amorim",
    className: "2º ano INFO",
    kind: "voluntario",
    topics: [
      { topicId: "port", level: 4 },
      { topicId: "prog", level: 4 },
    ],
    availability: [S.sexTarde, S.terNoite, S.sexInicio],
    rating: 4.4,
    ratingCount: 6,
    sessions: 7,
    weeklyHours: 3,
    capacityHours: 6,
    color: "peach",
    online: true,
    bio: "Trabalha produção textual e também quebra galho em Python.",
    email: "cecilia.amorim@escolar.ifrn.edu.br",
  },
  {
    id: "m8",
    name: "Otávio Nascimento",
    className: "3º ano MEC",
    kind: "bolsista",
    topics: [
      { topicId: "prog", level: 5 },
      { topicId: "fis", level: 3 },
    ],
    availability: [S.quaNoite, S.sexTarde],
    rating: 4.3,
    ratingCount: 5,
    sessions: 6,
    weeklyHours: 5.5,
    capacityHours: 6,
    color: "lilac",
    online: false,
    bio: "Monitor novo no projeto, entrou no segundo ciclo do piloto.",
    email: "otavio.nascimento@escolar.ifrn.edu.br",
  },
];

const teachers: Teacher[] = [
  {
    id: "t1",
    name: "Roberta Austregésilo",
    className: "Professora de Matemática I",
    email: "roberta.austregesilo@ifrn.edu.br",
    topics: ["mat"],
    color: "sage",
    bio: "Leciona Matemática I para o 1º e 2º ano. Quer revisar com os monitores os pontos onde a turma mais trava.",
  },
  {
    id: "t2",
    name: "Fabiano Medeiros",
    className: "Professor de Lógica e Programação",
    email: "fabiano.medeiros@ifrn.edu.br",
    topics: ["prog"],
    color: "lilac",
    bio: "Acompanha de perto a monitoria de Programação — ajusta a lista de exercícios com o que aparece na monitoria.",
  },
  {
    id: "t3",
    name: "Camila Herculano",
    className: "Professora de Física I",
    email: "camila.herculano@ifrn.edu.br",
    topics: ["fis"],
    color: "blue",
    bio: "Dá Física I para os três anos do integrado. Usa o retorno da monitoria para repensar as aulas de laboratório.",
  },
  {
    id: "t4",
    name: "Edvaldo Queiroz",
    className: "Professor de Química I",
    email: "edvaldo.queiroz@ifrn.edu.br",
    topics: ["quim"],
    color: "sand",
    bio: "Professor de Química I. Entrou no piloto para entender onde a turma mais pede monitoria.",
  },
];

type RequestSeed = [
  studentIdx: number,
  topicId: string,
  daysAgo: number,
  hour: number,
  preferred: { day: number; start: number; end: number }[],
  urgency: HelpRequest["urgency"],
  status: HelpRequest["status"],
  note: string,
];

const requestSeeds: RequestSeed[] = [
  [0, "mat", 26, 10, [S.segTarde], "normal", "done", "Não entendi função afim, principalmente o gráfico."],
  [1, "port", 25, 14, [S.quiTarde], "low", "done", "Preciso revisar a estrutura da dissertação para a produção textual."],
  [2, "fis", 24, 16, [S.sexTarde], "high", "done", "Vou fazer prova de cinemática na sexta e travei em velocidade média."],
  [3, "prog", 23, 9, [S.terNoite], "normal", "done", "Meu for não sai do lugar, acho que é o contador."],
  [4, "mat", 22, 11, [S.quaTarde], "normal", "done", "Progressão aritmética: como achar o termo geral?"],
  [5, "quim", 21, 13, [S.terTarde], "high", "done", "Balanceamento de equações, não consigo acertar os coeficientes."],
  [6, "fis", 20, 15, [S.quaNoite], "normal", "done", "Segunda lei de Newton com plano inclinado."],
  [7, "mat", 19, 10, [S.segTarde], "low", "done", "Dúvida em simplificação de frações algébricas."],
  [8, "port", 18, 14, [S.sexTarde], "normal", "done", "Figuras de linguagem para o simulado."],
  [9, "prog", 17, 11, [S.sexTarde], "normal", "done", "Diferença entre while e do-while na prática."],
  [10, "mat", 16, 16, [S.quiTarde], "high", "done", "Logaritmo, não entendi a mudança de base."],
  [11, "quim", 15, 9, [S.quaTarde], "normal", "done", "Ligações químicas: iônica e covalente."],
  [12, "mat", 14, 13, [S.segTarde], "normal", "done", "Sistemas de equações, o método da substituição me confunde."],
  [13, "fis", 13, 15, [S.sexTarde], "low", "done", "Trabalho de uma força e potência."],
  [14, "port", 12, 10, [S.quiTarde], "low", "cancelled", "Ia pedir ajuda com crase, mas consegui com a monitora em sala."],
  [15, "mat", 11, 18, [S.terNoite], "normal", "done", "Trigonometria no triângulo retângulo."],
  [0, "prog", 10, 14, [S.terNoite], "normal", "done", "Listas em Python: como percorrer e somar?"],
  [1, "fis", 9, 11, [S.quaNoite], "normal", "done", "Associação de resistores, não sei quando é série."],
  [2, "mat", 8, 15, [S.segTarde], "high", "done", "Função quadrática e o vértice da parábola."],
  [3, "port", 7, 9, [S.sexTarde], "normal", "done", "Coesão textual: conectivos que eu sempre troco."],
  [4, "quim", 6, 13, [S.terTarde], "normal", "scheduled", "Cálculo de mol, prova na próxima semana."],
  [5, "mat", 5, 16, [S.quiTarde], "normal", "scheduled", "Geometria espacial: volume do cilindro."],
  [6, "prog", 4, 10, [S.sexTarde], "normal", "scheduled", "Vetores em Python e índice fora do intervalo."],
  [7, "fis", 3, 14, [S.quaNoite], "high", "scheduled", "Óptica geométrica, espelhos planos."],
  [8, "mat", 3, 11, [S.segTarde], "normal", "matched", "Razão e proporção em exercícios de regra de três."],
  [9, "prog", 2, 15, [S.terNoite], "normal", "matched", "Funções: parâmetros e retorno."],
  [10, "port", 2, 9, [S.quiTarde], "low", "open", "Queria ajuda com a redação do simulado."],
  [11, "mat", 1, 13, [S.segTarde], "high", "open", "Prova de matemática na quarta, preciso revisar equação do 1º grau."],
  [12, "quim", 1, 16, [S.terTarde], "normal", "open", "Tabela periódica: como usar a família e o período?"],
  [13, "fis", 0, 10, [S.sexTarde], "normal", "open", "Dúvida em gráfico de velocidade por tempo."],
  [14, "mat", 0, 14, [S.quaTarde], "low", "open", "Porcentagem e juros simples."],
  [15, "hist", 3, 10, [S.quiTarde], "normal", "open", "Revolução Industrial: não entendi a ordem dos fatores."],
  [12, "hist", 2, 15, [S.sexTarde], "low", "open", "Preciso organizar a linha do tempo do Brasil Império."],
];

/** Próxima ocorrência futura de `day` (1=seg … 6=sáb) no horário do slot. */
function nextWeekdayOccurrence(from: Date, day: number, startMinutes: number) {
  const target = new Date(from);
  const diff = (day - from.getDay() + 7) % 7;
  target.setDate(target.getDate() + diff);
  target.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
  if (target.getTime() <= from.getTime()) {
    target.setDate(target.getDate() + 7);
  }
  return target;
}

export function buildSeed(now = new Date()): Database {
  const rand = mulberry32(20261018);

  const at = (daysAgo: number, hour: number, minute = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  const students: Student[] = structuredClone(studentsSeed);
  const requests: HelpRequest[] = [];
  const sessions: Session[] = [];
  let sessionSeq = 0;

  requestSeeds.forEach((seed, index) => {
    const [studentIdx, topicId, daysAgo, hour, preferred, urgency, status, note] = seed;
    const createdAt = at(daysAgo, hour, Math.floor(rand() * 50));
    const student = students[studentIdx];

    if (!student.consentAcceptedAt || createdAt.toISOString() < student.consentAcceptedAt) {
      student.consentAcceptedAt = createdAt.toISOString();
    }

    const request: HelpRequest = {
      id: `r${String(index + 1).padStart(2, "0")}`,
      studentId: student.id,
      topicId,
      note,
      urgency,
      status,
      createdAt: createdAt.toISOString(),
      preferred,
    };

    if (status !== "open" && status !== "cancelled") {
      // maior parte rápida, com cauda realista acima de 48 h
      const roll = rand();
      const matchHours = roll < 0.72 ? 2 + rand() * 22 : roll < 0.92 ? 26 + rand() * 40 : 55 + rand() * 45;
      const matchedAt = new Date(createdAt.getTime() + matchHours * 36e5);
      const candidate = monitors
        .filter((m) => m.topics.some((t) => t.topicId === topicId))
        .sort((a, b) => a.weeklyHours / a.capacityHours - b.weeklyHours / b.capacityHours);
      const monitor = candidate[Math.floor(rand() * Math.max(1, Math.min(3, candidate.length)))] ?? monitors[0];

      request.monitorId = monitor.id;
      request.matchedAt = matchedAt.toISOString();

      if (status === "done" || status === "scheduled") {
        const slot = preferred[0];
        let sessionDate = new Date(matchedAt);
        const daysForward = 1 + Math.floor(rand() * 3);
        sessionDate.setDate(sessionDate.getDate() + daysForward);
        // garante dia útil (seg–sex) para sessões passadas
        if (sessionDate.getDay() === 0) sessionDate.setDate(sessionDate.getDate() + 1);
        if (sessionDate.getDay() === 6) sessionDate.setDate(sessionDate.getDate() - 1);
        sessionDate.setHours(Math.floor(slot.start / 60), slot.start % 60, 0, 0);

        if (status === "scheduled") {
          // sessões futuras: caem sempre no dia útil real da janela escolhida
          rand(); // mantém sequência determinística do PRNG
          sessionDate = nextWeekdayOccurrence(now, slot.day, slot.start);
        }

        const minutes = [45, 50, 60, 60, 75, 90][Math.floor(rand() * 6)];
        const location = locations[index % locations.length];
        const session: Session = {
          id: `s${++sessionSeq}`,
          requestId: request.id,
          monitorId: monitor.id,
          studentId: student.id,
          topicId,
          startsAt: sessionDate.toISOString(),
          minutes,
          attendance: "present",
          // deixa o último atendimento concluído da Ana Beatriz (r19/r17) sem nota
          // para demonstrar a avaliação feita pelo próprio estudante
          rating:
            status === "done"
              ? index === 16
                ? undefined
                : rand() < 0.14
                  ? 3
                  : rand() < 0.55
                    ? 4
                    : 5
              : undefined,
          notes: status === "done" ? "Atendimento registrado pelo monitor ao final da sessão." : undefined,
          location,
        };
        sessions.push(session);
        request.sessionId = session.id;
        if (status === "done") request.closedAt = new Date(sessionDate.getTime() + minutes * 60000).toISOString();
      }
    }

    requests.push(request);
  });

  // histórico extra: sessões antigas de monitoria que não passaram pela plataforma
  for (let i = 0; i < 14; i += 1) {
    const monitor = monitors[i % monitors.length];
    const student = students[Math.floor(rand() * students.length)];
    const topic = monitor.topics[0].topicId;
    const daysAgo = Math.floor(rand() * 46);
    const start = at(daysAgo, 13 + Math.floor(rand() * 6), 0);
    if (start.getDay() === 0) start.setDate(start.getDate() - 2);
    if (start.getDay() === 6) start.setDate(start.getDate() - 1);
    sessions.push({
      id: `s${++sessionSeq}`,
      requestId: `legacy-${i}`,
      monitorId: monitor.id,
      studentId: student.id,
      topicId: topic,
      startsAt: start.toISOString(),
      minutes: [45, 60, 60, 90][Math.floor(rand() * 4)],
      attendance: "present",
      rating: rand() < 0.12 ? 3 : rand() < 0.5 ? 4 : 5,
      notes: "Sessão importada do registro manual do piloto.",
      location: locations[i % locations.length],
    });
  }

  const settings: Settings = {
    weights: { topic: 0.4, availability: 0.3, rating: 0.2, load: 0.1 },
    role: "coordinator",
    accent: "green",
    theme: "light",
    consentRequired: true,
    guardianConsentRequired: true,
    aggregateOnly: true,
    retentionDays: 365,
  };

  /* -------------------- espaço de alinhamento (professor ↔ monitor) ------------------- */
  // monitores de cada tópico lecionado — primeiro da lista "puxa" a conversa de exemplo
  const monitorForTopic = (topicId: string) => monitors.find((monitor) => monitor.topics.some((t) => t.topicId === topicId));

  const alignmentMessages: AlignmentMessage[] = [];
  const alignmentMeetings: AlignmentMeeting[] = [];
  let alignmentSeq = 0;

  const addMessage = (
    topicId: string,
    author: { role: "teacher" | "monitor"; id: string; name: string; color: Teacher["color"] },
    text: string,
    daysAgo: number,
    hour: number,
  ) => {
    alignmentSeq += 1;
    alignmentMessages.push({
      id: `am${String(alignmentSeq).padStart(2, "0")}`,
      topicId,
      authorRole: author.role,
      authorId: author.id,
      authorName: author.name,
      authorColor: author.color,
      text,
      createdAt: at(daysAgo, hour, Math.floor(rand() * 50)).toISOString(),
    });
  };

  const seedThread = (
    teacher: Teacher,
    topicId: string,
    exchange: { from: "teacher" | "monitor"; text: string; daysAgo: number; hour: number }[],
  ) => {
    const monitor = monitorForTopic(topicId);
    if (!monitor) return;
    exchange.forEach((entry) => {
      const author =
        entry.from === "teacher"
          ? { role: "teacher" as const, id: teacher.id, name: teacher.name, color: teacher.color }
          : { role: "monitor" as const, id: monitor.id, name: monitor.name, color: monitor.color };
      addMessage(topicId, author, entry.text, entry.daysAgo, entry.hour);
    });
  };

  seedThread(teachers[0], "mat", [
    {
      from: "teacher",
      text: "Pessoal, reparei que a maior parte dos pedidos de monitoria é em função do 1º grau e função afim. Dá pra reforçar isso na próxima aula?",
      daysAgo: 6,
      hour: 9,
    },
    {
      from: "monitor",
      text: "Sim! Quase todo mundo chega confuso com o gráfico, não com a fórmula. Talvez valha a pena começar a aula já desenhando, antes da parte algébrica.",
      daysAgo: 6,
      hour: 14,
    },
    {
      from: "teacher",
      text: "Boa, vou inverter a ordem na próxima turma. Bora marcar 20 minutos essa semana pra combinar os exemplos?",
      daysAgo: 5,
      hour: 10,
    },
  ]);

  seedThread(teachers[1], "prog", [
    {
      from: "monitor",
      text: "Professor, a galera trava bastante em índice de lista fora do intervalo. Dá pra fazer um exercício guiado disso antes da prova?",
      daysAgo: 4,
      hour: 16,
    },
    {
      from: "teacher",
      text: "Faz sentido, isso é recorrente mesmo. Vou incluir um exercício de depuração passo a passo na próxima aula.",
      daysAgo: 3,
      hour: 11,
    },
  ]);

  seedThread(teachers[2], "fis", [
    {
      from: "teacher",
      text: "Como está a procura por monitoria de óptica? Quero saber se vale reservar um horário extra de laboratório.",
      daysAgo: 2,
      hour: 15,
    },
  ]);

  // uma reunião futura de exemplo, já com link do Meet (modo demonstração)
  const matMonitor = monitorForTopic("mat");
  if (matMonitor) {
    alignmentSeq += 1;
    const scheduledAt = new Date(now);
    scheduledAt.setDate(scheduledAt.getDate() + 2);
    scheduledAt.setHours(16, 0, 0, 0);
    const code = "elo-mat-align";
    alignmentMeetings.push({
      id: `ak${String(alignmentSeq).padStart(2, "0")}`,
      topicId: "mat",
      title: "Alinhamento — Matemática I",
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: 30,
      meetLink: `https://meet.google.com/${code}`,
      meetCode: code,
      provider: "demo",
      createdByRole: "teacher",
      createdById: teachers[0].id,
      createdByName: teachers[0].name,
      createdAt: at(5, 10, 5).toISOString(),
      status: "scheduled",
    });
    addMessage(
      "mat",
      { role: "teacher", id: teachers[0].id, name: teachers[0].name, color: teachers[0].color },
      "Marquei a reunião no Google Meet — segue o link acima. Até lá!",
      5,
      10,
    );
  }

  return {
    topics: structuredClone(topics),
    students,
    monitors: structuredClone(monitors),
    teachers: structuredClone(teachers),
    requests,
    sessions,
    alignmentMessages,
    alignmentMeetings,
    accounts: [],
    settings,
    profile: blankCoordinatorProfile(),
    meta: { createdAt: now.toISOString(), version: 2 },
  };
}

/**
 * Conta da coordenação. Começa em branco, sem pessoa fictícia: quem usa o Elo
 * preenche nome e e-mail em Configurações → Meu perfil.
 */
export function blankCoordinatorProfile(): DemoProfile {
  return {
    id: "u1",
    name: "",
    role: "coordinator",
    className: "Coordenação pedagógica",
    email: "",
    campus: "IFRN — Campus Parnamirim",
    coordinatorView: true,
  };
}

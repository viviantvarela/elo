import type { HelpRequest, Match, MatchBreakdown, Monitor, PairingWeights, Slot } from "./types";
import { formatSlot, overlapMinutes } from "./utils";

/**
 * Algoritmo de pareamento do Elo.
 *
 * Cada monitor recebe uma pontuação de 0 a 100 combinando quatro componentes:
 *   (a) afinidade com o tópico      — nível declarado no assunto
 *   (b) compatibilidade de horários — sobreposição entre a janela pedida e a agenda
 *   (c) avaliação média recebida
 *   (d) carga já assumida           — penaliza quem está sobrecarregado
 *
 * Os pesos vivem em `settings.weights` e são calibrados no piloto (Meta 5).
 * Empate é resolvido por quem tem menos horas na semana.
 */

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function totalMinutes(slots: Slot[]) {
  return slots.reduce((sum, slot) => sum + Math.max(0, slot.end - slot.start), 0);
}

function availabilityOverlap(preferred: Slot[], available: Slot[]) {
  const requested = totalMinutes(preferred);
  if (requested === 0) return { ratio: 0, minutes: 0, slot: null as Slot | null };

  let best = { minutes: 0, slot: null as Slot | null };
  let minutes = 0;

  for (const want of preferred) {
    for (const have of available) {
      const overlap = overlapMinutes(want, have);
      if (overlap > best.minutes) {
        best = {
          minutes: overlap,
          slot: {
            day: want.day,
            start: Math.max(want.start, have.start),
            end: Math.min(want.end, have.end),
          },
        };
      }
      minutes += overlap;
    }
  }

  // sobreposição conta no máximo 2 h de cobertura: além disso não agrega
  const ratio = clamp01(Math.min(minutes, 120) / Math.min(requested, 120));
  return { ratio, minutes, slot: best.slot };
}

export function scoreMonitor(
  request: Pick<HelpRequest, "topicId" | "preferred">,
  monitor: Monitor,
  weights: PairingWeights,
): Match {
  const topic = monitor.topics.find((t) => t.topicId === request.topicId);
  const topicScore = topic ? clamp01(topic.level / 5) : 0;

  const availability = availabilityOverlap(request.preferred, monitor.availability);
  const ratingScore = monitor.rating > 0 ? clamp01(monitor.rating / 5) : 0.5;
  const loadScore = monitor.capacityHours > 0 ? clamp01(1 - monitor.weeklyHours / monitor.capacityHours) : 0;

  const breakdown: MatchBreakdown = {
    topic: topicScore,
    availability: availability.ratio,
    rating: ratingScore,
    load: loadScore,
  };

  const weightSum = weights.topic + weights.availability + weights.rating + weights.load || 1;
  const weighted =
    (breakdown.topic * weights.topic +
      breakdown.availability * weights.availability +
      breakdown.rating * weights.rating +
      breakdown.load * weights.load) /
    weightSum;

  const reasons: string[] = [];
  if (topic) {
    reasons.push(topic.level >= 4 ? "Domina o tópico" : "Já cursou o tópico");
  } else {
    reasons.push("Sem afinidade declarada");
  }
  if (availability.slot) {
    reasons.push(`${formatSlot(availability.slot.start, availability.slot.end)} em comum`);
  } else {
    reasons.push("Sem horário em comum");
  }
  if (monitor.rating > 0) reasons.push(`${monitor.rating.toFixed(1)} de avaliação`);
  if (monitor.capacityHours - monitor.weeklyHours <= 2) reasons.push("Agenda quase cheia");

  return {
    monitorId: monitor.id,
    score: Math.round(weighted * 100),
    breakdown,
    reasons,
    tieBreak: monitor.weeklyHours,
  };
}

/** Ranking completo — descarta quem não domina o tópico e ordena por score. */
export function rankMonitors(
  request: Pick<HelpRequest, "topicId" | "preferred">,
  monitors: Monitor[],
  weights: PairingWeights,
): Match[] {
  return monitors
    .map((monitor) => scoreMonitor(request, monitor, weights))
    .filter((match) => match.breakdown.topic > 0)
    .sort((a, b) => b.score - a.score || a.tieBreak - b.tieBreak);
}

export function bestMatch(
  request: Pick<HelpRequest, "topicId" | "preferred">,
  monitors: Monitor[],
  weights: PairingWeights,
): Match | null {
  return rankMonitors(request, monitors, weights)[0] ?? null;
}

/** Horas entre a abertura do pedido e o pareamento (ou agora, se ainda aberto). */
export function matchHours(request: HelpRequest, now = Date.now()) {
  const start = new Date(request.createdAt).getTime();
  const end = request.matchedAt ? new Date(request.matchedAt).getTime() : now;
  return Math.max(0, (end - start) / 36e5);
}

export function slaBucket(hours: number) {
  if (hours <= 24) return "até 24 h";
  if (hours <= 48) return "24–48 h";
  if (hours <= 96) return "48–96 h";
  return "mais de 96 h";
}

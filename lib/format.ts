import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function toDate(iso: string) {
  return parseISO(iso);
}

export function dayLabel(iso: string) {
  const date = parseISO(iso);
  const days = differenceInCalendarDays(date, new Date());
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days === -1) return "ontem";
  return format(date, "dd MMM", { locale: ptBR });
}

export function dateLabel(iso: string) {
  return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
}

export function timeLabel(iso: string) {
  return format(parseISO(iso), "HH:mm", { locale: ptBR });
}

export function dateTimeLabel(iso: string) {
  return format(parseISO(iso), "dd/MM · HH:mm", { locale: ptBR });
}

export function monthLabel(iso: string) {
  return format(parseISO(iso), "MMMM 'de' yyyy", { locale: ptBR });
}

export function weekdayLabel(day: number) {
  const names = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  return names[day] ?? "";
}

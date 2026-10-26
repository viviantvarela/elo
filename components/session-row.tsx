"use client";

import { Clock } from "lucide-react";
import Link from "next/link";

import { Avatar, Chip } from "@/components/ui";
import { dayLabel, timeLabel } from "@/lib/format";
import type { Monitor, PastelKey, Session, Topic } from "@/lib/types";

export function SessionRow({
  session,
  monitor,
  topic,
  counterpart,
  href,
  onComplete,
}: {
  session: Session;
  monitor?: Monitor | null;
  topic?: Topic | null;
  /** a outra pessoa do atendimento (ex.: o estudante, para o monitor). Padrão: o monitor. */
  counterpart?: { name: string; color: PastelKey } | null;
  /** abre o pedido da sessão (não combina com `onComplete`) */
  href?: string;
  onComplete?: () => void;
}) {
  const past = new Date(session.startsAt) < new Date();
  const person = counterpart ?? (monitor ? { name: monitor.name, color: monitor.color } : null);
  const className = "flex items-center gap-3 rounded-[14px] px-2.5 py-2.5 transition-colors hover:bg-surface-muted";

  const content = (
    <>
      <div className="flex w-11 shrink-0 flex-col items-center rounded-[10px] bg-surface-muted py-1">
        <span className="text-[10px] uppercase tracking-[0.06em] text-ink-faint">{dayLabel(session.startsAt)}</span>
        <span className="num text-[12.5px] font-semibold text-ink">{timeLabel(session.startsAt)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">{topic?.name ?? "Atendimento"}</p>
        <p className="truncate text-[11.5px] text-ink-soft">
          com {person?.name ?? "monitor"} · {session.minutes} min
          {session.location
            ? ` · ${/^https?:\/\//i.test(session.location) ? "sala remota" : session.location}`
            : ""}
        </p>
      </div>
      {onComplete && past && !href ? (
        <button
          onClick={onComplete}
          className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-medium text-accent-strong transition-colors hover:bg-accent-tint"
        >
          Registrar
        </button>
      ) : (
        <Chip tone={session.rating ? "accent" : "neutral"} className="shrink-0">
          {session.rating ? (
            `${session.rating}★`
          ) : (
            <>
              <Clock className="size-3" /> {session.minutes} min
            </>
          )}
        </Chip>
      )}
      <Avatar name={person?.name ?? "Monitor"} color={person?.color ?? "blue"} size="xs" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

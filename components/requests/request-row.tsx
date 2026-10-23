"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Avatar, Chip, Dot } from "@/components/ui";
import { statusLabels } from "@/lib/constants";
import { timeLabel } from "@/lib/format";
import type { HelpRequest, Student, Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusTone = {
  open: "warn",
  matched: "info",
  scheduled: "accent",
  done: "neutral",
  cancelled: "neutral",
} as const;

export function RequestRow({
  request,
  student,
  topic,
  onClick,
  href,
  compact,
  meta,
}: {
  request: HelpRequest;
  student?: Student | null;
  topic?: Topic | null;
  onClick?: () => void;
  /** vira link (ex.: do painel para o pedido em /pedidos) */
  href?: string;
  compact?: boolean;
  /** texto ao lado do tópico — por padrão, a turma do estudante */
  meta?: string;
}) {
  const className = cn(
    "group flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2.5 text-left transition-colors hover:bg-surface-muted",
    compact && "py-2",
  );

  const content = (
    <>
      <Avatar name={student?.name ?? "Estudante"} color={student?.color ?? "sage"} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-[13px] font-medium text-ink">
          <span className="truncate">{topic?.name ?? "Tópico"}</span>
          <Dot tone="neutral" className="opacity-40" />
          <span className="truncate text-[11.5px] font-normal text-ink-faint">{meta ?? student?.className}</span>
        </p>
        <p className="mt-0.5 truncate text-[11.5px] leading-snug text-ink-soft">{request.note}</p>
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <Chip tone={statusTone[request.status]}>{statusLabels[request.status]}</Chip>
        <span className="num text-[10.5px] text-ink-faint">{timeLabel(request.createdAt)}</span>
      </div>
      <ChevronRight className="size-4 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

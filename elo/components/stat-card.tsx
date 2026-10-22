"use client";

import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = "neutral",
  index = 0,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "neutral" | "accent" | "warn" | "danger";
  index?: number;
}) {
  const tones = {
    neutral: "bg-surface-muted text-ink-soft",
    accent: "bg-accent-soft text-accent-strong",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="card-hover rounded-[20px] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="label-xs leading-tight">{label}</span>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-[9px]", tones[tone])}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="num mt-2.5 text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink">
        {value}
        {unit ? <span className="ml-1 text-[13px] font-medium text-ink-faint">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1.5 text-[11.5px] leading-snug text-ink-soft">{hint}</p> : null}
    </motion.div>
  );
}

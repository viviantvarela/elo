"use client";

import { motion } from "motion/react";

import type { PastelKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const pastelStroke: Record<PastelKey, string> = {
  peach: "var(--ink-peach)",
  blue: "var(--ink-blue)",
  sage: "var(--ink-sage)",
  sand: "var(--ink-sand)",
  lilac: "var(--ink-lilac)",
};

/* ------------------------------- área / linha ------------------------------ */

export function AreaTrend({
  data,
  height = 150,
}: {
  data: { label: string; current: number; previous: number }[];
  height?: number;
}) {
  const width = 560;
  const padX = 20;
  const padTop = 14;
  const padBottom = 26;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const max = Math.max(4, ...data.map((point) => Math.max(point.current, point.previous))) * 1.15;

  const x = (index: number) => padX + (data.length === 1 ? innerW / 2 : (innerW / (data.length - 1)) * index);
  const y = (value: number) => padTop + innerH - (value / max) * innerH;

  const line = data.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.current)}`).join(" ");
  const previousLine = data
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.previous)}`)
    .join(" ");
  const area = `${line} L ${x(data.length - 1)} ${padTop + innerH} L ${x(0)} ${padTop + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Atendimentos por semana">
      <defs>
        <linearGradient id="elo-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.24" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {[0, 0.5, 1].map((ratio) => (
        <line
          key={ratio}
          x1={padX}
          x2={width - padX}
          y1={padTop + innerH * ratio}
          y2={padTop + innerH * ratio}
          stroke="var(--line)"
          strokeDasharray={ratio === 1 ? undefined : "3 5"}
        />
      ))}

      <motion.path
        d={area}
        fill="url(#elo-area)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      />
      <motion.path
        d={previousLine}
        fill="none"
        stroke="var(--ink-faint)"
        strokeWidth={1.5}
        strokeDasharray="4 4"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.25}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />

      {data.map((point, index) => (
        <g key={point.label}>
          <circle cx={x(index)} cy={y(point.current)} r={3.2} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} />
          <text x={x(index)} y={height - 8} textAnchor="middle" fontSize="10.5" fill="var(--ink-faint)">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ---------------------------------- donut --------------------------------- */

export function DonutChart({
  data,
  total,
  caption,
}: {
  data: { label: string; value: number; color: PastelKey }[];
  total: number;
  caption: string;
}) {
  const size = 132;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const sum = Math.max(1, data.reduce((acc, item) => acc + item.value, 0));

  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={caption}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-muted)" strokeWidth={stroke} />
          {data.map((item) => {
            const fraction = item.value / sum;
            const dash = fraction * circumference;
            const circle = (
              <motion.circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={pastelStroke[item.color]}
                strokeWidth={stroke}
                strokeLinecap="butt"
                strokeDasharray={`${dash} ${circumference - dash}`}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: -offset }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            );
            offset += dash;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-[22px] font-semibold leading-none text-ink">{total}</span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.08em] text-ink-faint">pedidos</span>
        </div>
      </div>
      <ul className="min-w-0 space-y-1.5">
        {data.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-[12.5px]">
            <span className={cn("size-2 rounded-full")} style={{ background: pastelStroke[item.color] }} />
            <span className="truncate text-ink-soft">{item.label}</span>
            <span className="num ml-auto font-medium text-ink">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------- barras --------------------------------- */

export function HBars({
  rows,
  suffix,
}: {
  rows: { label: string; value: number; max: number; color?: PastelKey; hint?: string }[];
  suffix?: string;
}) {
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const ratio = row.max > 0 ? Math.min(1, row.value / row.max) : 0;
        return (
          <li key={row.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[12.5px] text-ink-soft">{row.label}</span>
              <span className="num shrink-0 text-[12px] font-medium text-ink">
                {row.value}
                {suffix ? <span className="text-ink-faint"> {suffix}</span> : null}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <motion.div
                className="h-full rounded-full"
                style={{ background: row.color ? pastelStroke[row.color] : "var(--accent)" }}
                initial={{ width: 0 }}
                animate={{ width: `${ratio * 100}%` }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            {row.hint ? <p className="mt-1 text-[11px] text-ink-faint">{row.hint}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------- anel ---------------------------------- */

export function MiniRing({
  value,
  label,
  size = 74,
  tone = "accent",
}: {
  value: number;
  label: string;
  size?: number;
  tone?: "accent" | "danger" | "warn";
}) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamp = Math.max(0, Math.min(1, value));
  const colors = { accent: "var(--accent)", danger: "var(--danger)", warn: "var(--warn)" };

  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-muted)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - clamp) }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <span className="num absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-ink">
          {Math.round(clamp * 100)}%
        </span>
      </div>
      <span className="text-[12.5px] leading-snug text-ink-soft">{label}</span>
    </div>
  );
}

/* ------------------------------- satisfação ------------------------------- */

export function DistributionBars({
  data,
  max,
}: {
  data: { score: number; count: number }[];
  max: number;
}) {
  return (
    <div className="flex h-32 items-end gap-2">
      {data.map((item) => (
        <div key={item.score} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="num text-[11px] font-medium text-ink-soft">{item.count}</span>
          <motion.div
            className="w-full rounded-t-[8px] bg-accent"
            style={{ opacity: 0.35 + (item.score / 5) * 0.65 }}
            initial={{ height: 0 }}
            animate={{ height: `${max > 0 ? (item.count / max) * 100 : 0}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
          <span className="text-[11px] text-ink-faint">{item.score}★</span>
        </div>
      ))}
    </div>
  );
}

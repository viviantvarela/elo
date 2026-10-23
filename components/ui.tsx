"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

import type { PastelKey } from "@/lib/types";
import { cn, initials, pastelBg } from "@/lib/utils";

/* ---------------------------------- panel --------------------------------- */

export function Panel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[20px] border border-line bg-surface shadow-[var(--shadow-card)]", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------- chip ---------------------------------- */

type ChipTone = "neutral" | "accent" | "danger" | "warn" | "info";

const chipTones: Record<ChipTone, string> = {
  neutral: "bg-surface-muted text-ink-soft",
  accent: "bg-accent-soft text-accent-strong",
  danger: "bg-danger-soft text-danger",
  warn: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
};

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-medium leading-5",
        chipTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "accent", className }: { tone?: ChipTone; className?: string }) {
  const tones: Record<ChipTone, string> = {
    neutral: "bg-ink-faint",
    accent: "bg-accent",
    danger: "bg-danger",
    warn: "bg-warn",
    info: "bg-info",
  };
  return <span className={cn("size-1.5 shrink-0 rounded-full", tones[tone], className)} />;
}

/* --------------------------------- button --------------------------------- */

type ButtonVariant = "primary" | "soft" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong shadow-[0_6px_16px_-10px_var(--accent)]",
  soft: "bg-accent-soft text-accent-strong hover:bg-accent-tint",
  ghost: "text-ink-soft hover:bg-surface-muted hover:text-ink",
  outline: "border border-line bg-surface text-ink hover:bg-surface-muted",
  danger: "bg-danger-soft text-danger hover:brightness-95",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12.5px]",
  md: "h-9.5 px-4 text-[13px]",
  icon: "size-9 justify-center",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-full font-medium transition-[background,color,transform,box-shadow] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* --------------------------------- avatar --------------------------------- */

const avatarSizes = {
  xs: "size-6 text-[9.5px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-[13px]",
  lg: "size-14 text-[17px]",
};

export function Avatar({
  name,
  color = "sage",
  size = "md",
  className,
  ring,
}: {
  name: string;
  color?: PastelKey;
  size?: keyof typeof avatarSizes;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        pastelBg[color],
        avatarSizes[size],
        ring && "ring-2 ring-surface",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* -------------------------------- form bits ------------------------------- */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[12px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11.5px] text-ink-faint">{hint}</span> : null}
    </label>
  );
}

const controlClass =
  "w-full rounded-[12px] border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus-visible:outline-none";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, "h-9.5", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, "min-h-[76px] resize-none", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClass, "h-9.5 appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  /** nome acessível do controle */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:pointer-events-none disabled:opacity-45",
        checked ? "bg-accent" : "bg-surface-muted ring-1 ring-inset ring-line",
        className,
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0.5 size-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/* -------------------------------- segmented -------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("inline-flex rounded-full bg-surface-muted p-0.5", className)} role="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative rounded-full font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3 py-1.5 text-[12.5px]",
              active ? "text-accent-strong" : "text-ink-soft hover:text-ink",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`segmented-${options.map((o) => o.value).join("-")}`}
                className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgba(11,42,27,0.12)]"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- progress -------------------------------- */

export function ProgressBar({
  value,
  tone = "accent",
  className,
  height = "h-1.5",
}: {
  value: number;
  tone?: "accent" | "danger" | "warn";
  className?: string;
  height?: string;
}) {
  const tones = { accent: "bg-accent", danger: "bg-danger", warn: "bg-warn" };
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-surface-muted", height, className)}>
      <motion.div
        className={cn("h-full rounded-full", tones[tone])}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/* ---------------------------------- dialog -------------------------------- */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.button
            aria-label="Fechar"
            className="absolute inset-0 bg-deep/35 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className={cn(
              "relative w-full overflow-hidden rounded-t-[24px] border border-line bg-surface shadow-[0_30px_80px_-40px_rgba(4,21,13,0.6)] sm:rounded-[22px]",
              width,
            )}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight text-ink">{title}</h2>
                {description ? (
                  <p className="mt-1 max-w-md text-[12.5px] leading-snug text-ink-soft">{description}</p>
                ) : null}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
                <X className="size-4" />
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
            {footer ? (
              <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-muted/60 px-5 py-3.5">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/* --------------------------------- empty ---------------------------------- */

export function EmptyState({
  icon,
  title,
  detail,
  action,
}: {
  icon?: ReactNode;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon ? <div className="mb-1 text-ink-faint">{icon}</div> : null}
      <p className="text-[13.5px] font-medium text-ink">{title}</p>
      {detail ? <p className="max-w-sm text-[12.5px] leading-snug text-ink-soft">{detail}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* --------------------------------- skeleton -------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[12px] bg-surface-muted", className)} />;
}

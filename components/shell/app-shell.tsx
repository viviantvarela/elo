"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Command,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserRound,
  UserRoundPen,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SwitchUserDialog } from "@/components/shell/switch-user-dialog";
import { Avatar, Button, Dialog, EmptyState, Panel, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { canAccess, navItems, roleLabels } from "@/lib/constants";
import { useCurrentUser, visibleRequests } from "@/lib/current-user";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";

const icons = {
  gauge: LayoutDashboard,
  "life-buoy": LifeBuoy,
  users: Users,
  calendar: CalendarDays,
  chart: BarChart3,
  settings: Settings,
} as const;

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative inline-flex size-9 items-center justify-center rounded-[12px] bg-accent-soft">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <circle cx="9.2" cy="12" r="5.6" fill="none" stroke="var(--accent-strong)" strokeWidth="1.9" />
          <circle cx="14.8" cy="12" r="5.6" fill="none" stroke="var(--accent)" strokeWidth="1.9" opacity="0.62" />
        </svg>
      </span>
      {compact ? null : (
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight text-ink">Elo</span>
          <span className="block text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">IFRN · monitoria</span>
        </span>
      )}
    </span>
  );
}

/* --------------------------------- sidebar -------------------------------- */

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const role = user?.role ?? "coordinator";

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
    staleTime: 30_000,
  });
  const requests = useQuery({ queryKey: ["requests"], queryFn: api.listRequests, staleTime: 30_000 });

  // contador de abertos do ponto de vista de quem está usando: os próprios
  // pedidos (estudante), os do seu tópico (monitor) ou a fila toda (coordenação)
  const openCount =
    role === "coordinator"
      ? data?.stats.open ?? 0
      : visibleRequests(requests.data?.requests ?? [], user).filter((request) => request.status === "open").length;
  const items = user ? navItems.filter((item) => (item.roles as readonly string[]).includes(role)) : [];

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-1 pt-1">
        <Logo />
      </div>

      <nav className="flex flex-col gap-1" aria-label="Navegação principal">
        <span className="label-xs px-2 pb-1.5">Piloto · Out–Dez</span>
        {items.map((item) => {
          const Icon = icons[item.icon];
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-[13px] font-medium transition-colors",
                active ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-soft hover:bg-surface/70 hover:text-ink",
              )}
            >
              <Icon className={cn("size-4", active ? "text-accent" : "text-ink-faint group-hover:text-ink-soft")} />
              <span className="truncate">{item.label}</span>
              {item.href === "/pedidos" && openCount > 0 ? (
                <span className="num ml-auto rounded-full bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent-strong">
                  {openCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="rounded-[16px] border border-line bg-surface p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Meta do piloto</p>
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink-soft">
            Parear <span className="font-semibold text-ink">70%</span> dos pedidos em até 48 h.
          </p>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-700"
              style={{ width: `${Math.min(100, (data?.stats.matchedUnder48h ?? 0) * 100)}%` }}
            />
          </div>
          <p className="num mt-1.5 text-[11px] text-ink-faint">
            {Math.round((data?.stats.matchedUnder48h ?? 0) * 100)}% até agora
          </p>
        </div>
        <p className="px-1 text-[10.5px] leading-snug text-ink-faint">
          Dados de demonstração. Sem login por enquanto: troque de usuário no menu do topo.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------- user menu -------------------------------- */

function UserMenu() {
  const { user, isLoading } = useCurrentUser();
  const setSwitcherOpen = useUi((state) => state.setSwitcherOpen);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onClick = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3" aria-hidden>
        <Skeleton className="size-8 rounded-full" />
        <span className="hidden space-y-1 sm:block">
          <Skeleton className="h-2.5 w-24 rounded-full" />
          <Skeleton className="h-2 w-14 rounded-full" />
        </span>
      </div>
    );
  }

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-[11px] px-2 py-2 text-left text-[12.5px] font-medium text-ink transition-colors hover:bg-surface-muted";

  return (
    <div className="relative">
      <button
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 text-left transition-colors hover:bg-surface-muted"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu do usuário: ${user.displayName}, ${user.roleLabel}`}
      >
        <Avatar name={user.displayName} color={user.color} size="sm" />
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block max-w-[160px] truncate text-[12px] font-medium text-ink">{user.displayName}</span>
          <span className={cn("block text-[10.5px]", user.incomplete ? "text-warn" : "text-ink-faint")}>
            {user.incomplete ? "Complete seu perfil" : user.roleLabel}
          </span>
        </span>
        <ChevronDown className={cn("size-3.5 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Usuário"
          onClick={(event) => event.stopPropagation()}
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-[288px] overflow-hidden rounded-[16px] border border-line bg-surface p-1.5 shadow-[0_24px_60px_-30px_rgba(4,21,13,0.5)]"
        >
          <div className="flex items-center gap-3 px-2 pb-2.5 pt-2">
            <Avatar name={user.displayName} color={user.color} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">{user.displayName}</p>
              <p className="truncate text-[11.5px] text-ink-soft">{user.detail}</p>
              <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-accent-strong">
                {user.roleLabel}
              </p>
            </div>
          </div>

          {user.incomplete ? (
            <Link
              href="/configuracoes#perfil"
              onClick={() => setOpen(false)}
              className="mx-0.5 mb-1.5 flex items-start gap-2 rounded-[12px] bg-warn-soft px-2.5 py-2 text-[11.5px] leading-snug text-ink transition-[filter] hover:brightness-[0.98]"
            >
              <UserRoundPen className="mt-0.5 size-3.5 shrink-0 text-warn" />
              <span>
                <span className="font-medium">Seu perfil está sem nome.</span> Adicione nome e e-mail para se identificar
                no Elo.
              </span>
            </Link>
          ) : null}

          <div className="border-t border-line pt-1.5">
            <Link role="menuitem" href="/configuracoes#perfil" onClick={() => setOpen(false)} className={itemClass}>
              <UserRound className="size-4 text-ink-faint" /> Meu perfil
            </Link>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setSwitcherOpen(true);
              }}
              className={itemClass}
            >
              <ArrowLeftRight className="size-4 text-ink-faint" /> Trocar de usuário
            </button>
          </div>

          <p className="px-2 pb-1 pt-2 text-[10.5px] leading-snug text-ink-faint">
            Sem login por enquanto: a escolha de usuário fica salva neste navegador.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------- command menu ------------------------------ */

function CommandMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const { user } = useCurrentUser();
  const role = user?.role ?? "coordinator";
  const setSwitcherOpen = useUi((state) => state.setSwitcherOpen);
  const router = useRouter();

  const items = navItems
    .filter((item) => (item.roles as readonly string[]).includes(role))
    .filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  const actions = [
    {
      key: "profile",
      label: "Meu perfil",
      icon: UserRound,
      run: () => router.push("/configuracoes#perfil"),
    },
    {
      key: "switch",
      label: "Trocar de usuário",
      icon: ArrowLeftRight,
      run: () => setSwitcherOpen(true),
    },
  ].filter((action) => action.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <Dialog open={open} onClose={onClose} title="Ir para" description="Navegação rápida do Elo." width="max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar página…"
          className="h-10 w-full rounded-[12px] border border-line bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
      </div>
      <ul className="mt-3 space-y-1">
        {items.map((item) => {
          const Icon = icons[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-[13px] text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <Icon className="size-4 text-ink-faint" />
                {item.label}
              </Link>
            </li>
          );
        })}
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <li key={action.key}>
              <button
                onClick={() => {
                  onClose();
                  setQuery("");
                  action.run();
                }}
                className="flex w-full items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[13px] text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <Icon className="size-4 text-ink-faint" />
                {action.label}
              </button>
            </li>
          );
        })}
        {items.length === 0 && actions.length === 0 ? (
          <li className="px-2.5 py-3 text-[12.5px] text-ink-faint">Nada encontrado.</li>
        ) : null}
      </ul>
    </Dialog>
  );
}

/* --------------------------------- topbar --------------------------------- */

function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const theme = useUi((state) => state.theme);
  const setTheme = useUi((state) => state.setTheme);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Abrir menu">
        <Menu className="size-4" />
      </Button>

      <button
        onClick={() => setCommandOpen(true)}
        className="hidden h-9 w-full max-w-[280px] items-center gap-2 rounded-full border border-line bg-surface-muted px-3 text-left text-[12.5px] text-ink-faint transition-colors hover:bg-surface sm:flex"
      >
        <Search className="size-3.5" />
        <span>Buscar no Elo…</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
          <Command className="size-2.5" />K
        </span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <UserMenu />
      </div>

      <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} />
    </header>
  );
}

/* -------------------------------- app shell ------------------------------- */

/** Página fora do papel atual (ex.: estudante abrindo Relatórios pela URL). */
function NoAccess({ roleLabel }: { roleLabel: string }) {
  const setSwitcherOpen = useUi((state) => state.setSwitcherOpen);
  return (
    <Panel>
      <EmptyState
        icon={<Lock className="size-6" />}
        title="Esta página não faz parte do seu perfil"
        detail={`Você está usando o Elo como ${roleLabel}. Volte ao painel ou troque de usuário para ver esta página.`}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/painel"
              className="inline-flex h-9.5 items-center gap-2 rounded-full bg-accent px-4 text-[13px] font-medium text-white transition-colors hover:bg-accent-strong"
            >
              Ir para o painel
            </Link>
            <Button variant="outline" onClick={() => setSwitcherOpen(true)}>
              <ArrowLeftRight className="size-4" /> Trocar de usuário
            </Button>
          </div>
        }
      />
    </Panel>
  );
}

function PageSkeleton() {
  return (
    <div aria-hidden>
      <div className="mb-5 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[118px] rounded-[20px]" />
        ))}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sidebarOpen = useUi((state) => state.sidebarOpen);
  const setSidebarOpen = useUi((state) => state.setSidebarOpen);
  const { user, isLoading, isError, retry } = useCurrentUser();

  return (
    <div className="min-h-dvh bg-canvas p-2 sm:p-3 lg:p-4">
      <div className="mx-auto flex h-[calc(100dvh-16px)] max-w-[1560px] overflow-hidden rounded-[24px] bg-surface shadow-[var(--shadow-window)] sm:h-[calc(100dvh-24px)] sm:rounded-[28px] lg:h-[calc(100dvh-32px)]">
        <aside className="hidden w-[240px] shrink-0 border-r border-line bg-surface-muted lg:block">
          <SidebarContent />
        </aside>

        {sidebarOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              aria-label="Fechar menu"
              className="absolute inset-0 bg-deep/40 backdrop-blur-[2px]"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative h-full w-[260px] border-r border-line bg-surface-muted shadow-2xl">
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute right-3 top-3 rounded-full p-1.5 text-ink-faint hover:bg-surface"
                aria-label="Fechar menu"
              >
                <X className="size-4" />
              </button>
              <SidebarContent onNavigate={() => setSidebarOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenMenu={() => setSidebarOpen(true)} />
          <main key={pathname} className="page-enter flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            {/* as telas dependem de quem está usando: espera a identidade antes de renderizar */}
            {isError ? (
              <Panel>
                <EmptyState
                  title="Não foi possível carregar o seu usuário"
                  detail="Confira a conexão e tente de novo. Se persistir, veja /api/health."
                  action={
                    <Button variant="outline" onClick={() => void retry()}>
                      Tentar de novo
                    </Button>
                  }
                />
              </Panel>
            ) : isLoading || !user ? (
              <PageSkeleton />
            ) : canAccess(pathname, user.role) ? (
              children
            ) : (
              <NoAccess roleLabel={roleLabels[user.role]} />
            )}
          </main>
        </div>
      </div>

      <SwitchUserDialog />
    </div>
  );
}

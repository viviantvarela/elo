"use client";

import { Check, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Avatar, Chip, Dialog, Segmented, Skeleton } from "@/components/ui";
import { canAccess, monitorKindLabels, roleLabels } from "@/lib/constants";
import { useCurrentUser } from "@/lib/current-user";
import type { PastelKey, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";

interface Entry {
  id: string;
  name: string;
  detail: string;
  color: PastelKey;
  extra?: string;
  online?: boolean;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Troca de usuário enquanto não há login: escolhe quem está usando o Elo neste
 * navegador. A tela de login vai substituir este passo — o restante do app já
 * lê a identidade por `useCurrentUser()`.
 */
export function SwitchUserDialog() {
  const open = useUi((state) => state.switcherOpen);
  const setOpen = useUi((state) => state.setSwitcherOpen);
  const setIdentity = useUi((state) => state.setIdentity);
  const { user, people } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();

  const [tab, setTab] = useState<Role>("coordinator");
  const [query, setQuery] = useState("");

  const currentRole = user?.role;
  useEffect(() => {
    if (!open) return;
    setTab(currentRole ?? "coordinator");
    setQuery("");
  }, [open, currentRole]);

  const entries = useMemo<Entry[]>(() => {
    if (!people) return [];

    if (tab === "coordinator") {
      const name = people.coordinator.name.trim();
      return [
        {
          id: people.coordinator.id,
          name: name || roleLabels.coordinator,
          detail:
            [people.coordinator.className, people.coordinator.campus].filter(Boolean).join(" · ") ||
            "Conta da coordenação",
          color: "sage",
          extra: name ? undefined : "Perfil sem nome — complete em Configurações",
        },
      ];
    }

    const q = normalize(query.trim());
    const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name, "pt-BR");
    const matches = (entry: Entry) =>
      q.length === 0 || normalize(`${entry.name} ${entry.detail} ${entry.extra ?? ""}`).includes(q);

    if (tab === "student") {
      return people.students
        .map((student) => ({
          id: student.id,
          name: student.name,
          detail: [student.className, student.course].filter(Boolean).join(" · "),
          color: student.color,
        }))
        .filter(matches)
        .sort(byName);
    }

    if (tab === "teacher") {
      return people.teachers
        .map((teacher) => ({
          id: teacher.id,
          name: teacher.name,
          detail: teacher.className,
          color: teacher.color,
          extra: teacher.topics
            .map((topicId) => people.topics.find((topic) => topic.id === topicId)?.name ?? topicId)
            .join(" · "),
        }))
        .filter(matches)
        .sort(byName);
    }

    return people.monitors
      .map((monitor) => ({
        id: monitor.id,
        name: monitor.name,
        detail: [monitor.className, monitorKindLabels[monitor.kind]].filter(Boolean).join(" · "),
        color: monitor.color,
        online: monitor.online,
        extra: monitor.topics
          .map((entry) => people.topics.find((topic) => topic.id === entry.topicId)?.name ?? entry.topicId)
          .join(" · "),
      }))
      .filter(matches)
      .sort(byName);
  }, [people, tab, query]);

  const choose = (entry: Entry) => {
    const same = user?.role === tab && user.id === entry.id;
    setOpen(false);
    if (same) return;

    setIdentity(tab, tab === "coordinator" ? null : entry.id);
    toast.success(`Agora você está usando o Elo como ${entry.name}.`);
    if (!canAccess(pathname, tab)) router.push("/painel");
  };

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Trocar de usuário"
      description="Enquanto a tela de login não chega, escolha quem está usando o Elo neste navegador. Cada usuário vê a própria navegação, pedidos e agenda."
      width="max-w-lg"
    >
      <div className="space-y-2.5 pb-3">
        <Segmented
          size="sm"
          value={tab}
          onChange={(value) => {
            setTab(value);
            setQuery("");
          }}
          options={[
            { value: "coordinator", label: roleLabels.coordinator },
            { value: "student", label: `Estudantes · ${people?.students.length ?? 0}` },
            { value: "monitor", label: `Monitores · ${people?.monitors.length ?? 0}` },
            { value: "teacher", label: `Professores · ${people?.teachers.length ?? 0}` },
          ]}
        />
        {tab !== "coordinator" ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === "student" ? "Buscar por nome, turma ou curso…" : "Buscar por nome ou tópico…"}
              aria-label="Buscar usuário"
              className="h-9 w-full rounded-full border border-line bg-surface-muted pl-8 pr-3 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
          </div>
        ) : null}
      </div>

      {!people ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        tab === "teacher" ? (
          <p className="px-1 py-6 text-center text-[12.5px] text-ink-soft">Nenhum professor cadastrado ainda.</p>
        ) : (
          <p className="px-1 py-6 text-center text-[12.5px] text-ink-soft">Ninguém encontrado com “{query}”.</p>
        )
      ) : (
        <ul
          className="-mr-2 max-h-[min(52vh,440px)] space-y-1 overflow-y-auto pr-2"
          aria-label={`Usuários: ${roleLabels[tab]}`}
        >
          {entries.map((entry) => {
            const active = user?.role === tab && user.id === entry.id;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => choose(entry)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors",
                    active ? "bg-accent-tint ring-1 ring-inset ring-accent/25" : "hover:bg-surface-muted",
                  )}
                >
                  <span className="relative">
                    <Avatar name={entry.name} color={entry.color} size="sm" />
                    {entry.online ? (
                      <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-accent" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{entry.name}</span>
                    <span className="block truncate text-[11.5px] text-ink-soft">{entry.detail}</span>
                    {entry.extra ? (
                      <span className={cn("block truncate text-[11px]", tab === "coordinator" ? "text-warn" : "text-ink-faint")}>
                        {entry.extra}
                      </span>
                    ) : null}
                  </span>
                  {active ? (
                    <Chip tone="accent" className="shrink-0">
                      <Check className="size-3" /> atual
                    </Chip>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "coordinator" ? (
        <p className="mt-3 rounded-[12px] border border-line bg-surface-muted/70 px-3 py-2.5 text-[11.5px] leading-snug text-ink-soft">
          A conta da coordenação vê toda a fila, pareia, agenda e acompanha os relatórios. Nome, e-mail e campus ficam em
          Configurações → Meu perfil.
        </p>
      ) : null}
    </Dialog>
  );
}

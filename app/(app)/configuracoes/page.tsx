"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookPlus,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { ProfilePanel } from "@/components/profile/profile-panel";
import { NewTopicDialog } from "@/components/topics/new-topic-dialog";
import {
  Avatar,
  Button,
  Chip,
  Dialog,
  Field,
  Input,
  Panel,
  PanelHeader,
  ProgressBar,
  Segmented,
  Select,
  Skeleton,
  Switch,
} from "@/components/ui";
import { api } from "@/lib/api";
import { accentOptions } from "@/lib/constants";
import { useCurrentUser } from "@/lib/current-user";
import type { AccentKey, PairingWeights, Settings, Student, Topic } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";

const weightLabels: { key: keyof PairingWeights; label: string; hint: string }[] = [
  { key: "topic", label: "Afinidade com o tópico", hint: "nível declarado no assunto" },
  { key: "availability", label: "Compatibilidade de horário", hint: "janelas em comum" },
  { key: "rating", label: "Avaliação média", hint: "nota recebida nos atendimentos" },
  { key: "load", label: "Carga assumida", hint: "penaliza quem já está cheio" },
];

const accentSwatch: Record<AccentKey, string> = {
  green: "#2e7d53",
  ocean: "#2b6ea8",
  plum: "#6b4a9e",
  rose: "#a84463",
  amber: "#986f16",
};

const privacyItems: {
  key: "consentRequired" | "guardianConsentRequired" | "aggregateOnly";
  title: string;
  detail: string;
}[] = [
  {
    key: "consentRequired",
    title: "Consentimento no primeiro acesso",
    detail: "Termo LGPD aceito antes de registrar pedidos.",
  },
  {
    key: "guardianConsentRequired",
    title: "Autorização de responsável",
    detail: "Exigida para estudantes sem termo de responsável ativo.",
  },
  {
    key: "aggregateOnly",
    title: "Relatórios apenas agregados",
    detail: "Anonimiza nomes individuais nas tabelas e exportação CSV.",
  },
];

const retentionLabel = (days: number) =>
  days === 180 ? "180 dias" : days === 730 ? "2 anos" : days === 365 ? "1 ano" : `${days} dias`;

const courses = ["Informática", "Mecatrônica", "Redes de Computadores", "Edificações"];

export default function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const { user, people } = useCurrentUser();
  const isCoordinator = user?.role === "coordinator";

  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const [weights, setWeights] = useState<PairingWeights | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);
  const [studentOpen, setStudentOpen] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");

  useEffect(() => {
    if (!data) return;
    setWeights(data.settings.weights);
  }, [data]);

  const saveSettings = useMutation({
    mutationFn: (patch: Partial<Settings>) => api.saveSettings(patch),
    onSuccess: () => {
      toast.success("Preferências salvas.");
      for (const key of ["settings", "dashboard", "requests", "request", "reports"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteTopic = useMutation({
    mutationFn: (id: string) => api.deleteTopic(id),
    onSuccess: () => {
      toast.success("Tópico removido do catálogo.");
      for (const key of ["topics", "people", "dashboard", "requests", "reports"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleGuardian = useMutation({
    mutationFn: ({ id, guardianConsent }: { id: string; guardianConsent: boolean }) =>
      api.updateStudent(id, { guardianConsent }),
    onSuccess: () => {
      toast.success("Autorização atualizada.");
      void queryClient.invalidateQueries({ queryKey: ["people"] });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetDemo = useMutation({
    mutationFn: api.resetDemo,
    onSuccess: () => {
      toast.success("Base de demonstração restaurada.");
      setConfirmReset(false);
      void queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredStudents = useMemo(() => {
    const list = people?.students ?? [];
    const q = studentQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q) ||
        s.course.toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q),
    );
  }, [people?.students, studentQuery]);

  if (isLoading || !data || !weights || !user) {
    return (
      <>
        <PageHeader eyebrow="Sua conta" title="Configurações" subtitle="Carregando…" />
        <div className="space-y-3">
          <Skeleton className="h-[220px] rounded-[20px]" />
          <Skeleton className="h-[260px] rounded-[20px]" />
        </div>
      </>
    );
  }

  const settings = data.settings;
  const sum = weights.topic + weights.availability + weights.rating + weights.load;
  const normalized = (value: number) => (sum > 0 ? value / sum : 0);
  const profile = <ProfilePanel user={user} topics={people?.topics ?? []} />;

  return (
    <>
      <PageHeader
        eyebrow={isCoordinator ? "Ajustes do piloto" : "Sua conta"}
        title="Configurações"
        subtitle={
          isCoordinator
            ? "Seu perfil, pesos do algoritmo, catálogo curricular, estudantes e políticas LGPD."
            : "Seu perfil no Elo, a aparência do app e como os seus dados são tratados."
        }
        actions={
          isCoordinator ? (
            <Button onClick={() => saveSettings.mutate({ weights })} disabled={saveSettings.isPending}>
              <Save className="size-4" /> Salvar pesos
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {isCoordinator ? (
          <Panel>
            <PanelHeader
              title="Pesos do pareamento"
              subtitle="A soma é normalizada automaticamente — o documento promete calibrar estes pesos ao fim do piloto (Meta 5)."
              action={
                <Chip tone="accent">
                  <Sliders className="size-3" /> {Math.round(sum * 100)}%
                </Chip>
              }
            />
            <div className="space-y-4 p-5">
              {weightLabels.map((item) => (
                <div key={item.key}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[12.5px] font-medium text-ink">{item.label}</span>
                    <span className="num text-[12px] text-ink-soft">{Math.round(normalized(weights[item.key]) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(weights[item.key] * 100)}
                    onChange={(event) => setWeights({ ...weights, [item.key]: Number(event.target.value) / 100 })}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-muted accent-[var(--accent)]"
                    aria-label={item.label}
                  />
                  <p className="mt-1 text-[10.5px] text-ink-faint">{item.hint}</p>
                </div>
              ))}

              <div className="rounded-[14px] border border-line bg-surface-muted/60 p-3">
                <p className="label-xs mb-1.5">Efeito agora</p>
                <ProgressBar value={normalized(weights.topic)} height="h-2" />
                <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">
                  Afinidade responde por {Math.round(normalized(weights.topic) * 100)}% da pontuação final. Empates são
                  resolvidos por quem tem menos horas na semana.
                </p>
              </div>
            </div>
          </Panel>
        ) : (
          profile
        )}

        <div className="space-y-3">
          {isCoordinator ? profile : null}
          <AppearancePanel />
          {isCoordinator ? null : <PrivacySummary settings={data.settings} />}
        </div>
      </div>

      {isCoordinator ? (
        <>
          {/* ------------------------ tópicos & estudantes ------------------- */}
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
            <Panel>
              <PanelHeader
                title="Catálogo de tópicos"
                subtitle={`${people?.topics.length ?? 0} tópicos curriculares ativos.`}
                action={
                  <Button variant="outline" size="sm" onClick={() => setTopicOpen(true)}>
                    <BookPlus className="size-3.5" /> Adicionar
                  </Button>
                }
              />
              <ul className="space-y-1.5 p-3">
                {(people?.topics ?? []).map((t: Topic) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-[12px] border border-line px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium text-ink">{t.name}</p>
                      <p className="truncate text-[11px] text-ink-soft">{t.component}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-ink-faint hover:text-danger"
                      aria-label={`Remover ${t.name}`}
                      onClick={() => deleteTopic.mutate(t.id)}
                      disabled={deleteTopic.isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <PanelHeader
                title="Estudantes & LGPD"
                subtitle="Gerencie autorizações de responsáveis (menores de 18 anos) e cadastre discentes."
                action={
                  <Button variant="outline" size="sm" onClick={() => setStudentOpen(true)}>
                    <UserPlus className="size-3.5" /> Novo estudante
                  </Button>
                }
              />
              <div className="p-3">
                <div className="relative mb-2.5">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
                  <input
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Buscar estudante por nome, turma ou e-mail…"
                    className="h-9 w-full rounded-full border border-line bg-surface-muted pl-8 pr-3 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                  />
                </div>
                <ul className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
                  {filteredStudents.map((s: Student) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-[12px] border border-line px-2.5 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={s.name} color={s.color} size="xs" />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium text-ink">{s.name}</p>
                          <p className="truncate text-[10.5px] text-ink-soft">
                            {[s.className, s.course, s.email].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={cn("text-[10.5px]", s.guardianConsent ? "text-accent-strong" : "text-warn")}>
                          {s.guardianConsent ? "autorizado" : "pendente"}
                        </span>
                        <Switch
                          checked={s.guardianConsent}
                          onChange={(checked) => toggleGuardian.mutate({ id: s.id, guardianConsent: checked })}
                          label={`Autorização do responsável de ${s.name}`}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </div>

          {/* -------------------------------- LGPD ---------------------------- */}
          <Panel className="mt-3">
            <PanelHeader
              title="Privacidade e LGPD"
              subtitle="Minimização, consentimento e autorização de responsáveis aplicadas pelo servidor."
              action={
                <Chip tone="accent">
                  <ShieldCheck className="size-3" /> em conformidade
                </Chip>
              }
            />
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {privacyItems.map((item) => {
                const value = settings[item.key];
                return (
                  <button
                    key={item.key}
                    onClick={() => saveSettings.mutate({ [item.key]: !value })}
                    className="flex items-center gap-3 rounded-[14px] border border-line p-3 text-left transition-colors hover:bg-surface-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-ink">{item.title}</p>
                      <p className="text-[11px] leading-snug text-ink-soft">{item.detail}</p>
                    </div>
                    <span
                      className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                        value ? "bg-accent" : "bg-surface-muted",
                      )}
                      role="switch"
                      aria-checked={value}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                          value ? "translate-x-[18px]" : "translate-x-0.5",
                        )}
                      />
                    </span>
                  </button>
                );
              })}

              <div className="flex items-center gap-3 rounded-[14px] border border-line p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-ink">Retenção dos dados</p>
                  <p className="text-[11px] leading-snug text-ink-soft">Exclusão automática ao fim do período.</p>
                </div>
                <Select
                  value={String(settings.retentionDays)}
                  onChange={(event) => saveSettings.mutate({ retentionDays: Number(event.target.value) })}
                  className="w-28"
                >
                  <option value="180">180 dias</option>
                  <option value="365">1 ano</option>
                  <option value="730">2 anos</option>
                </Select>
              </div>
            </div>
          </Panel>

          {/* ------------------------------- reset ---------------------------- */}
          <Panel className="mt-3">
            <PanelHeader
              title="Base de demonstração do piloto"
              subtitle="Restaura os 22 estudantes, 8 monitores, 33 pedidos e 37 sessões iniciais para apresentações."
            />
            <div className="flex flex-wrap items-center gap-3 p-5">
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                <RotateCcw className="size-4" /> Restaurar dados de demonstração
              </Button>
              <p className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
                <Sparkles className="size-3.5" /> Preserva seu perfil de coordenação (nome, e-mail e campus).
              </p>
            </div>
          </Panel>

          <Dialog
            open={confirmReset}
            onClose={() => setConfirmReset(false)}
            title="Restaurar a base?"
            description="Pedidos, sessões, estudantes, monitores e pesos voltam ao estado da semente. Seu perfil da coordenação é mantido."
            footer={
              <>
                <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                  Cancelar
                </Button>
                <Button variant="danger" onClick={() => resetDemo.mutate()} disabled={resetDemo.isPending}>
                  Restaurar
                </Button>
              </>
            }
          >
            <p className="text-[12.5px] text-ink-soft">
              Útil antes de apresentar: a fila volta ao estado inicial e os indicadores ficam consistentes.
            </p>
          </Dialog>

          <NewTopicDialog open={topicOpen} onClose={() => setTopicOpen(false)} />
          <NewStudentDialog open={studentOpen} onClose={() => setStudentOpen(false)} />
        </>
      ) : null}
    </>
  );
}

function NewStudentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [className, setClassName] = useState("1º ano INFO");
  const [course, setCourse] = useState("Informática");
  const [guardianConsent, setGuardianConsent] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setClassName("1º ano INFO");
    setCourse("Informática");
    setGuardianConsent(true);
  }, [open]);

  const mutation = useMutation({
    mutationFn: api.createStudent,
    onSuccess: (student) => {
      toast.success(`Estudante ${student.name} cadastrado(a)!`);
      for (const key of ["people", "students", "requests", "dashboard"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cadastrar estudante"
      description="Adicione um discente ao piloto. Se informar o e-mail institucional, o perfil será vinculado automaticamente no login."
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) {
                toast.error("Informe o nome do estudante.");
                return;
              }
              mutation.mutate({
                name: name.trim(),
                email: email.trim() || undefined,
                className: className.trim(),
                course,
                guardianConsent,
              });
            }}
            disabled={mutation.isPending}
          >
            <Plus className="size-4" /> {mutation.isPending ? "Cadastrando…" : "Cadastrar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nome completo">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Mariana Costa" maxLength={80} />
        </Field>
        <Field label="E-mail institucional (opcional)">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mariana@escolar.ifrn.edu.br"
            maxLength={120}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Turma">
            <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="1º ano INFO" maxLength={60} />
          </Field>
          <Field label="Curso">
            <Select value={course} onChange={(e) => setCourse(e.target.value)}>
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-[12px] border border-line bg-surface-muted/60 px-3 py-2.5">
          <span className="text-[12px] text-ink">Termo do responsável entregue / maior de 18 anos</span>
          <Switch checked={guardianConsent} onChange={setGuardianConsent} label="Autorização do responsável" />
        </div>
      </div>
    </Dialog>
  );
}

/* -------------------------------- aparência -------------------------------- */

function AppearancePanel() {
  const accent = useUi((state) => state.accent);
  const setAccent = useUi((state) => state.setAccent);
  const theme = useUi((state) => state.theme);
  const setTheme = useUi((state) => state.setTheme);

  return (
    <Panel>
      <PanelHeader title="Aparência" subtitle="Paleta de destaque e tema — valem só para este navegador." />
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap gap-2">
          {accentOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => setAccent(option.key as AccentKey)}
              aria-pressed={accent === option.key}
              className={cn(
                "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11.5px] transition-colors",
                accent === option.key ? "border-accent bg-accent-tint text-accent-strong" : "border-line text-ink-soft",
              )}
            >
              <span className="size-3 rounded-full" style={{ background: accentSwatch[option.key as AccentKey] }} />
              {option.label}
            </button>
          ))}
        </div>
        <Segmented
          value={theme}
          onChange={setTheme}
          options={[
            { value: "light", label: "Claro" },
            { value: "dark", label: "Escuro" },
          ]}
        />
      </div>
    </Panel>
  );
}

/* --------------------------- privacidade (leitura) ------------------------- */

function PrivacySummary({ settings }: { settings: Settings }) {
  return (
    <Panel>
      <PanelHeader
        title="Seus dados e a LGPD"
        subtitle="Regras definidas pela coordenação do piloto."
        action={
          <Chip tone="accent">
            <ShieldCheck className="size-3" /> em conformidade
          </Chip>
        }
      />
      <ul className="space-y-1.5 p-3">
        {privacyItems.map((item) => (
          <li key={item.key} className="flex items-center gap-3 rounded-[12px] border border-line px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-ink">{item.title}</p>
              <p className="text-[11px] leading-snug text-ink-soft">{item.detail}</p>
            </div>
            <Chip tone={settings[item.key] ? "accent" : "neutral"} className="shrink-0">
              {settings[item.key] ? "ativo" : "desativado"}
            </Chip>
          </li>
        ))}
        <li className="flex items-center gap-3 rounded-[12px] border border-line px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-ink">Retenção dos dados</p>
            <p className="text-[11px] leading-snug text-ink-soft">Exclusão automática ao fim do período.</p>
          </div>
          <Chip tone="neutral" className="num shrink-0">
            {retentionLabel(settings.retentionDays)}
          </Chip>
        </li>
      </ul>
    </Panel>
  );
}

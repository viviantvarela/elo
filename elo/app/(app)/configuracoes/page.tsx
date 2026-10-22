"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save, ShieldCheck, Sliders, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button, Chip, Dialog, Field, Input, Panel, PanelHeader, ProgressBar, Segmented, Select, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { accentOptions, roleLabels } from "@/lib/constants";
import type { AccentKey, PairingWeights, Role, Settings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";

const weightLabels: { key: keyof PairingWeights; label: string; hint: string }[] = [
  { key: "topic", label: "Afinidade com o tópico", hint: "nível declarado no assunto" },
  { key: "availability", label: "Compatibilidade de horário", hint: "janelas em comum" },
  { key: "rating", label: "Avaliação média", hint: "nota recebida nos atendimentos" },
  { key: "load", label: "Carga assumida", hint: "penaliza quem já está cheio" },
];

export default function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const uiAccent = useUi((state) => state.accent);
  const setAccent = useUi((state) => state.setAccent);
  const uiTheme = useUi((state) => state.theme);
  const setTheme = useUi((state) => state.setTheme);
  const uiRole = useUi((state) => state.role);
  const setRole = useUi((state) => state.setRole);

  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const [weights, setWeights] = useState<PairingWeights | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [campus, setCampus] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!data) return;
    setWeights(data.settings.weights);
    setName(data.profile.name);
    setEmail(data.profile.email);
    setCampus(data.profile.campus);
  }, [data]);

  const saveSettings = useMutation({
    mutationFn: (patch: Partial<Settings>) => api.saveSettings(patch),
    onSuccess: () => {
      toast.success("Preferências salvas.");
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["request"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveProfile = useMutation({
    mutationFn: () => api.saveProfile({ name, email, campus }),
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
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

  if (isLoading || !data || !weights) {
    return (
      <>
        <PageHeader eyebrow="Ajustes do piloto" title="Configurações" subtitle="Carregando…" />
        <div className="space-y-3">
          <Skeleton className="h-[220px] rounded-[20px]" />
          <Skeleton className="h-[260px] rounded-[20px]" />
        </div>
      </>
    );
  }

  const sum = weights.topic + weights.availability + weights.rating + weights.load;
  const normalized = (value: number) => (sum > 0 ? value / sum : 0);

  return (
    <>
      <PageHeader
        eyebrow="Ajustes do piloto"
        title="Configurações"
        subtitle="Pesos do algoritmo, aparência e as garantias de privacidade que sustentam o projeto."
        actions={
          <Button
            onClick={() => saveSettings.mutate({ weights })}
            disabled={saveSettings.isPending}
          >
            <Save className="size-4" /> Salvar pesos
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* ------------------------------ pareamento ------------------------ */}
        <Panel>
          <PanelHeader
            title="Pesos do pareamento"
            subtitle="A soma é normalizada automaticamente — o documento promete calibrar estes pesos ao fim do piloto (Meta 5)."
            action={<Chip tone="accent"><Sliders className="size-3" /> {Math.round(sum * 100)}%</Chip>}
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
                  onChange={(event) =>
                    setWeights({ ...weights, [item.key]: Number(event.target.value) / 100 })
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-muted accent-[var(--accent)]"
                  aria-label={item.label}
                />
                <p className="mt-1 text-[10.5px] text-ink-faint">{item.hint}</p>
              </div>
            ))}

            <div className="rounded-[14px] border border-line bg-surface-muted/60 p-3">
              <p className="label-xs mb-1.5">Efeito agora</p>
              <ProgressBar
                value={normalized(weights.topic)}
                height="h-2"
              />
              <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">
                Afinidade responde por {Math.round(normalized(weights.topic) * 100)}% da pontuação final. Empates são
                resolvidos por quem tem menos horas na semana.
              </p>
            </div>
          </div>
        </Panel>

        <div className="space-y-3">
          {/* ------------------------------ aparência --------------------- */}
          <Panel>
            <PanelHeader title="Aparência" subtitle="Paleta de destaque e tema — herdados do design system." />
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap gap-2">
                {accentOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => {
                      setAccent(option.key as AccentKey);
                      saveSettings.mutate({ accent: option.key as AccentKey });
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11.5px] transition-colors",
                      uiAccent === option.key ? "border-accent bg-accent-tint text-accent-strong" : "border-line text-ink-soft",
                    )}
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{
                        background:
                          option.key === "green"
                            ? "#2e7d53"
                            : option.key === "ocean"
                              ? "#2b6ea8"
                              : option.key === "plum"
                                ? "#6b4a9e"
                                : option.key === "rose"
                                  ? "#a84463"
                                  : "#986f16",
                      }}
                    />
                    {option.label}
                  </button>
                ))}
              </div>
              <Segmented
                value={uiTheme}
                onChange={(value) => {
                  setTheme(value);
                  saveSettings.mutate({ theme: value });
                }}
                options={[
                  { value: "light", label: "Claro" },
                  { value: "dark", label: "Escuro" },
                ]}
              />
            </div>
          </Panel>

          {/* -------------------------------- perfil ---------------------- */}
          <Panel>
            <PanelHeader title="Perfil do piloto" subtitle="Quem responde pela coordenação na demonstração." />
            <div className="space-y-3 p-5">
              <Field label="Nome">
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="E-mail">
                <Input value={email} onChange={(event) => setEmail(event.target.value)} />
              </Field>
              <Field label="Campus">
                <Input value={campus} onChange={(event) => setCampus(event.target.value)} />
              </Field>
              <Field label="Papel na demonstração" hint="Troca a navegação e o painel, como se fosse outro usuário.">
                <Select
                  value={uiRole}
                  onChange={(event) => {
                    const role = event.target.value as Role;
                    setRole(role);
                    saveSettings.mutate({ role });
                  }}
                >
                  {(["coordinator", "monitor", "student"] as Role[]).map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button variant="outline" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                <Save className="size-4" /> Salvar perfil
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      {/* -------------------------------- LGPD ------------------------------ */}
      <Panel className="mt-3">
        <PanelHeader
          title="Privacidade e LGPD"
          subtitle="Minimização, consentimento e autorização de responsáveis para menores de 18 anos."
          action={<Chip tone="accent"><ShieldCheck className="size-3" /> em conformidade</Chip>}
        />
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          {[
            {
              key: "consentRequired" as const,
              title: "Consentimento no primeiro acesso",
              detail: "Termo aceito antes de registrar pedidos.",
              value: data.settings.consentRequired,
            },
            {
              key: "guardianConsentRequired" as const,
              title: "Autorização de responsável",
              detail: "Exigida para estudantes menores de 18 anos.",
              value: data.settings.guardianConsentRequired,
            },
            {
              key: "aggregateOnly" as const,
              title: "Painel apenas agregado",
              detail: "Coordenação vê números, não desempenho individual.",
              value: data.settings.aggregateOnly,
            },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => saveSettings.mutate({ [item.key]: !item.value })}
              className="flex items-center gap-3 rounded-[14px] border border-line p-3 text-left transition-colors hover:bg-surface-muted/60"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-ink">{item.title}</p>
                <p className="text-[11px] leading-snug text-ink-soft">{item.detail}</p>
              </div>
              <span
                className={cn(
                  "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                  item.value ? "bg-accent" : "bg-surface-muted",
                )}
                role="switch"
                aria-checked={item.value}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                    item.value ? "translate-x-[18px]" : "translate-x-0.5",
                  )}
                />
              </span>
            </button>
          ))}

          <div className="flex items-center gap-3 rounded-[14px] border border-line p-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-ink">Retenção dos dados</p>
              <p className="text-[11px] leading-snug text-ink-soft">Exclusão automática ao fim do período.</p>
            </div>
            <Select
              value={String(data.settings.retentionDays)}
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

      {/* ------------------------------- reset ------------------------------ */}
      <Panel className="mt-3">
        <PanelHeader title="Ambiente de demonstração" subtitle="Sem autenticação real: o papel na topbar simula três visões." />
        <div className="flex flex-wrap items-center gap-3 p-5">
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="size-4" /> Restaurar dados de demonstração
          </Button>
          <p className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
            <Sparkles className="size-3.5" /> Recria a semente: 16 estudantes, 8 monitores, 30 pedidos e o histórico de
            sessões.
          </p>
        </div>
      </Panel>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Restaurar a base?"
        description="Todos os pedidos, sessões e ajustes criados nesta demonstração serão substituídos pela semente."
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
    </>
  );
}

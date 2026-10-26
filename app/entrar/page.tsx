"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, GraduationCap, KeyRound, MessagesSquare, ShieldCheck, Sparkles, UserCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/shell/app-shell";
import { Button, Chip, Field, Input, Panel, Segmented, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { CAMPUS, firstAccessibleHref } from "@/lib/constants";
import { getSupabaseBrowserClient, isDemoModeEnabled, isSupabaseClientConfigured } from "@/lib/supabase-browser";
import type { Role } from "@/lib/types";
import { useUi } from "@/store/ui";

type Mode = "login" | "signup";

const courses = ["Informática", "Mecatrônica", "Redes de Computadores", "Edificações"];

export default function EntrarPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setIdentity = useUi((s) => s.setIdentity);
  const setSupabaseSession = useUi((s) => s.setSupabaseSession);

  const supabaseReady = isSupabaseClientConfigured();
  const demoEnabled = isDemoModeEnabled();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [className, setClassName] = useState("1º ano INFO");
  const [course, setCourse] = useState("Informática");
  const [desiredRole, setDesiredRole] = useState<Role>("student");
  const [guardianConsent, setGuardianConsent] = useState(true);
  const [acceptConsent, setAcceptConsent] = useState(true);
  const [pending, setPending] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const isStaffEmail = normalizedEmail.endsWith("@ifrn.edu.br") && !normalizedEmail.endsWith("@escolar.ifrn.edu.br");

  const enterDemoAs = (role: Role, personId?: string | null, label?: string) => {
    setIdentity(role, personId);
    void queryClient.invalidateQueries();
    toast.success(label ? `Modo demonstração: ${label}` : "Modo demonstração ativado.");
    router.push(firstAccessibleHref(role));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const sb = getSupabaseBrowserClient();
    if (!sb) {
      toast.error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para usar o login Supabase.");
      return;
    }

    if (!normalizedEmail || !password) {
      toast.error("Preencha seu e-mail institucional e senha.");
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        toast.error("Informe seu nome completo.");
        return;
      }
      if (!normalizedEmail.endsWith(".ifrn.edu.br") && !normalizedEmail.endsWith("@ifrn.edu.br")) {
        toast.error("Use seu e-mail institucional (@escolar.ifrn.edu.br ou @ifrn.edu.br).");
        return;
      }
      if (password.length < 6) {
        toast.error("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (!acceptConsent) {
        toast.error("Confirme o termo de consentimento de dados (LGPD) para criar sua conta.");
        return;
      }
    }

    setPending(true);
    try {
      if (mode === "signup") {
        const roleForSignup: Role =
          isStaffEmail && (desiredRole === "coordinator" || desiredRole === "teacher") ? desiredRole : "student";
        const { data, error } = await sb.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              name: name.trim(),
              className: className.trim(),
              course,
              campus: CAMPUS,
              desiredRole: roleForSignup,
              guardianConsent,
              acceptConsent,
            },
          },
        });
        if (error) throw new Error(error.message);

        const token = data.session?.access_token;
        if (!token) {
          toast.success("Conta criada! Verifique seu e-mail institucional para confirmar o acesso.");
          setMode("login");
          return;
        }

        const { actor } = await api.syncAuthAccount(token, {
          name: name.trim(),
          className: className.trim(),
          course,
          campus: CAMPUS,
          desiredRole: roleForSignup,
          guardianConsent,
          acceptConsent,
        });

        setSupabaseSession({
          email: normalizedEmail,
          accessToken: token,
          role: actor.role,
          studentId: actor.studentId ?? null,
          monitorId: actor.monitorId ?? null,
          teacherId: actor.teacherId ?? null,
        });
        await queryClient.invalidateQueries();
        toast.success("Conta institucional criada com sucesso!");
        router.push(firstAccessibleHref(actor.role));
        return;
      }

      const { data, error } = await sb.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        throw new Error(
          error.message.includes("Invalid login credentials")
            ? "E-mail ou senha incorretos."
            : error.message,
        );
      }

      const token = data.session?.access_token;
      if (!token) throw new Error("Sessão não retornada pelo Supabase Auth.");

      const { actor } = await api.syncAuthAccount(token);
      setSupabaseSession({
        email: normalizedEmail,
        accessToken: token,
        role: actor.role,
        studentId: actor.studentId ?? null,
        monitorId: actor.monitorId ?? null,
        teacherId: actor.teacherId ?? null,
      });
      await queryClient.invalidateQueries();
      toast.success("Sessão iniciada com sucesso.");
      router.push(firstAccessibleHref(actor.role));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível autenticar.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas p-3 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100dvh-24px)] max-w-[1040px] items-center gap-6 sm:min-h-[calc(100dvh-48px)] lg:grid-cols-[1.05fr_1fr]">
        {/* Coluna institucional */}
        <div className="space-y-5 px-2 text-white">
          <div className="inline-flex rounded-2xl bg-white/95 px-3.5 py-2 shadow-lg">
            <Logo />
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-200/90">
              {CAMPUS} · Projeto de Extensão
            </p>
            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[36px]">
              Monitoria entre pares com pareamento inteligente e horas certificáveis.
            </h1>
            <p className="max-w-lg text-[14px] leading-relaxed text-emerald-50/85">
              Conecte dúvidas reais a monitores e colegas apoiadores considerando afinidade no tópico, horários em comum,
              alinhamento direto com professores e equilíbrio de carga semanal.
            </p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {[
              { title: "Estudantes", desc: "Pedem ajuda por tópico e avaliam o atendimento." },
              { title: "Monitores", desc: "Aceitam pedidos, agendam e somam horas automáticas." },
              { title: "Professores", desc: "Alinham foco das aulas com monitores e agendam no Meet." },
              { title: "Coordenação", desc: "Calibra pesos, gerencia vagas e acompanha indicadores." },
            ].map((item) => (
              <div key={item.title} className="rounded-[16px] border border-white/15 bg-white/8 p-3 backdrop-blur-sm">
                <p className="text-[12.5px] font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-[11.5px] leading-snug text-emerald-100/80">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cartão de autenticação */}
        <Panel className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[17px] font-semibold text-ink">
                {mode === "login" ? "Entrar no Elo" : "Criar conta institucional"}
              </h2>
              <p className="text-[12px] text-ink-soft">
                Autenticação via Supabase Auth para discentes e servidores do IFRN.
              </p>
            </div>
            <Chip tone={supabaseReady ? "accent" : "neutral"}>
              <KeyRound className="size-3" /> {supabaseReady ? "Supabase ativo" : "Config local"}
            </Chip>
          </div>

          <Segmented
            className="mb-4 w-full"
            value={mode}
            onChange={(value) => setMode(value)}
            options={[
              { value: "login", label: "Já tenho conta" },
              { value: "signup", label: "Criar conta IFRN" },
            ]}
          />

          {!supabaseReady ? (
            <div className="mb-4 rounded-[14px] border border-line bg-surface-muted/70 p-3 text-[12px] leading-snug text-ink-soft">
              Para ativar login real neste ambiente, adicione <code className="font-mono text-ink">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
              <code className="font-mono text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no <code className="font-mono text-ink">.env.local</code>{" "}
              (veja <code className="font-mono text-ink">DEPLOY.md</code>). Enquanto isso, use o <strong>Modo demonstração</strong> abaixo.
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            {mode === "signup" ? (
              <Field label="Nome completo">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Isabela Freitas"
                  autoComplete="name"
                  maxLength={80}
                />
              </Field>
            ) : null}

            <Field
              label="E-mail institucional"
              hint={mode === "signup" ? "Aceita @escolar.ifrn.edu.br (discentes) ou @ifrn.edu.br (servidores)." : undefined}
            >
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@escolar.ifrn.edu.br"
                autoComplete="email"
                maxLength={120}
              />
            </Field>

            <Field label="Senha">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Mínimo de 6 caracteres" : "Sua senha"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </Field>

            {mode === "signup" && isStaffEmail ? (
              <Field label="Perfil de acesso (@ifrn.edu.br)">
                <Segmented
                  size="sm"
                  value={desiredRole}
                  onChange={(val) => setDesiredRole(val)}
                  options={[
                    { value: "coordinator", label: "Coordenação" },
                    { value: "teacher", label: "Professor(a)" },
                    { value: "student", label: "Estudante" },
                  ]}
                />
              </Field>
            ) : null}

            {mode === "signup" && isStaffEmail && desiredRole === "teacher" ? (
              <Field label="Disciplina / função">
                <Input
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Ex.: Professora de Matemática I"
                  maxLength={80}
                />
              </Field>
            ) : null}

            {mode === "signup" && (!isStaffEmail || desiredRole === "student") ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Turma">
                  <Input
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="1º ano INFO"
                    maxLength={60}
                  />
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
            ) : null}

            {mode === "signup" ? (
              <div className="space-y-2 rounded-[14px] border border-line bg-surface-muted/60 p-3 text-[11.5px] text-ink-soft">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={acceptConsent}
                    onChange={(e) => setAcceptConsent(e.target.checked)}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <span>
                    Concordo com o uso mínimo dos meus dados acadêmicos exclusivamente para pareamento e registro de
                    monitoria (LGPD — Lei 13.709/2018).
                  </span>
                </label>
                {!isStaffEmail ? (
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={guardianConsent}
                      onChange={(e) => setGuardianConsent(e.target.checked)}
                      className="mt-0.5 accent-[var(--accent)]"
                    />
                    <span>Sou maior de 18 anos ou já entreguei autorização do responsável à coordenação.</span>
                  </label>
                ) : null}
              </div>
            ) : null}

            <Button type="submit" className="w-full justify-center" disabled={pending || !supabaseReady}>
              {pending ? "Autenticando…" : mode === "login" ? "Entrar com e-mail institucional" : "Criar conta e entrar"}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          {demoEnabled ? (
            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
                  <Sparkles className="size-3.5 text-accent" /> Acesso rápido para apresentação
                </span>
                <span className="text-[11px] text-ink-faint">1 clique · sem senha</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => enterDemoAs("coordinator", null, "Coordenação")}
                  className="flex flex-col items-start rounded-[14px] border border-line bg-surface p-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent-tint"
                >
                  <ShieldCheck className="size-4 text-accent" />
                  <span className="mt-1.5 text-[12.5px] font-semibold text-ink">Coordenação</span>
                  <span className="text-[10.5px] text-ink-faint">Fila toda, pesos e vagas</span>
                </button>
                <button
                  type="button"
                  onClick={() => enterDemoAs("monitor", "m1", "Helena Prado (Monitora)")}
                  className="flex flex-col items-start rounded-[14px] border border-line bg-surface p-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent-tint"
                >
                  <Users className="size-4 text-accent" />
                  <span className="mt-1.5 text-[12.5px] font-semibold text-ink">Monitor(a)</span>
                  <span className="text-[10.5px] text-ink-faint">Helena · Matemática</span>
                </button>
                <button
                  type="button"
                  onClick={() => enterDemoAs("teacher", "t1", "Roberta Austregésilo (Professora)")}
                  className="flex flex-col items-start rounded-[14px] border border-line bg-surface p-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent-tint"
                >
                  <MessagesSquare className="size-4 text-accent" />
                  <span className="mt-1.5 text-[12.5px] font-semibold text-ink">Professor(a)</span>
                  <span className="text-[10.5px] text-ink-faint">Roberta · Alinhamento & Meet</span>
                </button>
                <button
                  type="button"
                  onClick={() => enterDemoAs("student", "a1", "Ana Beatriz (Estudante)")}
                  className="flex flex-col items-start rounded-[14px] border border-line bg-surface p-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent-tint"
                >
                  <GraduationCap className="size-4 text-accent" />
                  <span className="mt-1.5 text-[12.5px] font-semibold text-ink">Estudante</span>
                  <span className="text-[10.5px] text-ink-faint">Ana Beatriz · 1º INFO</span>
                </button>
              </div>
              <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
                <UserCheck className="size-3.5 shrink-0" /> Em produção estrita, defina{" "}
                <code className="font-mono">NEXT_PUBLIC_DEMO_MODE=false</code> para exigir apenas login institucional.
              </p>
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

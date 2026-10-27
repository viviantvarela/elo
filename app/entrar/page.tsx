"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Eye, EyeOff, GraduationCap, MessagesSquare, ShieldCheck, Sparkles, UserCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";


import { Field, Input, Panel, Select, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { CAMPUS, firstAccessibleHref } from "@/lib/constants";
import {
  getSupabaseBrowserClient,
  isDemoModeEnabled,
  isSupabaseClientConfigured,
  setSupabaseSessionPersistence,
} from "@/lib/supabase-browser";
import type { Role } from "@/lib/types";
import { useUi } from "@/store/ui";

type Mode = "login" | "signup" | "recovery";

const courses = ["Informática", "Mecatrônica", "Redes de Computadores", "Edificações"];

function EloMark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <svg viewBox="0 0 64 40" className="h-8 w-12" fill="none" aria-hidden>
        <rect x="3" y="7" width="34" height="26" rx="13" stroke={dark ? "var(--deep)" : "currentColor"} strokeWidth="5" />
        <rect x="27" y="7" width="34" height="26" rx="13" stroke="var(--accent)" strokeWidth="5" />
      </svg>
      <span className={`text-2xl font-bold tracking-tight ${dark ? "text-deep" : "text-white"}`}>elo</span>
    </span>
  );
}

export default function EntrarPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setIdentity = useUi((s) => s.setIdentity);
  const setSupabaseSession = useUi((s) => s.setSupabaseSession);

  const supabaseReady = isSupabaseClientConfigured();
  const demoEnabled = isDemoModeEnabled();

  const [mode, setMode] = useState<Mode>("login");
  const [loginRole, setLoginRole] = useState<"student" | "monitor">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("1º ano INFO");
  const [course, setCourse] = useState("Informática");
  const [desiredRole, setDesiredRole] = useState<Role>("student");
  const [guardianConsent, setGuardianConsent] = useState(true);
  const [acceptConsent, setAcceptConsent] = useState(true);
  const [pending, setPending] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setMode("recovery");
  }, []);

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
    if (mode === "recovery") {
      if (password.length < 6) {
        toast.error("A nova senha deve ter pelo menos 6 caracteres.");
        return;
      }
      const sb = getSupabaseBrowserClient();
      if (!sb) {
        toast.error("Configure o Supabase para redefinir sua senha.");
        return;
      }
      setPending(true);
      try {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw new Error(error.message);
        toast.success("Senha atualizada. Você já pode entrar.");
        window.history.replaceState(null, "", "/entrar");
        setPassword("");
        setMode("login");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a senha.");
      } finally {
        setPending(false);
      }
      return;
    }

    setSupabaseSessionPersistence(keepConnected);
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

      setSupabaseSessionPersistence(keepConnected);
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

  const requestPasswordReset = async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) {
      toast.error("Configure o Supabase para recuperar sua senha.");
      return;
    }
    if (!normalizedEmail) {
      toast.error("Informe seu e-mail institucional primeiro.");
      return;
    }
    setPending(true);
    try {
      const { error } = await sb.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/entrar`,
      });
      if (error) throw new Error(error.message);
      toast.success("Enviamos um link de recuperação para seu e-mail institucional.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o link de recuperação.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface">
      <div className="grid min-h-dvh lg:grid-cols-[1.08fr_1fr]">
        <section className="relative hidden overflow-hidden bg-deep p-8 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/95 px-3 py-2">
              <EloMark dark />
            </div>
          </div>
          <div className="pointer-events-none absolute -right-32 top-1/4 opacity-30">
            <svg viewBox="0 0 240 160" className="h-[340px] w-[540px]" fill="none" aria-hidden>
              <circle cx="92" cy="80" r="52" stroke="var(--accent)" strokeWidth="8" />
              <circle cx="148" cy="80" r="52" stroke="var(--accent)" strokeWidth="8" />
            </svg>
          </div>
          <div className="relative max-w-xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Monitoria entre pares · {CAMPUS}
            </p>
            <h1 className="max-w-lg text-5xl font-semibold leading-[0.98] tracking-[-0.04em] xl:text-6xl">
              Quem sabe ajuda.<br />Quem precisa <span className="text-accent">encontra.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-white/70">
              Conecte-se a colegas que dominam o assunto da sua dúvida, no horário que funciona para você.
            </p>
            <div className="mt-9 flex max-w-lg flex-wrap gap-2">
              {["Matemática", "Física", "Português", "Química", "Programação", "Inglês"].map((topic) => (
                <span key={topic} className="rounded-full border border-white/20 px-3.5 py-1.5 text-xs text-white/85">
                  {topic}
                </span>
              ))}
            </div>
          </div>
          <p className="relative text-xs text-white/45">Projeto de extensão · código aberto</p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <Panel className="w-full max-w-[440px] border-0 bg-transparent p-0 shadow-none">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <EloMark dark />
          </div>
          <div className="mb-8">
            <h2 className="text-4xl font-semibold tracking-[-0.04em] text-ink">
              {mode === "login" ? "Bem-vindo de volta" : mode === "recovery" ? "Redefina sua senha" : "Crie sua conta"}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              {mode === "login"
                ? "Entre com seu e-mail institucional do IFRN."
                : mode === "recovery"
                  ? "Escolha uma nova senha para continuar."
                : "Faça parte da monitoria entre pares."}
            </p>
          </div>

          {mode === "login" ? (
            <div className="mb-6 grid grid-cols-2 rounded-full bg-surface-muted p-1">
              <button type="button" onClick={() => setLoginRole("student")} className={`rounded-full px-3 py-2.5 text-sm font-semibold transition ${loginRole === "student" ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-soft"}`}>
                Preciso de ajuda
              </button>
              <button type="button" onClick={() => setLoginRole("monitor")} className={`rounded-full px-3 py-2.5 text-sm font-semibold transition ${loginRole === "monitor" ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-soft"}`}>
                Sou monitor
              </button>
            </div>
          ) : null}

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

            <Field label="E-mail institucional" hint={mode === "signup" ? "Use @escolar.ifrn.edu.br ou @ifrn.edu.br." : undefined}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@escolar.ifrn.edu.br"
                autoComplete="email"
                maxLength={120}
              />
            </Field>

            <Field label={mode === "recovery" ? "Nova senha" : "Senha"}>
              {mode === "login" ? (
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void requestPasswordReset()}
                    disabled={pending}
                    className="text-xs font-medium text-accent-strong hover:underline"
                  >
                    Esqueci a senha
                  </button>
                </div>
              ) : null}
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" || mode === "recovery" ? "Mínimo de 6 caracteres" : "Sua senha"}
                  autoComplete={mode === "signup" || mode === "recovery" ? "new-password" : "current-password"}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-faint hover:text-ink"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
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

            {mode === "login" ? (
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" /> Manter conectado
              </label>
            ) : null}

            <button type="submit" className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60" disabled={pending || !supabaseReady}>
              {pending ? "Aguarde…" : mode === "login" ? "Entrar" : mode === "recovery" ? "Atualizar senha" : "Criar conta e entrar"}
              <ArrowRight className="size-4" />
            </button>
          </form>

          {mode === "login" ? (
            <>
              <div className="my-7 flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
              </div>
              <button
                type="button"
                onClick={() => toast.info("A integração com o SUAP ainda precisa ser configurada.")}
                className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface text-sm font-semibold text-ink transition hover:border-accent"
              >
                <span className="grid size-6 place-items-center rounded-md bg-accent-soft text-xs font-bold text-accent-strong">S</span>
                Entrar com SUAP
              </button>
              <p className="mt-7 text-center text-sm text-ink-soft">
                Primeira vez aqui?{" "}
                <button type="button" onClick={() => setMode("signup")} className="font-semibold text-accent-strong underline decoration-accent decoration-2 underline-offset-4">
                  Criar conta
                </button>
              </p>
            </>
          ) : mode === "signup" ? (
            <p className="mt-7 text-center text-sm text-ink-soft">
              Já possui uma conta?{" "}
              <button type="button" onClick={() => setMode("login")} className="font-semibold text-accent-strong underline decoration-accent decoration-2 underline-offset-4">
                Entrar
              </button>
            </p>
          ) : (
            <p className="mt-7 text-center text-sm text-ink-soft">
              Lembrou a senha?{" "}
              <button type="button" onClick={() => setMode("login")} className="font-semibold text-accent-strong underline decoration-accent decoration-2 underline-offset-4">
                Voltar para entrar
              </button>
            </p>
          )}

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
          <p className="mt-7 text-center text-xs text-ink-faint">Seus dados são tratados conforme a LGPD.</p>
          </Panel>
        </section>
      </div>
    </div>
  );
}

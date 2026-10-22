"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Target, TrendingUp } from "lucide-react";

import { DistributionBars, HBars } from "@/components/charts";
import { PageHeader } from "@/components/page-header";
import { Avatar, Button, Chip, EmptyState, Panel, PanelHeader, ProgressBar, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

function toCsv(rows: (string | number)[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell).replace(/"/g, '""');
          return /[";\n]/.test(value) ? `"${value}"` : value;
        })
        .join(";"),
    )
    .join("\n");
}

export default function RelatoriosPage() {
  const { data, isLoading } = useQuery({ queryKey: ["reports"], queryFn: api.getReports });

  if (isLoading || !data) {
    return (
      <>
        <PageHeader eyebrow="Indicadores do piloto" title="Relatórios" subtitle="Carregando indicadores…" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[128px] rounded-[20px]" />
          ))}
        </div>
      </>
    );
  }

  const maxSla = Math.max(1, ...data.sla.map((item) => item.count));
  const maxSatisfaction = Math.max(1, ...data.satisfaction.map((item) => item.count));
  const totalMinutes = data.hoursByMonitor.reduce((sum, row) => sum + row.minutes, 0);

  const exportCsv = () => {
    const header = ["Monitor", "Sessões", "Minutos", "Horas", "Último registro"];
    const rows = data.hoursByMonitor.map((row) => [
      row.name,
      row.sessions,
      row.minutes,
      row.hours.toFixed(1).replace(".", ","),
      row.lastReportAt ? dateLabel(row.lastReportAt) : "—",
    ]);
    const csv = toCsv([header, ...rows, ["Total", data.hoursByMonitor.reduce((s, r) => s + r.sessions, 0), totalMinutes, (totalMinutes / 60).toFixed(1).replace(".", ","), ""]]);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "elo-relatorio-horas.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        eyebrow="Metas do projeto · Parte 3"
        title="Relatórios do piloto"
        subtitle="Os seis indicadores de referência, as horas por monitor e a demanda que não encontrou atendimento."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> Exportar CSV
          </Button>
        }
      />

      {/* ----------------------------- indicadores --------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.indicators.map((indicator, index) => {
          const ok = indicator.progress === null ? null : indicator.progress >= 1;
          return (
            <div
              key={indicator.key}
              style={{ animationDelay: `${index * 45}ms` }}
              className="rise card-hover rounded-[20px] border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="label-xs leading-tight">{indicator.label}</span>
                <Chip tone={ok === null ? "neutral" : ok ? "accent" : "warn"}>
                  <Target className="size-3" /> {indicator.target}
                </Chip>
              </div>
              <p className="num mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] text-ink">
                {indicator.value}
              </p>
              {indicator.progress !== null ? (
                <div className="mt-3">
                  <ProgressBar
                    value={Math.min(1, indicator.progress)}
                    tone={indicator.progress >= 1 ? "accent" : indicator.progress >= 0.7 ? "warn" : "danger"}
                  />
                </div>
              ) : null}
              <p className="mt-2 text-[11px] leading-snug text-ink-faint">{indicator.hint}</p>
            </div>
          );
        })}
      </div>

      {/* -------------------------------- horas ------------------------------ */}
      <Panel className="mt-3">
        <PanelHeader
          title="Relatório de horas por monitor"
          subtitle="Gerado automaticamente a cada sessão registrada — a base da certificação."
          action={
            <Chip tone="accent">
              <FileText className="size-3" /> {(totalMinutes / 60).toFixed(1).replace(".", ",")} h no total
            </Chip>
          }
        />
        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-[560px] border-separate border-spacing-y-0.5 text-left">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                <th className="px-2 py-1.5 font-semibold">Monitor</th>
                <th className="px-2 py-1.5 text-right font-semibold">Sessões</th>
                <th className="px-2 py-1.5 text-right font-semibold">Minutos</th>
                <th className="px-2 py-1.5 text-right font-semibold">Horas</th>
                <th className="px-2 py-1.5 text-right font-semibold">Último registro</th>
              </tr>
            </thead>
            <tbody>
              {data.hoursByMonitor.map((row) => (
                <tr key={row.monitorId} className="rounded-[12px] transition-colors hover:bg-surface-muted/60">
                  <td className="rounded-l-[12px] px-2 py-2">
                    <span className="flex items-center gap-2">
                      <Avatar name={row.name} color={row.color} size="xs" />
                      <span className="text-[12.5px] font-medium text-ink">{row.name}</span>
                    </span>
                  </td>
                  <td className="num px-2 py-2 text-right text-[12.5px] text-ink-soft">{row.sessions}</td>
                  <td className="num px-2 py-2 text-right text-[12.5px] text-ink-soft">{row.minutes}</td>
                  <td className="num px-2 py-2 text-right text-[12.5px] font-semibold text-ink">
                    {row.hours.toFixed(1).replace(".", ",")}
                  </td>
                  <td className="num rounded-r-[12px] px-2 py-2 text-right text-[12px] text-ink-soft">
                    {row.lastReportAt ? dateLabel(row.lastReportAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ------------------------------ demanda ------------------------------ */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Demanda por tópico"
            subtitle="Pedidos e demanda que ficou sem monitor — o dado que a coordenação não tinha."
          />
          <div className="space-y-3 p-5">
            {data.demandByTopic.map((topic) => (
              <div key={topic.topicId}>
                <div className="mb-1 flex items-center justify-between text-[12.5px]">
                  <span className="text-ink">{topic.name}</span>
                  <span className="num text-ink-soft">
                    {topic.total} pedidos
                    {topic.unserved > 0 ? (
                      <span className="text-danger"> · {topic.unserved} sem monitor</span>
                    ) : null}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className={cn("h-full rounded-full")}
                    style={{
                      width: `${(topic.total / Math.max(1, ...data.demandByTopic.map((item) => item.total))) * 100}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
                <p className="mt-1 text-[10.5px] text-ink-faint">
                  espera média até o pareamento: {topic.avgWaitHours.toFixed(1).replace(".", ",")} h
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel>
            <PanelHeader title="Tempo até o pareamento" subtitle="Distribuição do SLA dos pedidos já pareados." />
            <div className="p-5">
              <HBars
                rows={data.sla.map((item) => ({
                  label: item.bucket,
                  value: item.count,
                  max: maxSla,
                  color: item.bucket === "até 24 h" ? "sage" : item.bucket === "24–48 h" ? "blue" : item.bucket === "48–96 h" ? "sand" : "peach",
                }))}
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Avaliações das sessões" subtitle="Notas de 1 a 5 dadas pelos estudantes." />
            <div className="p-5">
              <DistributionBars data={data.satisfaction} max={maxSatisfaction} />
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="mt-3">
        <PanelHeader
          title="Leitura rápida"
          subtitle="Como usar estes números na apresentação de dezembro."
          action={<Chip tone="neutral"><TrendingUp className="size-3" /> piloto</Chip>}
        />
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {[
            {
              title: "Pareamento",
              text: "O indicador de 48 h mostra se o algoritmo está entregando monitor no tempo que o estudante tem para estudar.",
            },
            {
              title: "Horas",
              text: "O relatório automático substitui a planilha manual — e é o que viabiliza a certificação do monitor.",
            },
            {
              title: "Demanda",
              text: "Tópicos com pedidos e sem monitor são a evidência para abrir vagas de monitoria no próximo edital.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-[14px] border border-line bg-surface-muted/50 p-3">
              <p className="text-[12.5px] font-semibold text-ink">{item.title}</p>
              <p className="mt-1 text-[11.5px] leading-snug text-ink-soft">{item.text}</p>
            </div>
          ))}
        </div>
      </Panel>

      {data.indicators.length === 0 ? (
        <Panel className="mt-3">
          <EmptyState title="Sem indicadores" detail="Registre pedidos para começar a medir." />
        </Panel>
      ) : null}
    </>
  );
}

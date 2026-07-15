import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { format, subDays, startOfDay, endOfDay, parseISO, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Users,
  RefreshCw,
  Search,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import logoAsset from "@/assets/dherma-logo.asset.json";
import { fetchAgendamentos, fetchClientes, type Agendamento, type Cliente } from "@/lib/dherma-api";
import { formatPhone } from "@/lib/format";
import { AtendimentoPanel } from "@/components/AtendimentoPanel";
import { HelenaPausasPanel } from "@/components/HelenaPausasPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type PeriodKey = "today" | "7d" | "30d" | "custom";

const STATUS_META: Record<string, { label: string; color: string; cssVar: string }> = {
  marcado: {
    label: "Marcado",
    color: "oklch(0.62 0.18 305)",
    cssVar: "bg-primary/15 text-primary border-primary/30",
  },
  confirmado: {
    label: "Confirmado",
    color: "oklch(0.65 0.17 150)",
    cssVar:
      "bg-[oklch(0.65_0.17_150/0.15)] text-[oklch(0.78_0.16_150)] border-[oklch(0.65_0.17_150/0.3)]",
  },
  cancelado: {
    label: "Cancelado",
    color: "oklch(0.65 0.22 27)",
    cssVar: "bg-destructive/15 text-destructive border-destructive/30",
  },
  remarcado: {
    label: "Remarcado",
    color: "oklch(0.78 0.16 75)",
    cssVar: "bg-warning/15 text-warning border-warning/30",
  },
};

const PROF_COLORS = [
  "oklch(0.62 0.18 305)",
  "oklch(0.55 0.20 320)",
  "oklch(0.70 0.15 290)",
  "oklch(0.50 0.14 280)",
  "oklch(0.75 0.12 305)",
];

function parseBrDate(s: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/");
  if (!d || !m || !y) return null;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}
function maskCpf(c: string | null) {
  if (!c) return "—";
  const d = c.replace(/\D/g, "").padStart(11, "0").slice(-11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg px-3 py-2 text-xs">
      {label && <div className="mb-1 font-medium text-foreground">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color || p.fill }}
          />
          <span>{p.name}: </span>
          <span className="font-semibold text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  accent,
  loading,
  footer,
}: {
  title: string;
  value: React.ReactNode;
  icon: any;
  accent?: "primary" | "success" | "destructive" | "warning";
  loading?: boolean;
  footer?: React.ReactNode;
}) {
  const accentClass = {
    primary: "text-primary bg-primary/10 border-primary/20",
    success:
      "text-[oklch(0.78_0.16_150)] bg-[oklch(0.65_0.17_150/0.1)] border-[oklch(0.65_0.17_150/0.2)]",
    destructive: "text-destructive bg-destructive/10 border-destructive/20",
    warning: "text-warning bg-warning/10 border-warning/20",
  }[accent ?? "primary"];
  return (
    <div className="glass-card rounded-2xl p-5 transition-all hover:shadow-[var(--shadow-glow)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-9 w-24" />
          ) : (
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          )}
          {footer && <div className="mt-2 text-xs text-muted-foreground">{footer}</div>}
        </div>
        <div className={cn("rounded-xl border p-2.5", accentClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass-card rounded-2xl p-5", className)}>
      <div className="mb-4">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const meta = STATUS_META[status ?? ""] ?? {
    label: status ?? "—",
    color: "",
    cssVar: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        meta.cssVar,
      )}
    >
      {meta.label}
    </span>
  );
}

function SignOutButton() {
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-1.5">
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Sair</span>
    </Button>
  );
}

export default function Dashboard() {
  const now = useNow();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});
  const [usuarioAtual, setUsuarioAtual] = useState<string>("equipe");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUsuarioAtual(data.user.email);
    });
  }, []);

  const agendQ = useQuery({
    queryKey: ["agendamentos"],
    queryFn: fetchAgendamentos,
    refetchInterval: 5 * 60 * 1000,
  });
  const cliQ = useQuery({
    queryKey: ["clientes"],
    queryFn: fetchClientes,
    refetchInterval: 5 * 60 * 1000,
  });

  const { from, to } = useMemo(() => {
    const today = new Date();
    if (period === "today") return { from: startOfDay(today), to: endOfDay(today) };
    if (period === "7d") return { from: startOfDay(subDays(today, 6)), to: endOfDay(today) };
    if (period === "30d") return { from: startOfDay(subDays(today, 29)), to: endOfDay(today) };
    return {
      from: customRange.from ? startOfDay(customRange.from) : startOfDay(subDays(today, 29)),
      to: customRange.to ? endOfDay(customRange.to) : endOfDay(today),
    };
  }, [period, customRange]);

  const agendamentos = agendQ.data ?? [];
  const clientes = cliQ.data ?? [];

  const filtered = useMemo(
    () =>
      agendamentos.filter((a) => {
        // Filtrar pela data de criação do registro (quando entrou no CRM),
        // não pela data marcada da consulta — assim novos registros aparecem
        // mesmo quando a consulta é para uma data futura fora da janela.
        const d = a.criado_em ? parseISO(a.criado_em) : parseBrDate(a.data);
        if (!d) return false;
        return d >= from && d <= to;
      }),
    [agendamentos, from, to],
  );

  const totalAg = filtered.length;
  const marcados = filtered.filter((a) => a.status === "marcado").length;
  const cancelados = filtered.filter((a) => a.status === "cancelado").length;
  const confirmados = filtered.filter((a) => a.status === "confirmado").length;
  const d1 = filtered.filter((a) => a.confirmacao_d1_enviada).length;
  const cancelRate = totalAg ? (cancelados / totalAg) * 100 : 0;
  const d1Rate = totalAg ? (d1 / totalAg) * 100 : 0;

  // Charts data
  const byDay = useMemo(() => {
    const map = new Map<
      string,
      { date: string; marcado: number; confirmado: number; cancelado: number; remarcado: number }
    >();
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "dd/MM");
      map.set(key, { date: key, marcado: 0, confirmado: 0, cancelado: 0, remarcado: 0 });
    }
    filtered.forEach((a) => {
      const d = parseBrDate(a.data);
      if (!d) return;
      const key = format(d, "dd/MM");
      const e = map.get(key);
      if (!e) return;
      if (a.status && a.status in e) (e as any)[a.status]++;
    });
    return Array.from(map.values());
  }, [filtered]);

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((a) => {
      const s = a.status ?? "outros";
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return Object.entries(counts).map(([k, v]) => ({
      name: STATUS_META[k]?.label ?? k,
      value: v,
      key: k,
    }));
  }, [filtered]);

  const byProf = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((a) => {
      if (!a.prof_nome) return;
      counts[a.prof_nome] = (counts[a.prof_nome] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filtered]);

  const topServ = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((a) => {
      if (!a.servico) return;
      counts[a.servico] = (counts[a.servico] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filtered]);

  const weekly = useMemo(() => {
    const map = new Map<string, { week: string; agendamentos: number; cancelamentos: number }>();
    for (let i = 7; i >= 0; i--) {
      const d = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
      const key = format(d, "dd/MM");
      map.set(key, { week: key, agendamentos: 0, cancelamentos: 0 });
    }
    filtered.forEach((a) => {
      const d = parseBrDate(a.data);
      if (!d) return;
      const w = startOfWeek(d, { weekStartsOn: 1 });
      const key = format(w, "dd/MM");
      const e = map.get(key);
      if (!e) return;
      e.agendamentos++;
      if (a.status === "cancelado") e.cancelamentos++;
    });
    return Array.from(map.values());
  }, [filtered]);

  const loading = agendQ.isLoading || cliQ.isLoading;
  const isFetching = agendQ.isFetching || cliQ.isFetching;
  const hasError = agendQ.isError || cliQ.isError;

  if (hasError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass-card max-w-md rounded-2xl p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold">Não foi possível carregar os dados</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Verifique a conexão com o backend e tente novamente.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              agendQ.refetch();
              cliQ.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="Dherma Prime" className="h-9 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-xs text-muted-foreground">
                {now
                  ? format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : "Sincronizando"}
              </div>
              <div className="text-sm font-semibold tabular-nums">
                {now ? format(now, "HH:mm:ss") : "--:--:--"}{" "}
                <span className="text-xs font-normal text-muted-foreground">BRT</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-[oklch(0.65_0.17_150)]" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[oklch(0.65_0.17_150)]" />
              </span>
              <span className="text-xs font-medium">Helena Bot Ativa</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
        {/* Period filter */}
        <div className="glass-card flex flex-wrap items-center gap-2 rounded-2xl p-3">
          {(
            [
              { k: "today", l: "Hoje" },
              { k: "7d", l: "7 dias" },
              { k: "30d", l: "30 dias" },
            ] as { k: PeriodKey; l: string }[]
          ).map((o) => (
            <button
              key={o.k}
              onClick={() => setPeriod(o.k)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium transition-all",
                period === o.k
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {o.l}
            </button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <button
                onClick={() => setPeriod("custom")}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
                  period === "custom"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {customRange.from && customRange.to
                  ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}`
                  : "Personalizado"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={customRange as any}
                onSelect={(r: any) => {
                  setCustomRange(r ?? {});
                  if (r?.from && r?.to) setPeriod("custom");
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin text-primary")} />
            <span>Auto-atualização a cada 5 min</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total de Agendamentos"
            value={totalAg.toLocaleString("pt-BR")}
            icon={CalendarIcon}
            accent="primary"
            loading={loading}
            footer={`${confirmados} confirmados`}
          />
          <KpiCard
            title="Marcados"
            value={marcados.toLocaleString("pt-BR")}
            icon={CheckCircle2}
            accent="primary"
            loading={loading}
          />
          <KpiCard
            title="Cancelados"
            value={cancelados.toLocaleString("pt-BR")}
            icon={XCircle}
            accent="destructive"
            loading={loading}
            footer={`${cancelRate.toFixed(1)}% de taxa`}
          />
          <KpiCard
            title="Clientes cadastrados"
            value={clientes.length.toLocaleString("pt-BR")}
            icon={Users}
            accent="success"
            loading={loading}
          />
        </div>

        {/* Row 1 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            title="Agendamentos por dia"
            subtitle="Últimos 30 dias por status"
            className="lg:col-span-2"
          >
            <div className="h-72">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer>
                  <BarChart data={byDay}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.27 0 0)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="oklch(0.65 0 0)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="oklch(0.65 0 0)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "oklch(0.22 0 0 / 0.5)" }}
                    />
                    <Bar
                      dataKey="marcado"
                      stackId="a"
                      fill={STATUS_META.marcado.color}
                      name="Marcado"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="confirmado"
                      stackId="a"
                      fill={STATUS_META.confirmado.color}
                      name="Confirmado"
                    />
                    <Bar
                      dataKey="remarcado"
                      stackId="a"
                      fill={STATUS_META.remarcado.color}
                      name="Remarcado"
                    />
                    <Bar
                      dataKey="cancelado"
                      stackId="a"
                      fill={STATUS_META.cancelado.color}
                      name="Cancelado"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Distribuição por status" subtitle="No período selecionado">
            <div className="h-72">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : byStatus.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byStatus}
                      dataKey="value"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {byStatus.map((e, i) => (
                        <Cell
                          key={i}
                          fill={STATUS_META[e.key]?.color ?? PROF_COLORS[i % PROF_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, color: "oklch(0.65 0 0)" }}
                      formatter={(v: string, _e: any, i: number) => {
                        const total = byStatus.reduce((s, x) => s + x.value, 0);
                        const pct = total ? ((byStatus[i].value / total) * 100).toFixed(0) : 0;
                        return (
                          <span className="text-muted-foreground">
                            {v} <span className="text-foreground">{pct}%</span>
                          </span>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard title="Profissionais que mais atenderam" subtitle="Top 6">
            <div className="h-72">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : byProf.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer>
                  <BarChart data={byProf} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.27 0 0)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke="oklch(0.65 0 0)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="oklch(0.65 0 0)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={120}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "oklch(0.22 0 0 / 0.5)" }}
                    />
                    <Bar dataKey="value" name="Atendimentos" radius={[0, 6, 6, 0]}>
                      {byProf.map((_, i) => (
                        <Cell key={i} fill={PROF_COLORS[i % PROF_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Top 5 serviços mais agendados">
            <div className="h-72">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : topServ.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer>
                  <BarChart data={topServ}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.27 0 0)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="oklch(0.65 0 0)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      stroke="oklch(0.65 0 0)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "oklch(0.22 0 0 / 0.5)" }}
                    />
                    <Bar
                      dataKey="value"
                      name="Agendamentos"
                      fill="oklch(0.62 0.18 305)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard
            title="Evolução semanal"
            subtitle="Agendamentos vs cancelamentos"
            className="lg:col-span-2"
          >
            <div className="h-72">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer>
                  <LineChart data={weekly}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.27 0 0)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="week"
                      stroke="oklch(0.65 0 0)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="oklch(0.65 0 0)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "oklch(0.65 0 0)" }} />
                    <Line
                      type="monotone"
                      dataKey="agendamentos"
                      stroke="oklch(0.62 0.18 305)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Agendamentos"
                    />
                    <Line
                      type="monotone"
                      dataKey="cancelamentos"
                      stroke="oklch(0.65 0.22 27)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Cancelamentos"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>

          <div className="flex flex-col gap-4">
            <KpiCard
              title="Taxa de cancelamento"
              value={`${cancelRate.toFixed(1)}%`}
              icon={XCircle}
              accent="destructive"
              loading={loading}
              footer={`${cancelados} de ${totalAg}`}
            />
            <KpiCard
              title="Confirmação D-1"
              value={`${d1Rate.toFixed(1)}%`}
              icon={CheckCircle2}
              accent="success"
              loading={loading}
              footer={`${d1} mensagens enviadas`}
            />
          </div>
        </div>

        {/* Tables */}
        <Tabs defaultValue="agendamentos" className="space-y-4">
          <TabsList className="bg-card">
            <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="atendimento">Atendimento</TabsTrigger>
            <TabsTrigger value="pausas">Pausas Helena</TabsTrigger>
          </TabsList>
          <TabsContent value="agendamentos">
            <AppointmentsTable data={filtered} loading={loading} />
          </TabsContent>
          <TabsContent value="clientes">
            <ClientsTable data={clientes} loading={loading} />
          </TabsContent>
          <TabsContent value="atendimento">
            <AtendimentoPanel usuarioAtual={usuarioAtual} />
          </TabsContent>
          <TabsContent value="pausas">
            <HelenaPausasPanel usuarioAtual={usuarioAtual} />
          </TabsContent>
        </Tabs>

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          Dherma Prime · Estética, Saúde e Bem Estar
        </footer>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
      <div className="rounded-full border border-border bg-muted/30 p-4">
        <CalendarIcon className="h-6 w-6" />
      </div>
      <p className="mt-3 text-sm">Sem dados no período selecionado</p>
    </div>
  );
}

function AppointmentsTable({ data, loading }: { data: Agendamento[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [prof, setProf] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const profs = useMemo(
    () => Array.from(new Set(data.map((d) => d.prof_nome).filter(Boolean))) as string[],
    [data],
  );

  const filtered = useMemo(() => {
    return data
      .filter((a) => !search || a.patient_name?.toLowerCase().includes(search.toLowerCase()))
      .filter((a) => prof === "all" || a.prof_nome === prof)
      .filter((a) => status === "all" || a.status === status)
      .sort((a, b) => {
        const da = parseBrDate(a.data)?.getTime() ?? 0;
        const db = parseBrDate(b.data)?.getTime() ?? 0;
        return db - da;
      });
  }, [data, search, prof, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  useEffect(() => {
    setPage(1);
  }, [search, prof, status]);

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do paciente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background border-border"
          />
        </div>
        <Select value={prof} onValueChange={setProf}>
          <SelectTrigger className="w-[200px] bg-background border-border">
            <SelectValue placeholder="Profissional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos profissionais</SelectItem>
            {profs.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px] bg-background border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.keys(STATUS_META).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Data", "Horário", "Cliente", "Serviço", "Profissional", "Status", "Criado em"].map(
                (h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum agendamento encontrado
                </td>
              </tr>
            ) : (
              paged.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap font-medium">{a.data ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{a.horario ?? "—"}</td>
                  <td className="px-4 py-3">{a.patient_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.servico ?? "—"}</td>
                  <td className="px-4 py-3">{a.prof_nome ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {format(parseISO(a.criado_em), "dd/MM/yy HH:mm")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} resultados</span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="tabular-nums">
            Página {page} de {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClientsTable({ data, loading }: { data: Cliente[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const filtered = useMemo(
    () =>
      data.filter((c) => !search || c.patient_name?.toLowerCase().includes(search.toLowerCase())),
    [data, search],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-background border-border"
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Nome", "CPF", "Telefone", "Cadastrado em"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum cliente encontrado
                </td>
              </tr>
            ) : (
              paged.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.patient_name ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{maskCpf(c.cpf)}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatPhone(c.sender)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {format(parseISO(c.criado_em), "dd/MM/yy HH:mm")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} clientes</span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="tabular-nums">
            Página {page} de {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}

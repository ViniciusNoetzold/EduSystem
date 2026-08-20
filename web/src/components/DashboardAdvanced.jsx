import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../services/api";
import "./dashboard-advanced.css";

const cn = (...values) => values.filter(Boolean).join(" ");
function Card({ children, className = "" }) {
  return (
    <section className={cn("glass-panel", "card", className)}>
      {children}
    </section>
  );
}
function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button {...props} className={cn("btn", `btn-${variant}`, className)}>
      {children}
    </button>
  );
}
function Heading({ children, title, sub }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">VISÃO ANALÍTICA</p>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function GlassChartTooltip({ active, label, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((item) => (
        <div className="chart-tooltip-row" key={item.dataKey || item.name}>
          <span>{item.name}</span>
          <strong>{Number(item.value).toLocaleString("pt-BR")}</strong>
        </div>
      ))}
    </div>
  );
}

function GlassChartLegend({ payload }) {
  if (!payload?.length) return null;
  return (
    <div className="chart-legend" aria-label="Legenda do gráfico">
      <span
        className="chart-legend-dot"
        style={{ background: payload[0].color, color: payload[0].color }}
      />
      <span>{payload[0].value}</span>
    </div>
  );
}

export default function DashboardAdvanced({ notify }) {
  const [scope, setScope] = useState("geral");
  const [selected, setSelected] = useState("");
  const [metric, setMetric] = useState("frequencia");
  const [period, setPeriod] = useState("bimestre");
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  async function load(
    nextScope = scope,
    nextSelected = selected,
    nextPeriod = period,
    nextYear = year,
  ) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        scope: nextScope,
        periodo: nextPeriod,
        ano: String(nextYear),
      });
      if (nextSelected) params.set("id", nextSelected);
      if (nextScope === "materia" && nextSelected) {
        const subject = data?.filters?.materias?.find(
          (item) => String(item.id) === String(nextSelected),
        );
        if (subject) {
          params.delete("id");
          params.set("nome", subject.nome);
        }
      }
      setData(await api.dashboard(params.toString()));
    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load("geral", "");
  }, []);
  function changeScope(value) {
    setScope(value);
    setSelected("");
    load(value, "");
  }
  function changeSelected(value) {
    setSelected(value);
    load(scope, value);
  }
  const options = useMemo(() => {
    if (!data) return [];
    return scope === "aluno"
      ? data.filters.alunos
      : scope === "turma"
        ? data.filters.turmas
        : scope === "escola"
          ? data.filters.escolas
          : scope === "universidade"
            ? data.filters.universidades
            : scope === "curso"
              ? data.filters.cursos
              : scope === "materia"
                ? data.filters.materias
                : [];
  }, [data, scope]);
  const m = data?.metrics || {};
  const groups = data?.groups || [];
  const evolution = data?.evolution || [];
  const chartLabel =
    metric === "frequencia"
      ? "Frequência (%)"
      : metric === "media"
        ? "Média geral"
        : "Alunos";
  const chartData = groups.map((item) => ({
    ...item,
    valor:
      metric === "frequencia"
        ? Number(item.frequencia || 0)
        : metric === "media"
          ? Number(item.media || 0)
          : Number(item.alunos || 0),
  }));
  const scopeLabel = {
    geral: "Visão geral",
    aluno: "Aluno",
    turma: "Turma",
    escola: "Escola",
    universidade: "Universidade",
    curso: "Curso",
    materia: "Matéria",
  }[scope];
  const periodLabel = {
    bimestre: "bimestre",
    semestre: "semestre",
    mes: "mês de lançamento",
    ano: "ano",
    anos: "anos",
  }[period];
  return (
    <>
      <Heading
        title="Painel de gestão"
        sub="Escolha aluno, turma, curso ou instituição e altere o período para analisar dados reais do SQLite."
      >
        <div className="dashboard-heading-actions">
          <Button variant="ghost" onClick={() => load()}>
            <LayoutDashboard size={15} />{" "}
            {loading ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>
      </Heading>
      <Card className="dashboard-filters">
        <div className="filter-title">
          <div>
            <strong>Explorar informações</strong>
            <span>
              Use os filtros para mudar o contexto e o período dos gráficos.
            </span>
          </div>
          <span className="filter-badge">{scopeLabel}</span>
        </div>
        <div className="dashboard-filter-grid extended">
          <label>
            Visualizar por
            <select
              value={scope}
              onChange={(event) => changeScope(event.target.value)}
            >
              <option value="geral">Visão geral</option>
              <option value="aluno">Aluno</option>
              <option value="turma">Turmas</option>
              <option value="escola">Escolas</option>
              <option value="universidade">Universidades</option>
              <option value="curso">Cursos</option>
              <option value="materia">Matérias</option>
            </select>
          </label>
          {scope !== "geral" && (
            <label>
              {scope === "materia"
                ? "Matéria"
                : "Selecionar " + scopeLabel.toLowerCase()}
              <select
                value={selected}
                onChange={(event) => changeSelected(event.target.value)}
              >
                <option value="">Todos</option>
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Período do gráfico
            <select
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value);
                load(scope, selected, event.target.value, year);
              }}
            >
              <option value="mes">Mês de lançamento</option>
              <option value="bimestre">Bimestre</option>
              <option value="semestre">Semestre</option>
              <option value="ano">Ano selecionado</option>
              <option value="anos">Comparar anos</option>
            </select>
          </label>
          {period !== "anos" && (
            <label>
              Ano
              <select
                value={year}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setYear(value);
                  load(scope, selected, period, value);
                }}
              >
                {[
                  ...new Set([
                    year,
                    new Date().getFullYear(),
                    ...(data?.filters?.anos || []),
                  ]),
                ]
                  .sort((a, b) => b - a)
                  .map((item) => (
                    <option key={item}>{item}</option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Indicador dos grupos
            <select
              value={metric}
              onChange={(event) => setMetric(event.target.value)}
            >
              <option value="frequencia">Frequência média</option>
              <option value="media">Média de notas</option>
              <option value="alunos">Quantidade de alunos</option>
            </select>
          </label>
        </div>
      </Card>
      <div className="metric-grid">
        <Metric
          label="Total de alunos"
          value={m.total_alunos ?? "—"}
          note={scope === "geral" ? "cadastros ativos" : scopeLabel}
          icon={Users}
          tone="blue"
        />
        <Metric
          label="Média geral"
          value={
            m.media_geral !== undefined ? Number(m.media_geral).toFixed(1) : "—"
          }
          note={`notas de ${period === "anos" ? "todos os anos" : year}`}
          icon={BarChart3}
          tone="teal"
        />
        <Metric
          label="Frequência média"
          value={
            m.frequencia_media !== undefined ? `${m.frequencia_media}%` : "—"
          }
          note="presença registrada"
          icon={CalendarCheck}
          tone="violet"
        />
        <Metric
          label="Maior frequência"
          value={
            m.maior_frequencia?.valor !== undefined
              ? `${m.maior_frequencia.valor}%`
              : "—"
          }
          note={m.maior_frequencia?.nome || "sem dados"}
          icon={GraduationCap}
          tone="amber"
        />
      </div>
      <div className="dashboard-chart-grid">
        <Card className="chart-card wide">
          <div className="card-heading">
            <div>
              <h3>Evolução acadêmica</h3>
              <p className="muted">
                Média das notas por {periodLabel} no contexto selecionado
              </p>
            </div>
          </div>
          <div className="chart-wrap">
            {evolution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolution}>
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#708096"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 10]}
                    stroke="#708096"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<GlassChartTooltip />}
                    cursor={{ stroke: "rgba(255,255,255,.14)" }}
                  />
                  <Legend content={<GlassChartLegend />} />
                  <Line
                    type="monotone"
                    dataKey="media"
                    name="Média"
                    stroke="#2dd4bf"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#2dd4bf" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={BookOpen}
                text="Não há notas suficientes para esta visão."
              />
            )}
          </div>
        </Card>
        <Card className="chart-card">
          <div className="card-heading">
            <div>
              <h3>
                {scope === "aluno"
                  ? "Comparativo por matéria"
                  : "Comparativo por turma"}
              </h3>
              <p className="muted">{chartLabel}</p>
            </div>
          </div>
          <div className="chart-wrap">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#708096"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={
                      metric === "media"
                        ? [0, 10]
                        : metric === "frequencia"
                          ? [0, 100]
                          : [0, "auto"]
                    }
                    stroke="#708096"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<GlassChartTooltip />}
                    cursor={{ fill: "rgba(255,255,255,.045)" }}
                  />
                  <Legend content={<GlassChartLegend />} />
                  <Bar
                    dataKey="valor"
                    name={chartLabel}
                    fill="#5b7cff"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={Building2}
                text="Não há grupos cadastrados para comparar."
              />
            )}
          </div>
        </Card>
      </div>
      <div className="dashboard-lower-grid">
        <Card>
          <div className="card-heading">
            <div>
              <h3>Detalhamento dos grupos</h3>
              <p className="muted">Valores usados no gráfico comparativo</p>
            </div>
          </div>
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Alunos</th>
                  <th>Média</th>
                  <th>Frequência</th>
                </tr>
              </thead>
              <tbody>
                {groups.length ? (
                  groups.map((row) => (
                    <tr key={row.name}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td>{row.alunos}</td>
                      <td>{Number(row.media || 0).toFixed(1)}</td>
                      <td>{Number(row.frequencia || 0).toFixed(0)}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="empty-row">
                      Nenhum dado acadêmico disponível.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        {data?.catalog?.length ? (
          <Card>
            <div className="card-heading">
              <div>
                <h3>Catálogo relacionado</h3>
                <p className="muted">Cursos vinculados à seleção</p>
              </div>
            </div>
            <div className="catalog-list">
              {data.catalog.map((row) => (
                <div className="catalog-item" key={row.codigo || row.nome}>
                  <div className="catalog-icon">
                    <GraduationCap size={17} />
                  </div>
                  <div>
                    <strong>{row.nome}</strong>
                    <small>
                      {row.codigo || "Sem código"} ·{" "}
                      {row.duracao || "Duração não informada"}
                    </small>
                  </div>
                  <span>{row.modalidade || "-"}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="dashboard-guide">
            <h3>Como usar o painel</h3>
            <p>
              Selecione um aluno para acompanhar a evolução individual, uma
              turma para comparar o grupo, ou uma instituição/curso para
              analisar o contexto. Troque o período entre mês, bimestre,
              semestre, ano e vários anos.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
function Metric({ label, value, note, icon: Icon, tone }) {
  return (
    <Card className="metric">
      <div className={`metric-icon tone-${tone}`}>
        <Icon size={18} />
      </div>
      <p className="muted">{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </Card>
  );
}
function EmptyState({ icon: Icon, text }) {
  return (
    <div className="dashboard-empty">
      <Icon size={22} />
      <span>{text}</span>
    </div>
  );
}

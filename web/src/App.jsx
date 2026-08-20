import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Eraser,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LineChart as LineIcon,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Redo2,
  Search,
  Settings,
  Shapes,
  ShieldCheck,
  School,
  Trash2,
  Undo2,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Konva from "konva";
import {
  Stage,
  Layer,
  Line as KLine,
  Rect,
  Circle as KCircle,
  Arrow,
  Text,
} from "react-konva";
import { api } from "./services/api";
import AdvancedWhiteboard from "./components/Whiteboard";
import { CatalogPage, EntityRegistry } from "./components/Registries";
import DashboardAdvanced from "./components/DashboardAdvanced";
import InstitutionSettings from "./components/InstitutionSettings";
import AttendanceAdvanced from "./components/AttendanceAdvanced";
import StudentsAdvanced from "./components/StudentsAdvanced";
import GradesAdvanced from "./components/GradesAdvanced";
import ReportsAdvanced from "./components/ReportsAdvanced";
import TeamManagement from "./components/TeamManagement";
import GlassBackground from "./components/ui/GlassBackground";
import { GlassCard, GlassDialogContent } from "./components/ui/GlassSurfaces";

const BRAND_LOGO = "./edusystem-logo.png";
const cn = (...v) => v.filter(Boolean).join(" ");
function Button({ children, variant = "primary", className = "", ...p }) {
  return (
    <button {...p} className={cn("btn", `btn-${variant}`, className)}>
      {children}
    </button>
  );
}
function Card({ children, className = "" }) {
  return <GlassCard className={className}>{children}</GlassCard>;
}
function Badge({ children, tone = "teal" }) {
  return <span className={cn("badge", `badge-${tone}`)}>{children}</span>;
}
function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="toast">
      {message}
      <button onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}
function Login({ onLogin }) {
  const [first, setFirst] = useState(!localStorage.getItem("gestao_user"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Diretor");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const r = first
        ? await api.register({ name, email, password, role })
        : await api.login(email, password);
      const user = { ...r.user, token: r.token };
      (remember ? localStorage : sessionStorage).setItem(
        "gestao_user",
        JSON.stringify(user),
      );
      onLogin(user);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <main className="login-shell">
      <GlassBackground />
      <div className="login-card">
        <div className="brand-mark">
          <img src={BRAND_LOGO} alt="EduSystem" />
        </div>
        <p className="eyebrow">EDUSYSTEM</p>
        <h1>{first ? "Primeiro acesso" : "Bem-vinda de volta"}</h1>
        <p className="muted">
          Dados reais, fluxos simples e uma escola mais organizada.
        </p>
        <form onSubmit={submit}>
          {first && (
            <>
              <label>
                Nome completo
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Perfil
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  {[
                    "Diretor",
                    "Coordenador",
                    "Professor",
                    "Secretário",
                    "Pais",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            E-mail
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="diretora@escola.com"
            />
          </label>
          <label>
            Senha
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="123456"
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />{" "}
            Lembrar de mim neste dispositivo
          </label>
          {error && <p className="form-error">{error}</p>}
          <Button className="full">
            {first ? "Criar acesso" : "Entrar"} <ChevronRight size={16} />
          </Button>
        </form>
        <button className="text-button" onClick={() => setFirst(!first)}>
          {first ? "Já tenho uma conta" : "Primeiro acesso"}
        </button>
      </div>
    </main>
  );
}
const nav = [
  [
    "Dashboard",
    "/",
    LayoutDashboard,
    "diretor coordenador professor secretario pais",
  ],
  ["Alunos", "/alunos", Users, "diretor coordenador professor secretario pais"],
  ["Turmas", "/turmas", School, "diretor coordenador professor secretario"],
  [
    "Matérias",
    "/materias",
    BookOpen,
    "diretor coordenador professor secretario",
  ],
  ["Cursos", "/cursos", GraduationCap, "diretor coordenador secretario"],
  ["Notas", "/notas", BarChart3, "diretor coordenador professor"],
  [
    "Frequência",
    "/frequencia",
    CalendarCheck,
    "diretor coordenador professor secretario",
  ],
  ["Quadro Branco", "/quadro", Pencil, "diretor coordenador professor"],
  [
    "Relatórios",
    "/relatorios",
    FileText,
    "diretor coordenador professor secretario pais",
  ],
  ["Escolas", "/escolas", Building2, "diretor coordenador secretario"],
  [
    "Universidades",
    "/universidades",
    GraduationCap,
    "diretor coordenador secretario",
  ],
  ["Equipe e acessos", "/equipe", ShieldCheck, "diretor coordenador"],
];
function App() {
  const [user, setUser] = useState(() =>
    JSON.parse(
      localStorage.getItem("gestao_user") ||
        sessionStorage.getItem("gestao_user") ||
        "null",
    ),
  );
  const [config, setConfig] = useState(() =>
    JSON.parse(
      localStorage.getItem("edusystem_config") ||
        '{"tipo":"escola","nome":"Grupo Horizonte","descricao":"Gestão escolar","modulos":{}}',
    ),
  );
  useEffect(() => {
    if (!user) return;
    api
      .configuracoes()
      .then((value) => {
        setConfig(value);
        localStorage.setItem("edusystem_config", JSON.stringify(value));
      })
      .catch(() => {});
  }, [user?.id]);
  if (!user) return <Login onLogin={setUser} />;
  return (
    <Shell
      user={user}
      setUser={setUser}
      config={config}
      setConfig={setConfig}
    />
  );
}
function Shell({ user, setUser, config, setConfig }) {
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState("");
  const role = user.role.toLowerCase().replace("secretário", "secretario");
  const institutionModules = {
    escola: [
      "Dashboard",
      "Alunos",
      "Turmas",
      "Matérias",
      "Notas",
      "Frequência",
      "Quadro Branco",
      "Relatórios",
      "Escolas",
      "Equipe e acessos",
    ],
    ensino_medio: [
      "Dashboard",
      "Alunos",
      "Turmas",
      "Matérias",
      "Notas",
      "Frequência",
      "Relatórios",
      "Escolas",
      "Equipe e acessos",
    ],
    creche: [
      "Dashboard",
      "Alunos",
      "Turmas",
      "Frequência",
      "Relatórios",
      "Equipe e acessos",
    ],
    cursinho: [
      "Dashboard",
      "Alunos",
      "Turmas",
      "Matérias",
      "Notas",
      "Frequência",
      "Relatórios",
      "Cursos",
      "Equipe e acessos",
    ],
    faculdade: [
      "Dashboard",
      "Alunos",
      "Turmas",
      "Matérias",
      "Notas",
      "Frequência",
      "Quadro Branco",
      "Relatórios",
      "Cursos",
      "Universidades",
      "Equipe e acessos",
    ],
    universidade: [
      "Dashboard",
      "Alunos",
      "Turmas",
      "Matérias",
      "Notas",
      "Frequência",
      "Quadro Branco",
      "Relatórios",
      "Cursos",
      "Universidades",
      "Escolas",
      "Equipe e acessos",
    ],
  };
  const moduleKeys = {
    Dashboard: "dashboard",
    Alunos: "alunos",
    Turmas: "turmas",
    Matérias: "materias",
    Notas: "notas",
    Frequência: "frequencia",
    "Quadro Branco": "quadro",
    Relatórios: "relatorios",
    Escolas: "escolas",
    Universidades: "universidades",
    Cursos: "cursos",
    "Equipe e acessos": "equipe",
  };
  const allowed = (x) => x.split(" ").includes(role);
  const visible = (item) =>
    allowed(item[3]) &&
    (config?.modulos?.[moduleKeys[item[0]]] ??
      (
        institutionModules[config?.tipo || "escola"] ||
        institutionModules.escola
      ).includes(item[0]));
  const notify = (m) => setToast(m);
  function logout() {
    localStorage.removeItem("gestao_user");
    sessionStorage.removeItem("gestao_user");
    setUser(null);
  }
  return (
    <div className={cn("app-shell", collapsed && "sidebar-collapsed")}>
      <GlassBackground />
      <aside className="sidebar">
        <div className="side-top">
          <div className="brand-mark small">
            <img src={BRAND_LOGO} alt="" aria-hidden="true" />
          </div>
          {!collapsed && (
            <span className="brand-name">
              edu<span>system</span>
            </span>
          )}
          <button className="collapse" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-icon">GB</div>
          {!collapsed && (
            <div>
              <strong>{config?.nome || "Grupo Horizonte"}</strong>
              <small>{config?.descricao || "Unidade Centro"}</small>
            </div>
          )}
        </div>
        <nav>
          {nav.filter(visible).map(([label, to, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => cn("nav-item", isActive && "active")}
            >
              <Icon size={18} />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>
        <div className="side-bottom">
          <NavLink to="/configuracoes" className="nav-item">
            <Settings size={18} />
            {!collapsed && "Configurações"}
          </NavLink>
          <button className="nav-item" onClick={logout}>
            <LogOut size={18} />
            {!collapsed && "Sair"}
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              GESTÃO EDUCACIONAL · DADOS LOCAIS PROTEGIDOS
            </p>
            <h2>
              Olá, {user.name.split(" ")[0]} <span className="wave">✦</span>
            </h2>
          </div>
          <div className="top-actions">
            <div className="avatar">
              {user.name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="user-meta">
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard notify={notify} />} />
            <Route
              path="/alunos"
              element={<StudentsAdvanced user={user} notify={notify} />}
            />
            <Route path="/notas" element={<GradesAdvanced notify={notify} />} />
            <Route
              path="/frequencia"
              element={<Attendance notify={notify} />}
            />
            <Route
              path="/quadro"
              element={<Whiteboard user={user} notify={notify} />}
            />
            <Route
              path="/relatorios"
              element={<ReportsAdvanced user={user} notify={notify} />}
            />
            <Route
              path="/escolas"
              element={<Entities type="escola" notify={notify} />}
            />
            <Route
              path="/universidades"
              element={<Entities type="universidade" notify={notify} />}
            />
            <Route
              path="/turmas"
              element={<Catalog kind="turma" notify={notify} />}
            />
            <Route
              path="/materias"
              element={<Catalog kind="materia" notify={notify} />}
            />
            <Route
              path="/cursos"
              element={<Catalog kind="curso" notify={notify} />}
            />
            <Route
              path="/equipe"
              element={<TeamManagement notify={notify} />}
            />
            <Route
              path="/configuracoes"
              element={
                <InstitutionSettings config={config} setConfig={setConfig} />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
function LegacyDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api
      .dashboard()
      .then(setData)
      .catch(() => {});
  }, []);
  const m = data || {};
  const metrics = [
    [
      "Total de alunos",
      m.total_alunos ?? "—",
      "cadastros ativos",
      Users,
      "blue",
    ],
    ["Média geral", m.media_geral ?? "—", "notas do ano", BarChart3, "teal"],
    [
      "Frequência média",
      m.frequencia_media ? `${m.frequencia_media}%` : "—",
      "presença registrada",
      CalendarCheck,
      "violet",
    ],
    [
      "Maior frequência",
      m.maior_frequencia?.valor ? `${m.maior_frequencia.valor}%` : "—",
      m.maior_frequencia?.nome || "aluno destaque",
      GraduationCap,
      "amber",
    ],
  ];
  return (
    <>
      <Heading
        eyebrow="VISÃO GERAL"
        title="Seu painel de hoje"
        sub="Indicadores calculados diretamente do SQLite."
      />
      <div className="metric-grid">
        {metrics.map(([l, v, n, I, t]) => (
          <Metric key={l} label={l} value={v} note={n} icon={I} tone={t} />
        ))}
      </div>
      <div className="dashboard-grid">
        <Card className="chart-card wide">
          <div className="card-heading">
            <div>
              <h3>Evolução acadêmica</h3>
              <p className="muted">Média geral por bimestre</p>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={[1, 2, 3, 4].map((b) => ({
                  name: `${b}º bim`,
                  nota: 7 + b * 0.45,
                }))}
              >
                <CartesianGrid stroke="#25303c" vertical={false} />
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
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="nota"
                  stroke="#2dd4bf"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="chart-card">
          <div className="card-heading">
            <div>
              <h3>Frequência por turma</h3>
              <p className="muted">Presença registrada</p>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "9º A", valor: 94 },
                  { name: "8º B", valor: 91 },
                  { name: "7º C", valor: 96 },
                ]}
              >
                <CartesianGrid stroke="#25303c" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#708096"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#708096"
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="valor" fill="#5b7cff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  );
}
function Heading({ eyebrow, title, sub, children }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
      </div>
      {children}
    </div>
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
function Toolbar({ search, setSearch, filter, setFilter, options }) {
  return (
    <div className="table-toolbar">
      <div className="search-box">
        <Search size={16} />
        <input
          placeholder="Buscar..."
          value={search || ""}
          onChange={(e) => setSearch?.(e.target.value)}
        />
      </div>
      {options && (
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )}
      <Button variant="ghost">
        <Download size={15} /> Exportar
      </Button>
    </div>
  );
}
function Students({ notify }) {
  const [rows, setRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("Todas");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    matricula: "",
    turma_id: "",
    responsavel: "",
    contato_responsavel: "",
  });
  async function load() {
    try {
      const [a, t] = await Promise.all([api.alunos(), api.turmas()]);
      setRows(a);
      setClasses(t);
    } catch (e) {
      notify(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const shown = rows.filter(
    (r) =>
      (r.nome || "").toLowerCase().includes(q.toLowerCase()) &&
      (filter === "Todas" || r.turma === filter),
  );
  async function save(e) {
    e.preventDefault();
    if (!form.nome || !form.matricula || !form.turma_id)
      return notify("Preencha nome, matrícula e turma");
    try {
      await api.createAluno(form);
      setModal(false);
      setForm({
        nome: "",
        matricula: "",
        turma_id: "",
        responsavel: "",
        contato_responsavel: "",
      });
      await load();
      notify("Aluno cadastrado com sucesso");
    } catch (e) {
      notify(e.message);
    }
  }
  async function remove(id) {
    try {
      await api.deleteAluno(id);
      setRows(rows.filter((r) => r.id !== id));
      notify("Aluno inativado com sucesso");
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="CADASTRO"
        title="Alunos"
        sub="Cadastre, acompanhe e inative estudantes sem apagar o histórico."
      >
        <Button onClick={() => setModal(true)}>
          <Plus size={16} /> Novo aluno
        </Button>
      </Heading>
      <Card>
        <Toolbar
          search={q}
          setSearch={setQ}
          filter={filter}
          setFilter={setFilter}
          options={["Todas", ...classes.map((x) => x.nome)]}
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Turma</th>
                <th>Média</th>
                <th>Frequência acumulada</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="person">
                      <div className="avatar soft">
                        {r.nome.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <strong>{r.nome}</strong>
                        <small>{r.matricula}</small>
                      </div>
                    </div>
                  </td>
                  <td>{r.turma}</td>
                  <td>{Number(r.media || 0).toFixed(1)}</td>
                  <td>{r.frequencia || 0}%</td>
                  <td>
                    <Badge tone="teal">{r.status}</Badge>
                  </td>
                  <td>
                    <button className="icon-btn" onClick={() => remove(r.id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {modal && (
        <Modal title="Novo aluno" onClose={() => setModal(false)}>
          <form className="modal-form" onSubmit={save}>
            <label>
              Nome completo
              <input
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </label>
            <label>
              Matrícula
              <input
                required
                value={form.matricula}
                onChange={(e) =>
                  setForm({ ...form, matricula: e.target.value })
                }
              />
            </label>
            <label>
              Turma
              <select
                required
                value={form.turma_id}
                onChange={(e) => setForm({ ...form, turma_id: e.target.value })}
              >
                <option value="">Selecione</option>
                {classes.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.nome}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Responsável
              <input
                value={form.responsavel}
                onChange={(e) =>
                  setForm({ ...form, responsavel: e.target.value })
                }
              />
            </label>
            <label>
              Contato
              <input
                value={form.contato_responsavel}
                onChange={(e) =>
                  setForm({ ...form, contato_responsavel: e.target.value })
                }
              />
            </label>
            <Button className="full">Salvar aluno</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Grades({ notify }) {
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({
    aluno_id: "",
    disciplina: "",
    bimestre: 1,
    ano: 2026,
    nota: "",
  });
  async function load() {
    try {
      const [n, a, m] = await Promise.all([
        api.notas(),
        api.alunos(),
        api.materias(),
      ]);
      setRows(n);
      setStudents(a);
      setSubjects(m);
      setForm((previous) => ({
        ...previous,
        aluno_id: previous.aluno_id || String(a[0]?.id || ""),
        disciplina: previous.disciplina || m[0]?.nome || "",
      }));
    } catch (e) {
      notify(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function save(e) {
    e.preventDefault();
    if (!form.aluno_id || !form.disciplina || form.nota === "")
      return notify("Aluno, matéria e nota são obrigatórios");
    if (Number(form.nota) < 0 || Number(form.nota) > 10)
      return notify("A nota deve estar entre 0 e 10");
    try {
      await api.saveNota({
        ...form,
        nota: Number(form.nota),
        bimestre: Number(form.bimestre),
        aluno_id: Number(form.aluno_id),
      });
      await load();
      notify("Nota salva no SQLite");
    } catch (e) {
      notify(e.message);
    }
  }
  async function remove(id) {
    await api.deleteNota(id);
    setRows(rows.filter((x) => x.id !== id));
    notify("Nota excluída");
  }
  return (
    <>
      <Heading
        eyebrow="ACADÊMICO"
        title="Notas"
        sub="Selecione o aluno, a matéria cadastrada, o bimestre e informe apenas a nota."
      >
        <Button
          onClick={() =>
            document
              .getElementById("nota-form")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <Plus size={16} /> Nova nota
        </Button>
      </Heading>
      <Card>
        <form id="nota-form" className="inline-form" onSubmit={save}>
          <select
            required
            value={form.aluno_id}
            onChange={(e) => setForm({ ...form, aluno_id: e.target.value })}
          >
            <option value="">Aluno</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
          <select
            required
            disabled={!subjects.length}
            value={form.disciplina}
            onChange={(e) => setForm({ ...form, disciplina: e.target.value })}
          >
            <option value="">
              {subjects.length
                ? "Matéria cadastrada"
                : "Cadastre uma matéria primeiro"}
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.nome}>
                {s.nome}
              </option>
            ))}
          </select>
          <select
            value={form.bimestre}
            onChange={(e) => setForm({ ...form, bimestre: e.target.value })}
          >
            {[1, 2, 3, 4].map((x) => (
              <option key={x} value={x}>
                {x}º bimestre
              </option>
            ))}
          </select>
          <input
            required
            type="number"
            min="0"
            max="10"
            step="0.1"
            placeholder="Nota"
            value={form.nota}
            onChange={(e) => setForm({ ...form, nota: e.target.value })}
          />
          <Button>Salvar</Button>
        </form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Turma</th>
                <th>Matéria</th>
                <th>Bimestre</th>
                <th>Ano</th>
                <th>Nota</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.aluno}</td>
                  <td>{r.turma}</td>
                  <td>{r.disciplina}</td>
                  <td>{r.bimestre}º</td>
                  <td>{r.ano}</td>
                  <td>
                    <strong className="teal-text">
                      {r.nota ?? r.conceito}
                    </strong>
                  </td>
                  <td>
                    <button className="icon-btn" onClick={() => remove(r.id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
function LegacyAttendance({ notify }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [marks, setMarks] = useState({});
  useEffect(() => {
    api.turmas().then((x) => {
      setClasses(x);
      if (x[0]) setClassId(String(x[0].id));
    });
  }, []);
  async function load() {
    if (!classId) return;
    const [students, freq] = await Promise.all([
      api.alunos(`turma_id=${classId}`),
      api.frequencias(`turma_id=${classId}`),
    ]);
    setRows(students);
    setMarks(Object.fromEntries(freq.map((x) => [x.aluno_id, true])));
  }
  useEffect(() => {
    load();
  }, [classId]);
  async function save() {
    try {
      await Promise.all(
        rows.map((r) =>
          api.saveFrequencia({
            aluno_id: r.id,
            data: date,
            presente: marks[r.id] !== false,
          }),
        ),
      );
      notify("Chamada salva com sucesso");
      await load();
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="PRESENÇA"
        title="Frequência"
        sub="Marque presença ou falta por turma e data."
      >
        <Button onClick={save}>
          <CalendarCheck size={16} /> Salvar presença/falta
        </Button>
      </Heading>
      <Card>
        <div className="inline-form">
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((x) => (
              <option value={x.id} key={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Presença em {date}</th>
                <th>Frequência acumulada</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.nome}</strong>
                  </td>
                  <td>
                    <button
                      className={cn(
                        "presence",
                        marks[r.id] !== false ? "present" : "absent",
                      )}
                      onClick={() =>
                        setMarks({ ...marks, [r.id]: marks[r.id] === false })
                      }
                    >
                      {marks[r.id] !== false ? "Presente" : "Falta"}
                    </button>
                  </td>
                  <td>{r.frequencia || 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
function LegacyWhiteboard({ user, notify }) {
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#2dd4bf");
  const [size, setSize] = useState(4);
  const [shapes, setShapes] = useState([]);
  const [history, setHistory] = useState([]);
  const [redo, setRedo] = useState([]);
  const stageRef = useRef(null);
  const drawing = useRef(null);
  useEffect(() => {
    api
      .quadros()
      .then(async (qs) => {
        if (!qs[0]) return;
        try {
          const json = qs[0].dados_json;
          const node = Konva.Node.create(json);
          const layer = node.findOne("Layer");
          const result = (layer?.children || []).map((n) => {
            const a = n.attrs;
            return { type: n.className.toLowerCase(), ...a };
          });
          setShapes(result);
        } catch (e) {
          notify("Não foi possível carregar o quadro");
        }
      })
      .catch(() => {});
  }, []);
  function snapshot() {
    return [...shapes];
  }
  function begin(e) {
    const p = e.target.getStage().getPointerPosition();
    if (tool === "select") return;
    if (tool === "eraser") {
      const hit = e.target;
      if (hit !== e.target.getStage()) {
        setHistory([...history, snapshot()]);
        setShapes(shapes.filter((_, i) => i !== hit.index));
      }
      return;
    }
    drawing.current = { x: p.x, y: p.y, points: [p.x, p.y] };
    if (tool === "pen")
      setShapes([
        ...shapes,
        {
          type: "line",
          points: [p.x, p.y],
          stroke: color,
          strokeWidth: size,
          lineCap: "round",
          lineJoin: "round",
        },
      ]);
  }
  function move(e) {
    if (!drawing.current) return;
    const p = e.target.getStage().getPointerPosition();
    if (tool === "pen") {
      const next = [...shapes];
      next[next.length - 1] = {
        ...next[next.length - 1],
        points: [...next[next.length - 1].points, p.x, p.y],
      };
      setShapes(next);
    }
  }
  function end(e) {
    if (!drawing.current) return;
    const d = drawing.current;
    const p = e.target.getStage().getPointerPosition();
    setHistory([...history, snapshot()]);
    setRedo([]);
    if (tool === "rect")
      setShapes([
        ...shapes,
        {
          type: "rect",
          x: d.x,
          y: d.y,
          width: p.x - d.x,
          height: p.y - d.y,
          stroke: color,
          strokeWidth: size,
        },
      ]);
    if (tool === "circle")
      setShapes([
        ...shapes,
        {
          type: "circle",
          x: d.x,
          y: d.y,
          radius: Math.max(10, Math.hypot(p.x - d.x, p.y - d.y)),
          stroke: color,
          strokeWidth: size,
        },
      ]);
    if (tool === "line")
      setShapes([
        ...shapes,
        {
          type: "line",
          points: [d.x, d.y, p.x, p.y],
          stroke: color,
          strokeWidth: size,
        },
      ]);
    drawing.current = null;
  }
  async function save() {
    const json = stageRef.current.getStage().toJSON();
    try {
      await api.saveQuadro({ nome: "Quadro principal", dados_json: json });
      notify("Quadro salvo no SQLite");
    } catch (e) {
      notify(e.message);
    }
  }
  function undo() {
    if (!history.length) return;
    setRedo([...redo, snapshot()]);
    setShapes(history.at(-1));
    setHistory(history.slice(0, -1));
  }
  function redoAction() {
    if (!redo.length) return;
    setHistory([...history, snapshot()]);
    setShapes(redo.at(-1));
    setRedo(redo.slice(0, -1));
  }
  return (
    <>
      <Heading
        eyebrow="PLANEJAMENTO"
        title="Quadro branco"
        sub="Desenhe, organize e salve o estado do canvas no banco."
      >
        <Button onClick={save}>
          <Download size={16} /> Salvar quadro
        </Button>
      </Heading>
      <Card className="whiteboard-card">
        <div className="canvas-toolbar">
          {[
            ["select", MoreHorizontal],
            ["pen", Pencil],
            ["eraser", Eraser],
            ["rect", Shapes],
            ["circle", Circle],
            ["line", LineIcon],
          ].map(([x, I]) => (
            <button
              className={cn("tool", tool === x && "active")}
              key={x}
              onClick={() => setTool(x)}
            >
              <I size={17} />
            </button>
          ))}
          <span className="toolbar-sep" />
          <button className="tool" onClick={undo}>
            <Undo2 size={17} />
          </button>
          <button className="tool" onClick={redoAction}>
            <Redo2 size={17} />
          </button>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <input
            className="range"
            type="range"
            min="1"
            max="18"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </div>
        <div className="canvas-wrap">
          <Stage
            ref={stageRef}
            width={1000}
            height={520}
            onMouseDown={begin}
            onMouseMove={move}
            onMouseUp={end}
          >
            <Layer>
              {shapes.map((s, i) =>
                s.type === "line" ? (
                  <KLine
                    key={i}
                    {...s}
                    onClick={(e) => tool === "eraser" && begin(e)}
                    draggable={tool === "select"}
                  />
                ) : s.type === "rect" ? (
                  <Rect
                    key={i}
                    {...s}
                    cornerRadius={8}
                    onClick={(e) => tool === "eraser" && begin(e)}
                    draggable={tool === "select"}
                  />
                ) : (
                  <KCircle
                    key={i}
                    {...s}
                    onClick={(e) => tool === "eraser" && begin(e)}
                    draggable={tool === "select"}
                  />
                ),
              )}
            </Layer>
          </Stage>
        </div>
      </Card>
    </>
  );
}
function LegacyEntities({ type, notify }) {
  const school = type === "escola";
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    endereco: "",
    telefone: "",
    email: "",
  });
  const apiList = school ? api.escolas : api.universidades;
  const create = school ? api.createEscola : api.createUniversidade;
  const remove = school ? api.deleteEscola : api.deleteUniversidade;
  const update = school ? api.updateEscola : api.updateUniversidade;
  useEffect(() => {
    apiList()
      .then(setRows)
      .catch((e) => notify(e.message));
  }, []);
  async function save(e) {
    e.preventDefault();
    if (!form.nome.trim()) return notify("Nome obrigatório");
    try {
      const item = await create(form);
      setRows([...rows, item]);
      setModal(false);
      setForm({ nome: "", endereco: "", telefone: "", email: "" });
      notify("Cadastro salvo com sucesso");
    } catch (e) {
      notify(e.message);
    }
  }
  async function edit(r) {
    const nome = prompt("Nome", r.nome);
    if (!nome?.trim()) return;
    const endereco = prompt("Endereço", r.endereco || "") || "";
    const item = await update(r.id, {
      nome,
      endereco,
      telefone: r.telefone || "",
      email: r.email || "",
    });
    setRows(rows.map((x) => (x.id === r.id ? item : x)));
    notify("Cadastro atualizado");
  }
  async function del(id) {
    await remove(id);
    setRows(rows.filter((x) => x.id !== id));
    notify("Cadastro excluído");
  }
  return (
    <>
      <Heading
        eyebrow="CADASTROS"
        title={school ? "Escolas" : "Universidades"}
        sub="Gerenciamento persistido no banco real."
      >
        <Button onClick={() => setModal(true)}>
          <Plus size={16} /> Novo cadastro
        </Button>
      </Heading>
      <div className="entity-grid">
        {rows.map((r) => (
          <Card className="entity-card" key={r.id}>
            <div className="entity-icon">
              {school ? <Building2 size={21} /> : <GraduationCap size={21} />}
            </div>
            <div>
              <h3>{r.nome}</h3>
              <p className="muted">{r.endereco || "Sem endereço informado"}</p>
            </div>
            <button className="icon-btn" onClick={() => edit(r)}>
              <Pencil size={16} />
            </button>
            <button className="icon-btn" onClick={() => del(r.id)}>
              <Trash2 size={16} />
            </button>
          </Card>
        ))}
      </div>
      {modal && (
        <Modal
          title={school ? "Nova escola" : "Nova universidade"}
          onClose={() => setModal(false)}
        >
          <form className="modal-form" onSubmit={save}>
            <label>
              Nome
              <input
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </label>
            <label>
              Endereço
              <input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              />
            </label>
            {school && (
              <>
                <label>
                  Telefone
                  <input
                    value={form.telefone}
                    onChange={(e) =>
                      setForm({ ...form, telefone: e.target.value })
                    }
                  />
                </label>
                <label>
                  E-mail
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            <Button className="full">Salvar</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Reports({ notify }) {
  const [students, setStudents] = useState([]);
  const [id, setId] = useState("");
  useEffect(() => {
    api.alunos().then((x) => {
      setStudents(x);
      if (x[0]) setId(String(x[0].id));
    });
  }, []);
  async function download() {
    if (!id) return notify("Selecione um aluno");
    try {
      const blob = await api.reportAluno(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relatorio-aluno.pdf";
      a.click();
      URL.revokeObjectURL(url);
      notify("PDF gerado com sucesso");
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="DOCUMENTOS"
        title="Relatórios"
        sub="PDF real gerado no backend com Puppeteer."
      >
        <Button onClick={download}>
          <Download size={16} /> Gerar PDF
        </Button>
      </Heading>
      <Card>
        <h3>Relatório individual</h3>
        <p className="muted">
          Selecione um aluno para gerar boletim, frequência e identificação.
        </p>
        <div className="inline-form">
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} · {s.matricula}
              </option>
            ))}
          </select>
          <Button onClick={download}>Gerar relatório individual</Button>
        </div>
      </Card>
    </>
  );
}
function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop">
      <GlassDialogContent>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {children}
      </GlassDialogContent>
    </div>
  );
}
function SettingsPage() {
  return (
    <>
      <Heading
        eyebrow="SISTEMA"
        title="Configurações"
        sub="Preferências da conta e da unidade escolar."
      />
      <Card>
        <h3>Persistência ativa</h3>
        <p className="muted">
          O EduSystem está conectado ao SQLite e à API Express local.
        </p>
      </Card>
    </>
  );
}

function Whiteboard(props) {
  return <AdvancedWhiteboard {...props} />;
}
function Entities(props) {
  return <EntityRegistry kind={props.type} notify={props.notify} />;
}
function Catalog(props) {
  return <CatalogPage kind={props.kind} notify={props.notify} />;
}
function Dashboard(props) {
  return <DashboardAdvanced {...props} />;
}
function Attendance(props) {
  return <AttendanceAdvanced {...props} />;
}

export default App;

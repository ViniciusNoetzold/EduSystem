import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarCheck,
  Download,
  FileText,
  GraduationCap,
  School,
  Sparkles,
  UserRound,
} from "lucide-react";
import { api } from "../services/api";
import "./reports-advanced.css";

const currentYear = new Date().getFullYear();
const cn = (...values) => values.filter(Boolean).join(" ");
function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button {...props} className={cn("btn", `btn-${variant}`, className)}>
      {children}
    </button>
  );
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReportsAdvanced({ user, notify }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState("");
  const parentView = String(user?.role || "").toLowerCase() === "pais";
  useEffect(() => {
    Promise.all([api.alunos("status=all"), api.turmas("status=all")])
      .then(([a, t]) => {
        setStudents(a);
        setClasses(t);
        setSelectedStudent(String(a[0]?.id || ""));
        setSelectedClass(String(a[0]?.turma_id || t[0]?.id || ""));
      })
      .catch((error) => notify(error.message));
  }, []);
  const student = useMemo(
    () => students.find((item) => String(item.id) === selectedStudent),
    [students, selectedStudent],
  );
  const turma = useMemo(
    () => classes.find((item) => String(item.id) === selectedClass),
    [classes, selectedClass],
  );
  function chooseStudent(value) {
    setSelectedStudent(value);
    const chosen = students.find((item) => String(item.id) === value);
    if (chosen?.turma_id) setSelectedClass(String(chosen.turma_id));
  }
  async function individual() {
    if (!selectedStudent) return notify("Selecione um aluno");
    setLoading("student");
    try {
      saveBlob(
        await api.reportAluno(selectedStudent, year),
        `relatorio-${student?.matricula || selectedStudent}-${year}.pdf`,
      );
      notify("Relatório individual gerado com sucesso");
    } catch (error) {
      notify(error.message);
    } finally {
      setLoading("");
    }
  }
  async function classReport() {
    if (!selectedClass) return notify("Selecione uma turma");
    setLoading("class");
    try {
      saveBlob(
        await api.reportTurma(selectedClass, year),
        `relatorio-turma-${turma?.nome || selectedClass}-${year}.pdf`,
      );
      notify("Relatório consolidado da turma gerado");
    } catch (error) {
      notify(error.message);
    } finally {
      setLoading("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">RELATÓRIOS E REUNIÕES</p>
          <h1>Central de relatórios</h1>
          <p className="muted">
            Documentos profissionais, explicativos e calculados com dados reais
            do sistema.
          </p>
        </div>
        <div className="report-year">
          <label>
            Ano de referência
            <input
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </label>
        </div>
      </div>
      <div className="report-intro">
        <div>
          <Sparkles size={19} />
        </div>
        <p>
          <strong>Relatórios preparados para leitura humana.</strong> Cada PDF
          explica os indicadores, apresenta boletim, frequência, comportamento e
          registros pedagógicos — informações úteis em reuniões com responsáveis
          e planejamento da equipe.
        </p>
      </div>
      <div className="report-grid">
        <section className="card report-card featured">
          <div className="report-card-head">
            <span className="report-icon student">
              <UserRound size={21} />
            </span>
            <span className="report-tag">INDIVIDUAL</span>
          </div>
          <h2>Relatório do aluno</h2>
          <p>
            Uma visão detalhada do desenvolvimento acadêmico e comportamental.
          </p>
          <label>
            Aluno
            <select
              value={selectedStudent}
              onChange={(event) => chooseStudent(event.target.value)}
            >
              <option value="">Selecione</option>
              {students.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome} · {item.turma}
                  {item.status === "Ativo" ? "" : " · aluno inativo"}
                </option>
              ))}
            </select>
          </label>
          {student && (
            <div className="report-preview">
              <div className="report-person">
                <span className="avatar soft">
                  {student.nome.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{student.nome}</strong>
                  <small>
                    {student.matricula} · {student.turma}
                  </small>
                </div>
              </div>
              <div className="preview-metrics">
                <div>
                  <BarChart3 size={15} />
                  <span>Média</span>
                  <strong>{Number(student.media || 0).toFixed(1)}</strong>
                </div>
                <div>
                  <CalendarCheck size={15} />
                  <span>Frequência</span>
                  <strong>{Number(student.frequencia || 0).toFixed(0)}%</strong>
                </div>
                <div>
                  <GraduationCap size={15} />
                  <span>Comportamento</span>
                  <strong>{student.comportamento || 5}/10</strong>
                </div>
              </div>
            </div>
          )}
          <ul className="report-content-list">
            <li>Identificação e contexto da turma</li>
            <li>Boletim completo por bimestre</li>
            <li>Gráfico comparativo por disciplina</li>
            <li>Frequência explicada e participação</li>
            <li>Histórico pedagógico para reuniões</li>
          </ul>
          <Button
            disabled={loading === "student" || !selectedStudent}
            onClick={individual}
          >
            <Download size={16} />
            {loading === "student"
              ? "Gerando PDF..."
              : "Gerar relatório individual"}
          </Button>
        </section>
        {!parentView && (
          <section className="card report-card">
            <div className="report-card-head">
              <span className="report-icon class">
                <School size={21} />
              </span>
              <span className="report-tag">CONSOLIDADO</span>
            </div>
            <h2>Relatório da turma</h2>
            <p>
              Indicadores gerais para coordenação, conselhos e planejamento
              docente.
            </p>
            <label>
              Turma
              <select
                value={selectedClass}
                onChange={(event) => setSelectedClass(event.target.value)}
              >
                <option value="">Selecione</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome} · {item.ano_letivo}
                    {item.ativo ? "" : " · turma inativa"}
                  </option>
                ))}
              </select>
            </label>
            {turma && (
              <div className="class-preview">
                <div>
                  <strong>{turma.nome}</strong>
                  <span>{turma.escola_nome || turma.escola}</span>
                </div>
                <div>
                  <strong>{turma.total_alunos || 0}</strong>
                  <span>alunos</span>
                </div>
                <div>
                  <strong>{turma.professor_nome || "—"}</strong>
                  <span>professor(a)</span>
                </div>
              </div>
            )}
            <ul className="report-content-list">
              <li>Resumo executivo da turma</li>
              <li>Média, frequência e comportamento</li>
              <li>Destaques acadêmicos em gráfico</li>
              <li>Tabela individual dos estudantes</li>
              <li>Quantidade de registros pedagógicos</li>
            </ul>
            <Button
              disabled={loading === "class" || !selectedClass}
              onClick={classReport}
            >
              <Download size={16} />
              {loading === "class"
                ? "Gerando PDF..."
                : "Gerar relatório da turma"}
            </Button>
          </section>
        )}
      </div>
      <section className="card report-guidance">
        <div>
          <FileText size={20} />
        </div>
        <div>
          <h3>Como interpretar</h3>
          <p>
            Notas, frequência e comportamento devem ser analisados em conjunto.
            Os PDFs usam cores apenas como apoio visual e incluem textos
            explicativos para evitar conclusões isoladas. Os registros
            pedagógicos acrescentam contexto aos números.
          </p>
        </div>
      </section>
    </>
  );
}

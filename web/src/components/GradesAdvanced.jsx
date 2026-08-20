import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Filter,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../services/api";
import "./grades-advanced.css";

const currentYear = new Date().getFullYear();
const empty = {
  aluno_id: "",
  disciplina: "",
  bimestre: 1,
  ano: currentYear,
  nota: "",
};
const cn = (...values) => values.filter(Boolean).join(" ");
function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button {...props} className={cn("btn", `btn-${variant}`, className)}>
      {children}
    </button>
  );
}

export default function GradesAdvanced({ notify }) {
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState("active");
  const [filters, setFilters] = useState({
    turma_id: "",
    bimestre: "",
    disciplina: "",
    ano: String(currentYear),
  });
  async function load() {
    try {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value),
      );
      params.set("status", status);
      const [n, a, m, t] = await Promise.all([
        api.notas(params.toString()),
        api.alunos(),
        api.materias(),
        api.turmas(),
      ]);
      setRows(n);
      setStudents(a);
      setSubjects(m);
      setClasses(t);
      setForm((previous) => ({
        ...previous,
        aluno_id: previous.aluno_id || String(a[0]?.id || ""),
        disciplina: previous.disciplina || m[0]?.nome || "",
      }));
    } catch (error) {
      notify(error.message);
    }
  }
  useEffect(() => {
    load();
  }, [
    filters.turma_id,
    filters.bimestre,
    filters.disciplina,
    filters.ano,
    status,
  ]);
  const availableStudents = useMemo(
    () =>
      students.filter(
        (item) =>
          !filters.turma_id || String(item.turma_id) === filters.turma_id,
      ),
    [students, filters.turma_id],
  );
  async function save(event) {
    event.preventDefault();
    if (!form.aluno_id || !form.disciplina || form.nota === "")
      return notify("Selecione aluno, matéria e informe a nota");
    const nota = Number(form.nota);
    if (nota < 0 || nota > 10) return notify("A nota deve estar entre 0 e 10");
    try {
      const payload = {
        ...form,
        aluno_id: Number(form.aluno_id),
        bimestre: Number(form.bimestre),
        ano: Number(form.ano),
        nota,
      };
      if (editing) await api.updateNota(editing, payload);
      else await api.saveNota(payload);
      setEditing(null);
      setForm({
        ...empty,
        aluno_id: String(availableStudents[0]?.id || ""),
        disciplina: subjects[0]?.nome || "",
      });
      await load();
      notify(
        editing ? "Nota atualizada com sucesso" : "Nota lançada com sucesso",
      );
    } catch (error) {
      notify(error.message);
    }
  }
  function edit(row) {
    setEditing(row.id);
    setForm({
      aluno_id: String(row.aluno_id),
      disciplina: row.disciplina,
      bimestre: Number(row.bimestre),
      ano: Number(row.ano),
      nota: String(row.nota ?? ""),
    });
    document
      .getElementById("grade-editor")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  async function remove(row) {
    if (
      !window.confirm(
        `Arquivar a nota de ${row.aluno} em ${row.disciplina}? O histórico será preservado.`,
      )
    )
      return;
    try {
      await api.deleteNota(row.id);
      await load();
      notify("Nota arquivada; o histórico foi preservado");
    } catch (error) {
      notify(error.message);
    }
  }
  async function restore(row) {
    try {
      await api.setNotaStatus(row.id, true);
      await load();
      notify("Nota restaurada com sucesso");
    } catch (error) {
      notify(error.message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACADÊMICO</p>
          <h1>Notas</h1>
          <p className="muted">
            Lançamento simples a partir das matérias cadastradas, com filtros e
            edição completa.
          </p>
        </div>
        <Button
          onClick={() =>
            document
              .getElementById("grade-editor")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <Plus size={16} /> Nova nota
        </Button>
      </div>
      <div className="archive-tabs">
        <button
          className={status === "active" ? "active" : ""}
          onClick={() => setStatus("active")}
        >
          Ativas
        </button>
        <button
          className={status === "inactive" ? "active" : ""}
          onClick={() => setStatus("inactive")}
        >
          Arquivadas
        </button>
        <button
          className={status === "all" ? "active" : ""}
          onClick={() => setStatus("all")}
        >
          Todas
        </button>
      </div>
      <section className="card grade-filters">
        <div className="filter-caption">
          <Filter size={16} />
          <div>
            <strong>Filtrar lançamentos</strong>
            <small>Refine a tabela sem alterar os dados.</small>
          </div>
        </div>
        <label>
          Turma
          <select
            value={filters.turma_id}
            onChange={(e) =>
              setFilters({ ...filters, turma_id: e.target.value })
            }
          >
            <option value="">Todas</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bimestre
          <select
            value={filters.bimestre}
            onChange={(e) =>
              setFilters({ ...filters, bimestre: e.target.value })
            }
          >
            <option value="">Todos</option>
            {[1, 2, 3, 4].map((item) => (
              <option key={item} value={item}>
                {item}º
              </option>
            ))}
          </select>
        </label>
        <label>
          Matéria
          <select
            value={filters.disciplina}
            onChange={(e) =>
              setFilters({ ...filters, disciplina: e.target.value })
            }
          >
            <option value="">Todas</option>
            {subjects.map((item) => (
              <option key={item.id}>{item.nome}</option>
            ))}
          </select>
        </label>
        <label>
          Ano
          <input
            type="number"
            min="2000"
            max="2100"
            value={filters.ano}
            onChange={(e) => setFilters({ ...filters, ano: e.target.value })}
          />
        </label>
      </section>
      <section className="card" id="grade-editor">
        <div className="grade-editor-head">
          <div>
            <span className="grade-editor-icon">
              {editing ? <Pencil size={17} /> : <BookOpen size={17} />}
            </span>
            <div>
              <h3>{editing ? "Editar lançamento" : "Lançar uma nota"}</h3>
              <p className="muted">A matéria vem do cadastro acadêmico.</p>
            </div>
          </div>
          {editing && (
            <button
              className="text-button"
              onClick={() => {
                setEditing(null);
                setForm(empty);
              }}
            >
              <X size={15} /> Cancelar edição
            </button>
          )}
        </div>
        <form className="grade-form" onSubmit={save}>
          <label>
            Aluno
            <select
              required
              value={form.aluno_id}
              onChange={(e) => setForm({ ...form, aluno_id: e.target.value })}
            >
              <option value="">Selecione</option>
              {availableStudents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome} · {item.turma}
                </option>
              ))}
            </select>
          </label>
          <label>
            Matéria
            <select
              required
              value={form.disciplina}
              onChange={(e) => setForm({ ...form, disciplina: e.target.value })}
            >
              <option value="">Selecione</option>
              {subjects.map((item) => (
                <option key={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Bimestre
            <select
              value={form.bimestre}
              onChange={(e) => setForm({ ...form, bimestre: e.target.value })}
            >
              {[1, 2, 3, 4].map((item) => (
                <option key={item} value={item}>
                  {item}º bimestre
                </option>
              ))}
            </select>
          </label>
          <label>
            Ano
            <input
              required
              type="number"
              min="2000"
              max="2100"
              value={form.ano}
              onChange={(e) => setForm({ ...form, ano: e.target.value })}
            />
          </label>
          <label>
            Nota
            <input
              required
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={form.nota}
              onChange={(e) => setForm({ ...form, nota: e.target.value })}
              placeholder="0 a 10"
            />
          </label>
          <Button>
            <Save size={15} />
            {editing ? "Atualizar" : "Salvar nota"}
          </Button>
        </form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Turma</th>
                <th>Matéria</th>
                <th>Período</th>
                <th>Nota</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.aluno}</strong>
                    </td>
                    <td>{row.turma}</td>
                    <td>{row.disciplina}</td>
                    <td>
                      {row.bimestre}º bim. · {row.ano}
                    </td>
                    <td>
                      <b
                        className={cn(
                          "grade-pill",
                          Number(row.nota) >= 7
                            ? "approved"
                            : Number(row.nota) >= 5
                              ? "recovery"
                              : "attention",
                        )}
                      >
                        {Number(row.nota).toFixed(1)}
                      </b>
                    </td>
                    <td>
                      <span
                        className={cn(
                          "grade-status",
                          Number(row.nota) >= 7
                            ? "approved"
                            : Number(row.nota) >= 5
                              ? "recovery"
                              : "attention",
                        )}
                      >
                        {Number(row.nota) >= 7 ? (
                          <>
                            <Check size={13} /> Adequado
                          </>
                        ) : Number(row.nota) >= 5 ? (
                          "Acompanhamento"
                        ) : (
                          "Atenção"
                        )}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        {row.ativo !== 0 && (
                          <button
                            className="icon-btn"
                            onClick={() => edit(row)}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        {row.ativo !== 0 ? (
                          <button
                            className="icon-btn danger"
                            onClick={() => remove(row)}
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <button
                            className="icon-btn"
                            onClick={() => restore(row)}
                            title="Restaurar nota"
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-row">
                    Nenhuma nota encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

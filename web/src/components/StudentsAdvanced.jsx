import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  FileSpreadsheet,
  Mail,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import readXlsxFile from "read-excel-file/browser";
import { api } from "../services/api";
import "./students-advanced.css";

const emptyStudent = {
  nome: "",
  matricula: "",
  turma_id: "",
  data_nascimento: "",
  responsavel: "",
  telefone_responsavel: "",
  email_responsavel: "",
  email: "",
  telefone: "",
  endereco: "",
  comportamento: 5,
  observacoes: "",
  curso_id: "",
};
const emptyTracking = () => ({
  data: new Date().toISOString().slice(0, 10),
  tipo: "Observação",
  titulo: "",
  descricao: "",
  comportamento: "",
});
const cn = (...values) => values.filter(Boolean).join(" ");
const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
function ageFrom(date) {
  if (!date) return null;
  const born = new Date(`${date}T12:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())
  )
    age--;
  return age;
}
function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button {...props} className={cn("btn", `btn-${variant}`, className)}>
      {children}
    </button>
  );
}
function Modal({ title, wide = false, onClose, children }) {
  return (
    <div className="modal-backdrop">
      <div
        className={cn("modal", wide && "modal-wide")}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function StudentsAdvanced({ user, notify }) {
  const [rows, setRows] = useState([]),
    [classes, setClasses] = useState([]),
    [courses, setCourses] = useState([]);
  const [status, setStatus] = useState("active"),
    [query, setQuery] = useState(""),
    [classFilter, setClassFilter] = useState(""),
    [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null),
    [studentModal, setStudentModal] = useState(false),
    [form, setForm] = useState(emptyStudent),
    [details, setDetails] = useState(null),
    [tracking, setTracking] = useState(emptyTracking());
  const fileRef = useRef(null),
    packageRef = useRef(null),
    pageSize = 8,
    role = normalize(user?.role),
    readOnly = role === "pais";
  const canExportPackage = ["diretor", "coordenador"].includes(role),
    canImportPackage = ["diretor", "coordenador", "professor"].includes(role);
  async function load(selectedStatus = status) {
    try {
      const [students, turmas, cursos] = await Promise.all([
        api.alunos(`status=${readOnly ? "active" : selectedStatus}`),
        api.turmas("status=all"),
        api.cursos("status=all"),
      ]);
      setRows(students);
      setClasses(turmas);
      setCourses(cursos);
    } catch (error) {
      notify(error.message);
    }
  }
  useEffect(() => {
    load(status);
  }, [status]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!query ||
            `${row.nome} ${row.matricula} ${row.responsavel || ""}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (!classFilter || String(row.turma_id) === classFilter),
      ),
    [rows, query, classFilter],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [query, classFilter, status]);
  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyStudent,
      turma_id: String(classes.find((item) => item.ativo)?.id || ""),
    });
    setStudentModal(true);
  }
  function openEdit(row) {
    setEditing(row.id);
    setForm({
      ...emptyStudent,
      ...row,
      telefone_responsavel:
        row.telefone_responsavel ||
        (String(row.contato_responsavel || "").includes("@")
          ? ""
          : row.contato_responsavel) ||
        "",
      email_responsavel:
        row.email_responsavel ||
        (String(row.contato_responsavel || "").includes("@")
          ? row.contato_responsavel
          : "") ||
        "",
      turma_id: String(row.turma_id || ""),
      curso_id: String(row.curso_id || ""),
    });
    setStudentModal(true);
  }
  async function save(event) {
    event.preventDefault();
    if (!form.nome.trim() || !form.matricula.trim() || !form.turma_id)
      return notify("Nome, matrícula e turma são obrigatórios");
    try {
      const payload = {
        ...form,
        turma_id: Number(form.turma_id),
        curso_id: form.curso_id ? Number(form.curso_id) : null,
        comportamento: Number(form.comportamento),
      };
      if (editing) await api.updateAluno(editing, payload);
      else await api.createAluno(payload);
      setStudentModal(false);
      setEditing(null);
      setForm(emptyStudent);
      await load(status);
      notify(
        editing
          ? "Aluno atualizado com sucesso"
          : "Aluno cadastrado com sucesso",
      );
    } catch (error) {
      notify(error.message);
    }
  }
  async function inactivate(row) {
    if (
      !window.confirm(`Inativar ${row.nome}? Todo o histórico será preservado.`)
    )
      return;
    try {
      await api.deleteAluno(row.id);
      await load(status);
      notify("Aluno movido para Inativos; nenhum histórico foi apagado");
    } catch (error) {
      notify(error.message);
    }
  }
  async function restore(row) {
    try {
      await api.setAlunoStatus(row.id, true);
      await load(status);
      notify("Aluno reativado e devolvido à lista principal");
    } catch (error) {
      notify(error.message);
    }
  }
  async function showDetails(row) {
    try {
      setDetails(await api.aluno(row.id));
      setTracking(emptyTracking());
    } catch (error) {
      notify(error.message);
    }
  }
  async function addTracking(event) {
    event.preventDefault();
    if (!tracking.titulo.trim() || !tracking.descricao.trim())
      return notify("Título e descrição do registro são obrigatórios");
    try {
      await api.createAcompanhamento(details.id, {
        ...tracking,
        comportamento:
          tracking.comportamento === "" ? null : Number(tracking.comportamento),
      });
      setDetails(await api.aluno(details.id));
      setTracking(emptyTracking());
      await load(status);
      notify("Registro pedagógico adicionado");
    } catch (error) {
      notify(error.message);
    }
  }
  async function removeTracking(id) {
    try {
      await api.deleteAcompanhamento(id);
      setDetails(await api.aluno(details.id));
      notify("Registro removido");
    } catch (error) {
      notify(error.message);
    }
  }
  async function importSheet(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      let matrix;
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text(),
          lines = text
            .replace(/^\uFEFF/, "")
            .split(/\r?\n/)
            .filter(Boolean),
          delimiter =
            (lines[0]?.match(/;/g) || []).length >
            (lines[0]?.match(/,/g) || []).length
              ? ";"
              : ",";
        matrix = lines.map((line) =>
          line
            .split(delimiter)
            .map((value) => value.trim().replace(/^"|"$/g, "")),
        );
      } else matrix = await readXlsxFile(file);
      const headers = (matrix[0] || []).map((value) =>
        String(value || "")
          .trim()
          .toLowerCase(),
      );
      const normalized = matrix
        .slice(1)
        .filter((row) => row.some((value) => value !== null && value !== ""))
        .map((row) =>
          Object.fromEntries(
            headers.map((header, index) => [
              header,
              row[index] instanceof Date
                ? row[index].toISOString().slice(0, 10)
                : (row[index] ?? ""),
            ]),
          ),
        );
      const result = await api.importAlunos(normalized);
      await load(status);
      notify(
        `${result.importados} aluno(s) importado(s)${result.falhas.length ? ` · ${result.falhas.length} linha(s) ignorada(s)` : ""}`,
      );
    } catch (error) {
      notify(`Falha na importação: ${error.message}`);
    }
  }
  function template() {
    const header =
        "nome;matricula;turma;data_nascimento;responsavel;telefone_responsavel;email_responsavel;email;telefone;endereco;comportamento",
      example = `Nome completo;2026-001;${classes.find((item) => item.ativo)?.nome || "Turma cadastrada"};2012-05-10;Nome do responsável;(00) 00000-0000;responsavel@email.com;aluno@email.com;;;5`;
    saveFile(
      new Blob([`\uFEFF${header}\r\n${example}\r\n`], {
        type: "text/csv;charset=utf-8",
      }),
      "modelo-importacao-alunos.csv",
    );
  }
  async function exportPackage() {
    try {
      const pack = await api.exportTransfer(classFilter),
        suffix = classFilter
          ? classes.find((item) => String(item.id) === classFilter)?.nome ||
            "turma"
          : "instituicao";
      saveFile(
        new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }),
        `edusystem-${suffix.replace(/\s+/g, "-").toLowerCase()}.edusystem.json`,
      );
      notify("Pacote criado sem usuários ou senhas");
    } catch (error) {
      notify(error.message);
    }
  }
  async function importPackage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const result = await api.importTransfer(JSON.parse(await file.text()));
      await load(status);
      notify(
        `Pacote importado: ${result.alunos} aluno(s), ${result.notas} nota(s) e ${result.frequencias} presença(s)`,
      );
    } catch (error) {
      notify(`Falha ao importar pacote: ${error.message}`);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CADASTRO E ACOMPANHAMENTO</p>
          <h1>{readOnly ? "Acompanhamento do aluno" : "Alunos"}</h1>
          <p className="muted">
            {readOnly
              ? "Consulte os dados acadêmicos e os registros vinculados à sua família."
              : "Cadastros ativos e arquivados, contatos familiares, transferência segura e histórico pedagógico."}
          </p>
        </div>
        {!readOnly && (
          <div className="student-actions">
            <Button variant="ghost" onClick={template}>
              <Download size={16} /> Modelo CSV
            </Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Importar planilha
            </Button>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept=".xlsx,.csv"
              onChange={importSheet}
            />
            {canExportPackage && (
              <Button variant="ghost" onClick={exportPackage}>
                <FileJson size={16} /> Exportar pacote
              </Button>
            )}
            {canImportPackage && (
              <Button
                variant="ghost"
                onClick={() => packageRef.current?.click()}
              >
                <Upload size={16} /> Importar pacote
              </Button>
            )}
            <input
              ref={packageRef}
              hidden
              type="file"
              accept=".json,.edusystem.json"
              onChange={importPackage}
            />
            <Button onClick={openCreate}>
              <Plus size={16} /> Novo aluno
            </Button>
          </div>
        )}
      </div>
      {!readOnly && (
        <div className="archive-tabs">
          <button
            className={status === "active" ? "active" : ""}
            onClick={() => setStatus("active")}
          >
            <ShieldCheck size={15} /> Ativos
          </button>
          <button
            className={status === "inactive" ? "active" : ""}
            onClick={() => setStatus("inactive")}
          >
            <Archive size={15} /> Inativos
          </button>
          <button
            className={status === "all" ? "active" : ""}
            onClick={() => setStatus("all")}
          >
            Todos
          </button>
        </div>
      )}
      <section className="card">
        <div className="student-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por aluno, matrícula ou responsável..."
            />
          </div>
          <label className="compact-filter">
            <SlidersHorizontal size={15} />
            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
            >
              <option value="">Todas as turmas</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                  {item.ativo ? "" : " · inativa"}
                </option>
              ))}
            </select>
          </label>
          <span className="result-count">{filtered.length} aluno(s)</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Turma / instituição</th>
                <th>Média</th>
                <th>Frequência</th>
                <th>Comportamento</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.length ? (
                visible.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        className="student-name"
                        onClick={() => showDetails(row)}
                      >
                        <span className="avatar soft">
                          {row.nome.slice(0, 2).toUpperCase()}
                        </span>
                        <span>
                          <strong>{row.nome}</strong>
                          <small>{row.matricula}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <strong>{row.turma}</strong>
                      <small className="table-sub">
                        {row.escola_nome ||
                          row.curso_nome ||
                          "Instituição não vinculada"}
                        {row.turma_ativo ? "" : " · turma inativa"}
                      </small>
                    </td>
                    <td>
                      <b
                        className={cn(
                          "score",
                          Number(row.media) >= 7
                            ? "good"
                            : Number(row.media) >= 5
                              ? "warn"
                              : "risk",
                        )}
                      >
                        {Number(row.media || 0).toFixed(1)}
                      </b>
                    </td>
                    <td>{Number(row.frequencia || 0).toFixed(0)}%</td>
                    <td>
                      <div className="behavior">
                        <i>
                          <b
                            style={{
                              width: `${Number(row.comportamento || 5) * 10}%`,
                            }}
                          />
                        </i>
                        <span>{row.comportamento || 5}/10</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={cn(
                          "access-status",
                          row.status === "Ativo" ? "active" : "inactive",
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        {!readOnly && (
                          <button
                            className="icon-btn"
                            title="Editar"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        <button
                          className="icon-btn"
                          title="Abrir acompanhamento"
                          onClick={() => showDetails(row)}
                        >
                          <BookOpen size={16} />
                        </button>
                        {!readOnly && row.status === "Ativo" && (
                          <button
                            className="icon-btn danger"
                            title="Inativar"
                            onClick={() => inactivate(row)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {!readOnly && row.status !== "Ativo" && (
                          <button
                            className="icon-btn"
                            title="Reativar"
                            onClick={() => restore(row)}
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7">
                    <div className="empty-table">
                      <FileSpreadsheet size={24} />
                      <strong>Nenhum aluno encontrado</strong>
                      <span>
                        {status === "inactive"
                          ? "Os alunos arquivados aparecerão aqui e poderão ser reativados."
                          : "Cadastre manualmente ou importe uma planilha."}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>
            Página {page} de {pages}
          </span>
          <div>
            <button
              className="icon-btn"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="icon-btn"
              disabled={page === pages}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
      {studentModal && (
        <Modal
          wide
          title={editing ? "Editar aluno" : "Novo aluno"}
          onClose={() => {
            setStudentModal(false);
            setEditing(null);
            setForm(emptyStudent);
          }}
        >
          <StudentForm
            form={form}
            setForm={setForm}
            classes={classes}
            courses={courses}
            onSubmit={save}
            editing={Boolean(editing)}
          />
        </Modal>
      )}
      {details && (
        <Modal
          wide
          title={`Acompanhamento · ${details.nome}`}
          onClose={() => setDetails(null)}
        >
          <div className="student-detail-head">
            <div>
              <span>Matrícula</span>
              <strong>{details.matricula}</strong>
            </div>
            <div>
              <span>Turma</span>
              <strong>
                {details.turma}
                {details.status !== "Ativo" ? " · inativo" : ""}
              </strong>
            </div>
            <div>
              <span>Responsável</span>
              <strong>{details.responsavel || "Não informado"}</strong>
            </div>
            <div>
              <span>Comportamento</span>
              <strong>{details.comportamento || 5}/10</strong>
            </div>
          </div>
          <div className="contact-strip">
            <div>
              <Phone size={16} />
              <span>
                <small>Responsável</small>
                {details.telefone_responsavel ||
                  details.contato_responsavel ||
                  "Telefone não informado"}
              </span>
            </div>
            <div>
              <Mail size={16} />
              <span>
                <small>E-mail do responsável</small>
                {details.email_responsavel || "Não informado"}
              </span>
            </div>
            <div>
              <Phone size={16} />
              <span>
                <small>Contato do aluno</small>
                {details.telefone || details.email || "Não informado"}
              </span>
            </div>
          </div>
          <div className={cn("tracking-layout", readOnly && "read-only")}>
            {!readOnly && (
              <form className="tracking-form" onSubmit={addTracking}>
                <h4>Novo registro</h4>
                <div className="form-grid two">
                  <label>
                    Data
                    <input
                      type="date"
                      required
                      value={tracking.data}
                      onChange={(e) =>
                        setTracking({ ...tracking, data: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      value={tracking.tipo}
                      onChange={(e) =>
                        setTracking({ ...tracking, tipo: e.target.value })
                      }
                    >
                      {[
                        "Observação",
                        "Comportamento",
                        "Aprendizagem",
                        "Participação",
                        "Reunião com responsáveis",
                        "Plano de intervenção",
                        "Conquista",
                      ].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Título
                  <input
                    required
                    value={tracking.titulo}
                    onChange={(e) =>
                      setTracking({ ...tracking, titulo: e.target.value })
                    }
                    placeholder="Ex.: Evolução na leitura"
                  />
                </label>
                <label>
                  Descrição
                  <textarea
                    required
                    rows="4"
                    value={tracking.descricao}
                    onChange={(e) =>
                      setTracking({ ...tracking, descricao: e.target.value })
                    }
                    placeholder="Registre fatos, avanços e próximos passos..."
                  />
                </label>
                <label>
                  Atualizar comportamento (opcional)
                  <div className="range-field">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={tracking.comportamento || 5}
                      onChange={(e) =>
                        setTracking({
                          ...tracking,
                          comportamento: e.target.value,
                        })
                      }
                    />
                    <strong>
                      {tracking.comportamento
                        ? `${tracking.comportamento}/10`
                        : "Não alterar"}
                    </strong>
                  </div>
                </label>
                <Button>Salvar registro</Button>
              </form>
            )}
            <div className="tracking-list">
              <h4>Histórico pedagógico</h4>
              {details.acompanhamentos?.length ? (
                details.acompanhamentos.map((item) => (
                  <article key={item.id}>
                    <i />
                    <div>
                      <div className="tracking-title">
                        <strong>{item.titulo}</strong>
                        {!readOnly && (
                          <button onClick={() => removeTracking(item.id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <small>
                        {new Date(`${item.data}T12:00:00`).toLocaleDateString(
                          "pt-BR",
                        )}{" "}
                        · {item.tipo} · {item.autor || "Equipe"}
                        {item.comportamento
                          ? ` · ${item.comportamento}/10`
                          : ""}
                      </small>
                      <p>{item.descricao}</p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-tracking">
                  Nenhum registro pedagógico disponível.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function StudentForm({ form, setForm, classes, courses, onSubmit, editing }) {
  const change = (key, value) =>
      setForm((current) => ({ ...current, [key]: value })),
    selectedClass = classes.find(
      (item) => String(item.id) === String(form.turma_id),
    ),
    age = ageFrom(form.data_nascimento),
    schoolClass = /(^|\s)[1-9]\s*[º°ª]\s*[a-z]?($|\s)/i.test(
      selectedClass?.nome || "",
    ),
    needsResponsible = schoolClass || (age !== null && age < 18),
    availableCourses = courses.filter(
      (item) =>
        item.ativo &&
        !(item.entidade_tipo === "universidade" && needsResponsible),
    );
  useEffect(() => {
    const selected = courses.find(
      (item) => String(item.id) === String(form.curso_id),
    );
    if (selected?.entidade_tipo === "universidade" && needsResponsible)
      change("curso_id", "");
  }, [form.turma_id, form.data_nascimento]);
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <div className="form-section-title">Identificação acadêmica</div>
      <div className="form-grid two">
        <label>
          Nome completo *
          <input
            required
            value={form.nome}
            onChange={(e) => change("nome", e.target.value)}
          />
        </label>
        <label>
          Matrícula *
          <input
            required
            value={form.matricula}
            onChange={(e) => change("matricula", e.target.value)}
          />
        </label>
        <label>
          Turma *
          <select
            required
            value={form.turma_id}
            onChange={(e) => change("turma_id", e.target.value)}
          >
            <option value="">Selecione</option>
            {classes
              .filter(
                (item) =>
                  item.ativo || String(item.id) === String(form.turma_id),
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                  {item.ativo ? "" : " · inativa"}
                </option>
              ))}
          </select>
        </label>
        <label>
          Curso (somente quando aplicável)
          <select
            value={form.curso_id}
            onChange={(e) => change("curso_id", e.target.value)}
            disabled={needsResponsible}
          >
            <option value="">Sem curso superior</option>
            {availableCourses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome} · {item.entidade_nome || "instituição"}
              </option>
            ))}
          </select>
          <small className="field-help">
            {needsResponsible
              ? "Turmas escolares e menores de 18 anos não podem receber curso superior."
              : "Use apenas para faculdade ou universidade."}
          </small>
        </label>
        <label>
          Data de nascimento
          <input
            type="date"
            value={form.data_nascimento || ""}
            onChange={(e) => change("data_nascimento", e.target.value)}
          />
        </label>
        <label>
          Nível de comportamento
          <div className="range-field">
            <input
              type="range"
              min="1"
              max="10"
              value={form.comportamento || 5}
              onChange={(e) => change("comportamento", e.target.value)}
            />
            <strong>{form.comportamento || 5}/10</strong>
          </div>
        </label>
      </div>
      <div className="form-section-title">Contato do aluno</div>
      <div className="form-grid two">
        <label>
          E-mail do aluno
          <input
            type="email"
            value={form.email || ""}
            onChange={(e) => change("email", e.target.value)}
          />
        </label>
        <label>
          Telefone do aluno
          <input
            value={form.telefone || ""}
            onChange={(e) => change("telefone", e.target.value)}
          />
        </label>
      </div>
      <div className="form-section-title">
        Responsável {needsResponsible && <span>obrigatório</span>}
      </div>
      <div className="form-grid two">
        <label>
          Nome do responsável {needsResponsible && "*"}
          <input
            required={needsResponsible}
            value={form.responsavel || ""}
            onChange={(e) => change("responsavel", e.target.value)}
          />
        </label>
        <label>
          Telefone do responsável {needsResponsible && "*"}
          <input
            required={needsResponsible}
            value={form.telefone_responsavel || ""}
            onChange={(e) => change("telefone_responsavel", e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </label>
        <label>
          E-mail do responsável
          <input
            type="email"
            value={form.email_responsavel || ""}
            onChange={(e) => change("email_responsavel", e.target.value)}
          />
        </label>
        <label>
          Endereço
          <input
            value={form.endereco || ""}
            onChange={(e) => change("endereco", e.target.value)}
          />
        </label>
      </div>
      <label>
        Observações gerais
        <textarea
          rows="3"
          value={form.observacoes || ""}
          onChange={(e) => change("observacoes", e.target.value)}
          placeholder="Informações importantes para a equipe pedagógica..."
        />
      </label>
      <Button className="full">
        {editing ? "Salvar alterações" : "Cadastrar aluno"}
      </Button>
    </form>
  );
}

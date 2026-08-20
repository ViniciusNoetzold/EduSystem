import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  GraduationCap,
  Pencil,
  Plus,
  RotateCcw,
  School,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../services/api";
import "./registries.css";

const cn = (...values) => values.filter(Boolean).join(" ");
const empty = {
  nome: "",
  endereco: "",
  telefone: "",
  email: "",
  codigo_inep: "",
  diretor: "",
  tipo: "Particular",
  cidade: "",
  estado: "",
  cep: "",
  cnpj: "",
  reitor: "",
};
const catalogDefaults = {
  turma: {
    nome: "",
    ano_letivo: 2026,
    serie: "",
    turno: "Manhã",
    sala: "",
    capacidade: 40,
    escola_id: "",
    professor_id: "",
  },
  materia: {
    nome: "",
    codigo: "",
    carga_horaria: "",
    etapa: "Ensino Fundamental",
    descricao: "",
  },
  curso: {
    nome: "",
    codigo: "",
    duracao: "",
    modalidade: "Presencial",
    entidade_tipo: "universidade",
    entidade_id: "",
    descricao: "",
  },
};

function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button {...props} className={cn("btn", `btn-${variant}`, className)}>
      {children}
    </button>
  );
}
function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop">
      <div className="modal registry-modal">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Heading({ title, sub, children }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">CADASTRO</p>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
      </div>
      {children}
    </div>
  );
}
function ArchiveTabs({ status, setStatus }) {
  return (
    <div className="archive-tabs">
      <button
        className={status === "active" ? "active" : ""}
        onClick={() => setStatus("active")}
      >
        Ativos
      </button>
      <button
        className={status === "inactive" ? "active" : ""}
        onClick={() => setStatus("inactive")}
      >
        Inativos
      </button>
      <button
        className={status === "all" ? "active" : ""}
        onClick={() => setStatus("all")}
      >
        Todos
      </button>
    </div>
  );
}
function Input({ label, value, onChange, type = "text", required = false }) {
  return (
    <label>
      {label}
      <input
        required={required}
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function EntityRegistry({ kind, notify }) {
  const school = kind === "escola";
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState("active");
  const title = school ? "Escolas" : "Universidades";
  const list = school ? api.escolas : api.universidades;
  const create = school ? api.createEscola : api.createUniversidade;
  const update = school ? api.updateEscola : api.updateUniversidade;
  const remove = school ? api.deleteEscola : api.deleteUniversidade;
  const setEntityStatus = school
    ? api.setEscolaStatus
    : api.setUniversidadeStatus;
  async function load() {
    try {
      setRows(await list(`status=${status}`));
    } catch (error) {
      notify(error.message);
    }
  }
  useEffect(() => {
    load();
  }, [status]);
  function open(row = null) {
    setEditing(row);
    setForm(
      row
        ? { ...empty, ...row }
        : school
          ? { ...empty, tipo: "Particular" }
          : { ...empty, tipo: "Universidade" },
    );
    setModal(true);
  }
  async function save(event) {
    event.preventDefault();
    if (!form.nome.trim()) return notify("O nome é obrigatório");
    try {
      const payload = { ...form };
      const item = editing
        ? await update(editing.id, payload)
        : await create(payload);
      setRows((previous) =>
        editing
          ? previous.map((row) => (row.id === item.id ? item : row))
          : [...previous, item],
      );
      setModal(false);
      notify(
        editing
          ? "Cadastro atualizado com sucesso"
          : "Cadastro criado com sucesso",
      );
    } catch (error) {
      notify(error.message);
    }
  }
  async function removeRow(id) {
    if (!window.confirm("Inativar este cadastro?")) return;
    try {
      await remove(id);
      await load();
      notify("Cadastro inativado com sucesso");
    } catch (error) {
      notify(error.message);
    }
  }
  async function restoreRow(id) {
    try {
      await setEntityStatus(id, true);
      await load();
      notify("Cadastro reativado com sucesso");
    } catch (error) {
      notify(error.message);
    }
  }
  return (
    <>
      <Heading
        title={title}
        sub={
          school
            ? "Unidades escolares, responsáveis e dados institucionais."
            : "Instituições, reitoria e informações acadêmicas."
        }
      >
        <Button onClick={() => open()}>
          <Plus size={16} /> Novo cadastro
        </Button>
      </Heading>
      <ArchiveTabs status={status} setStatus={setStatus} />
      <div className="entity-grid registry-grid">
        {rows.map((row) => (
          <div className="card entity-card registry-card" key={row.id}>
            <div className="entity-icon">
              {school ? <Building2 size={21} /> : <GraduationCap size={21} />}
            </div>
            <div className="registry-card-body">
              <h3>{row.nome}</h3>
              <p className="muted">
                {row.tipo || title.slice(0, -1)} ·{" "}
                {row.cidade || "Cidade não informada"}
              </p>
              <div className="registry-meta">
                <span>
                  {row.diretor || row.reitor || "Responsável não informado"}
                </span>
                <span>
                  {row.telefone || row.email || "Contato não informado"}
                </span>
              </div>
            </div>
            <div className="registry-actions">
              <button
                className="icon-btn"
                onClick={() => open(row)}
                title="Editar"
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-btn"
                onClick={() =>
                  row.ativo ? removeRow(row.id) : restoreRow(row.id)
                }
                title={row.ativo ? "Inativar" : "Reativar"}
              >
                {row.ativo ? <Trash2 size={16} /> : <RotateCcw size={16} />}
              </button>
            </div>
          </div>
        ))}
      </div>
      {modal && (
        <Modal
          title={
            editing
              ? `Editar ${school ? "escola" : "universidade"}`
              : `Nova ${school ? "escola" : "universidade"}`
          }
          onClose={() => setModal(false)}
        >
          <form className="modal-form registry-form" onSubmit={save}>
            <div className="form-section-title">Identificação</div>
            <Input
              label="Nome completo"
              value={form.nome}
              onChange={(value) => setForm({ ...form, nome: value })}
              required
            />
            <div className="form-grid">
              <Input
                label={school ? "Código INEP" : "CNPJ"}
                value={school ? form.codigo_inep : form.cnpj}
                onChange={(value) =>
                  setForm({ ...form, [school ? "codigo_inep" : "cnpj"]: value })
                }
              />
              <Input
                label={school ? "Diretor(a)" : "Reitor(a)"}
                value={school ? form.diretor : form.reitor}
                onChange={(value) =>
                  setForm({ ...form, [school ? "diretor" : "reitor"]: value })
                }
              />
            </div>
            <div className="form-grid">
              <Input
                label="Tipo de instituição"
                value={form.tipo}
                onChange={(value) => setForm({ ...form, tipo: value })}
              />
              <Input
                label="CEP"
                value={form.cep}
                onChange={(value) => setForm({ ...form, cep: value })}
              />
            </div>
            <div className="form-section-title">Localização e contato</div>
            <Input
              label="Endereço"
              value={form.endereco}
              onChange={(value) => setForm({ ...form, endereco: value })}
            />
            <div className="form-grid">
              <Input
                label="Cidade"
                value={form.cidade}
                onChange={(value) => setForm({ ...form, cidade: value })}
              />
              <Input
                label="Estado"
                value={form.estado}
                onChange={(value) => setForm({ ...form, estado: value })}
              />
            </div>
            <div className="form-grid">
              <Input
                label="Telefone"
                value={form.telefone}
                onChange={(value) => setForm({ ...form, telefone: value })}
              />
              <Input
                label="E-mail institucional"
                type="email"
                value={form.email}
                onChange={(value) => setForm({ ...form, email: value })}
              />
            </div>
            <Button className="full">Salvar cadastro</Button>
          </form>
        </Modal>
      )}
    </>
  );
}

export function CatalogPage({ kind, notify }) {
  const [rows, setRows] = useState([]);
  const [schools, setSchools] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(catalogDefaults[kind]);
  const [status, setStatus] = useState("active");
  const isClass = kind === "turma";
  const isSubject = kind === "materia";
  const title = isClass ? "Turmas" : isSubject ? "Matérias" : "Cursos";
  const apiList = isClass ? api.turmas : isSubject ? api.materias : api.cursos;
  const create = isClass
    ? api.createTurma
    : isSubject
      ? api.createMateria
      : api.createCurso;
  const update = isClass
    ? api.updateTurma
    : isSubject
      ? api.updateMateria
      : api.updateCurso;
  const remove = isClass
    ? api.deleteTurma
    : isSubject
      ? api.deleteMateria
      : api.deleteCurso;
  const setRegistryStatus = isClass
    ? api.setTurmaStatus
    : isSubject
      ? api.setMateriaStatus
      : api.setCursoStatus;
  async function load() {
    try {
      setRows(await apiList(`status=${status}`));
    } catch (error) {
      notify(error.message);
    }
  }
  useEffect(() => {
    load();
    if (isClass) {
      api
        .escolas()
        .then(setSchools)
        .catch(() => {});
      api
        .usuarios()
        .then((items) =>
          setTeachers(items.filter((item) => item.perfil === "Professor")),
        )
        .catch(() => {});
    }
    if (!isSubject)
      api
        .universidades()
        .then(setUniversities)
        .catch(() => {});
    if (!isClass && !isSubject)
      api
        .escolas()
        .then(setSchools)
        .catch(() => {});
  }, [kind, status]);
  function open(row = null) {
    setEditing(row);
    setForm(row ? { ...catalogDefaults[kind], ...row } : catalogDefaults[kind]);
    setModal(true);
  }
  async function save(event) {
    event.preventDefault();
    if (!form.nome.trim())
      return notify(
        `O nome ${isClass ? "da turma" : isSubject ? "da matéria" : "do curso"} é obrigatório`,
      );
    try {
      const item = editing
        ? await update(editing.id, form)
        : await create(form);
      setRows((previous) =>
        editing
          ? previous.map((row) => (row.id === item.id ? item : row))
          : [...previous, item],
      );
      setModal(false);
      notify(
        editing
          ? "Registro atualizado com sucesso"
          : "Registro criado com sucesso",
      );
    } catch (error) {
      notify(error.message);
    }
  }
  async function removeRow(id) {
    if (!window.confirm("Inativar este registro?")) return;
    try {
      await remove(id);
      await load();
      notify("Registro inativado com sucesso");
    } catch (error) {
      notify(error.message);
    }
  }
  async function restoreRow(id) {
    try {
      await setRegistryStatus(id, true);
      await load();
      notify("Registro reativado com sucesso");
    } catch (error) {
      notify(error.message);
    }
  }
  const subtitle = isClass
    ? "Organize séries, turnos, salas, capacidade e unidade escolar."
    : isSubject
      ? "Catálogo pedagógico usado no lançamento de notas."
      : "Cursos vinculados a escolas técnicas ou universidades.";
  return (
    <>
      <Heading title={title} sub={subtitle}>
        <Button onClick={() => open()}>
          <Plus size={16} /> Novo{" "}
          {isClass ? "turma" : isSubject ? "matéria" : "curso"}
        </Button>
      </Heading>
      <ArchiveTabs status={status} setStatus={setStatus} />
      <div className="card catalog-card">
        <div className="catalog-summary">
          <strong>{rows.length}</strong>
          <span>
            {status === "active"
              ? "registros ativos"
              : status === "inactive"
                ? "registros inativos"
                : "registros no total"}
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {isClass ? (
                  <>
                    <th>Turma</th>
                    <th>Ano</th>
                    <th>Turno</th>
                    <th>Sala</th>
                    <th>Capacidade</th>
                    <th>Escola</th>
                    <th>Professor(a)</th>
                  </>
                ) : isSubject ? (
                  <>
                    <th>Matéria</th>
                    <th>Código</th>
                    <th>Etapa</th>
                    <th>Carga horária</th>
                  </>
                ) : (
                  <>
                    <th>Curso</th>
                    <th>Código</th>
                    <th>Duração</th>
                    <th>Modalidade</th>
                    <th>Instituição</th>
                  </>
                )}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {isClass ? (
                    <>
                      <td>
                        <strong>{row.nome}</strong>
                        <small>{row.serie || "Série não informada"}</small>
                      </td>
                      <td>{row.ano_letivo}</td>
                      <td>{row.turno || "-"}</td>
                      <td>{row.sala || "-"}</td>
                      <td>{row.capacidade || "-"}</td>
                      <td>{row.escola_nome || row.escola || "-"}</td>
                      <td>{row.professor_nome || "Não atribuído"}</td>
                    </>
                  ) : isSubject ? (
                    <>
                      <td>
                        <strong>{row.nome}</strong>
                        <small>{row.descricao || "Sem descrição"}</small>
                      </td>
                      <td>{row.codigo || "-"}</td>
                      <td>{row.etapa || "-"}</td>
                      <td>
                        {row.carga_horaria ? `${row.carga_horaria}h` : "-"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <strong>{row.nome}</strong>
                        <small>{row.descricao || "Sem descrição"}</small>
                      </td>
                      <td>{row.codigo || "-"}</td>
                      <td>{row.duracao || "-"}</td>
                      <td>{row.modalidade || "-"}</td>
                      <td>{row.entidade_nome || "Não vinculada"}</td>
                    </>
                  )}
                  <td>
                    <button className="icon-btn" onClick={() => open(row)}>
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() =>
                        row.ativo ? removeRow(row.id) : restoreRow(row.id)
                      }
                    >
                      {row.ativo ? (
                        <Trash2 size={16} />
                      ) : (
                        <RotateCcw size={16} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <Modal
          title={
            editing
              ? "Editar registro"
              : `Novo ${isClass ? "turma" : isSubject ? "matéria" : "curso"}`
          }
          onClose={() => setModal(false)}
        >
          <form className="modal-form registry-form" onSubmit={save}>
            {isClass ? (
              <>
                <div className="form-grid">
                  <Input
                    label="Nome da turma"
                    value={form.nome}
                    onChange={(value) => setForm({ ...form, nome: value })}
                    required
                  />
                  <Input
                    label="Série/ano"
                    value={form.serie}
                    onChange={(value) => setForm({ ...form, serie: value })}
                  />
                </div>
                <div className="form-grid">
                  <Input
                    label="Ano letivo"
                    type="number"
                    value={form.ano_letivo}
                    onChange={(value) =>
                      setForm({ ...form, ano_letivo: value })
                    }
                    required
                  />
                  <label>
                    Turno
                    <select
                      value={form.turno}
                      onChange={(event) =>
                        setForm({ ...form, turno: event.target.value })
                      }
                    >
                      <option>Manhã</option>
                      <option>Tarde</option>
                      <option>Noite</option>
                      <option>Integral</option>
                    </select>
                  </label>
                </div>
                <div className="form-grid">
                  <Input
                    label="Sala"
                    value={form.sala}
                    onChange={(value) => setForm({ ...form, sala: value })}
                  />
                  <Input
                    label="Capacidade"
                    type="number"
                    value={form.capacidade}
                    onChange={(value) =>
                      setForm({ ...form, capacidade: value })
                    }
                  />
                </div>
                <label>
                  Escola
                  <select
                    value={form.escola_id || ""}
                    onChange={(event) =>
                      setForm({ ...form, escola_id: event.target.value })
                    }
                  >
                    <option value="">Selecionar escola</option>
                    {schools.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Professor(a) responsável
                  <select
                    value={form.professor_id || ""}
                    onChange={(event) =>
                      setForm({ ...form, professor_id: event.target.value })
                    }
                  >
                    <option value="">Não atribuído</option>
                    {teachers.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : isSubject ? (
              <>
                <Input
                  label="Nome da matéria"
                  value={form.nome}
                  onChange={(value) => setForm({ ...form, nome: value })}
                  required
                />
                <div className="form-grid">
                  <Input
                    label="Código"
                    value={form.codigo}
                    onChange={(value) => setForm({ ...form, codigo: value })}
                  />
                  <Input
                    label="Carga horária (horas)"
                    type="number"
                    value={form.carga_horaria}
                    onChange={(value) =>
                      setForm({ ...form, carga_horaria: value })
                    }
                  />
                </div>
                <Input
                  label="Etapa de ensino"
                  value={form.etapa}
                  onChange={(value) => setForm({ ...form, etapa: value })}
                />
                <label>
                  Descrição
                  <textarea
                    value={form.descricao}
                    onChange={(event) =>
                      setForm({ ...form, descricao: event.target.value })
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <Input
                  label="Nome do curso"
                  value={form.nome}
                  onChange={(value) => setForm({ ...form, nome: value })}
                  required
                />
                <div className="form-grid">
                  <Input
                    label="Código"
                    value={form.codigo}
                    onChange={(value) => setForm({ ...form, codigo: value })}
                  />
                  <Input
                    label="Duração"
                    value={form.duracao}
                    onChange={(value) => setForm({ ...form, duracao: value })}
                  />
                </div>
                <div className="form-grid">
                  <label>
                    Modalidade
                    <select
                      value={form.modalidade}
                      onChange={(event) =>
                        setForm({ ...form, modalidade: event.target.value })
                      }
                    >
                      <option>Presencial</option>
                      <option>Híbrido</option>
                      <option>EAD</option>
                    </select>
                  </label>
                  <label>
                    Tipo de instituição
                    <select
                      value={form.entidade_tipo}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          entidade_tipo: event.target.value,
                          entidade_id: "",
                        })
                      }
                    >
                      <option value="universidade">Universidade</option>
                      <option value="escola">Escola</option>
                    </select>
                  </label>
                </div>
                <label>
                  Instituição
                  <select
                    value={form.entidade_id || ""}
                    onChange={(event) =>
                      setForm({ ...form, entidade_id: event.target.value })
                    }
                  >
                    <option value="">Selecionar instituição</option>
                    {(form.entidade_tipo === "escola"
                      ? schools
                      : universities
                    ).map((row) => (
                      <option value={row.id} key={row.id}>
                        {row.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Descrição
                  <textarea
                    value={form.descricao}
                    onChange={(event) =>
                      setForm({ ...form, descricao: event.target.value })
                    }
                  />
                </label>
              </>
            )}
            <Button className="full">Salvar registro</Button>
          </form>
        </Modal>
      )}
    </>
  );
}

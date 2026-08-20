import { useEffect, useState } from "react";
import {
  Archive,
  Building2,
  KeyRound,
  Plus,
  RotateCcw,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { api } from "../services/api";
import "./team-management.css";

const empty = {
  nome: "",
  email: "",
  senha: "",
  perfil: "Professor",
  escola_ids: [],
  aluno_ids: [],
};
const cn = (...values) => values.filter(Boolean).join(" ");
function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button {...props} className={cn("btn", `btn-${variant}`, className)}>
      {children}
    </button>
  );
}

export default function TeamManagement({ notify }) {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [schools, setSchools] = useState([]);
  const [students, setStudents] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [userStatus, setUserStatus] = useState("active");
  const [profileStatus, setProfileStatus] = useState("active");
  async function load() {
    try {
      const [u, p, e, a] = await Promise.all([
        api.usuarios("status=all"),
        api.perfis("status=all"),
        api.escolas(),
        api.alunos(),
      ]);
      setUsers(u);
      setProfiles(p);
      setSchools(e);
      setStudents(a);
    } catch (error) {
      notify(error.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const toggle = (key, id) =>
    setForm((previous) => ({
      ...previous,
      [key]: previous[key].includes(id)
        ? previous[key].filter((item) => item !== id)
        : [...previous[key], id],
    }));
  async function save(event) {
    event.preventDefault();
    if (!form.nome.trim() || !form.email.trim() || form.senha.length < 6)
      return notify("Informe nome, e-mail e senha de pelo menos 6 caracteres");
    try {
      await api.createUsuario(form);
      setForm(empty);
      setModal(false);
      await load();
      notify("Usuário criado e vínculos salvos");
    } catch (error) {
      notify(error.message);
    }
  }
  async function status(user) {
    try {
      await api.updateUsuario(user.id, {
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        ativo: user.ativo ? 0 : 1,
      });
      await load();
      notify(user.ativo ? "Acesso desativado" : "Acesso reativado");
    } catch (error) {
      notify(error.message);
    }
  }
  async function changeProfileStatus(profile) {
    try {
      await api.setPerfilStatus(profile.id, !profile.ativo);
      await load();
      notify(profile.ativo ? "Perfil arquivado" : "Perfil reativado");
    } catch (error) {
      notify(error.message);
    }
  }
  const visibleUsers = users.filter(
    (item) =>
      userStatus === "all" || Boolean(item.ativo) === (userStatus === "active"),
  );
  const visibleProfiles = profiles.filter(
    (item) =>
      profileStatus === "all" ||
      Boolean(item.ativo) === (profileStatus === "active"),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">EQUIPE E SEGURANÇA</p>
          <h1>Usuários e perfis</h1>
          <p className="muted">
            Gerencie cargos, acessos, escolas de trabalho e responsáveis
            vinculados.
          </p>
        </div>
        <Button onClick={() => setModal(true)}>
          <Plus size={16} /> Novo usuário
        </Button>
      </div>
      <div className="team-summary">
        <div>
          <Users size={18} />
          <span>Usuários</span>
          <strong>{users.length}</strong>
        </div>
        <div>
          <ShieldCheck size={18} />
          <span>Perfis disponíveis</span>
          <strong>{profiles.length}</strong>
        </div>
        <div>
          <Building2 size={18} />
          <span>Escolas</span>
          <strong>{schools.length}</strong>
        </div>
      </div>
      <div className="archive-tabs">
        <button
          className={userStatus === "active" ? "active" : ""}
          onClick={() => setUserStatus("active")}
        >
          Usuários ativos
        </button>
        <button
          className={userStatus === "inactive" ? "active" : ""}
          onClick={() => setUserStatus("inactive")}
        >
          <Archive size={14} /> Inativos
        </button>
        <button
          className={userStatus === "all" ? "active" : ""}
          onClick={() => setUserStatus("all")}
        >
          Todos
        </button>
      </div>
      <section className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Escolas vinculadas</th>
                <th>Alunos vinculados</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="team-person">
                      <span className="avatar soft">
                        {user.nome
                          .split(" ")
                          .map((item) => item[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <strong>{user.nome}</strong>
                        <small>{user.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="role-pill">
                      <UserCog size={13} />
                      {user.perfil}
                    </span>
                  </td>
                  <td>
                    {user.escolas || (
                      <span className="muted">Todas / não definido</span>
                    )}
                  </td>
                  <td>
                    {user.alunos_vinculados || (
                      <span className="muted">Nenhum</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={cn(
                        "access-status",
                        user.ativo ? "active" : "inactive",
                      )}
                    >
                      {user.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost compact"
                      onClick={() => status(user)}
                    >
                      {user.ativo ? "Desativar" : "Reativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card profile-management">
        <div className="profile-management-head">
          <div>
            <h3>Perfis de acesso</h3>
            <p className="muted">
              Perfis arquivados deixam de aceitar novos usuários e logins, mas
              continuam registrados.
            </p>
          </div>
          <div className="archive-tabs">
            <button
              className={profileStatus === "active" ? "active" : ""}
              onClick={() => setProfileStatus("active")}
            >
              Ativos
            </button>
            <button
              className={profileStatus === "inactive" ? "active" : ""}
              onClick={() => setProfileStatus("inactive")}
            >
              Inativos
            </button>
            <button
              className={profileStatus === "all" ? "active" : ""}
              onClick={() => setProfileStatus("all")}
            >
              Todos
            </button>
          </div>
        </div>
        <div className="profile-grid">
          {visibleProfiles.map((profile) => (
            <article key={profile.id}>
              <span className="role-pill">
                <ShieldCheck size={14} />
                {profile.nome}
              </span>
              <p>{profile.descricao || "Sem descrição"}</p>
              <small>
                {profile.total_usuarios || 0} usuário(s) vinculado(s)
              </small>
              <button
                className="btn btn-ghost compact"
                onClick={() => changeProfileStatus(profile)}
              >
                {profile.ativo ? (
                  <>
                    <Archive size={14} /> Arquivar
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} /> Reativar
                  </>
                )}
              </button>
            </article>
          ))}
        </div>
      </section>
      {modal && (
        <div className="modal-backdrop">
          <div className="modal modal-wide">
            <div className="modal-head">
              <h3>Novo usuário</h3>
              <button className="icon-btn" onClick={() => setModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form className="modal-form" onSubmit={save}>
              <div className="form-grid two">
                <label>
                  Nome completo *
                  <input
                    required
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </label>
                <label>
                  E-mail *
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </label>
                <label>
                  Senha inicial *
                  <input
                    required
                    minLength="6"
                    type="password"
                    value={form.senha}
                    onChange={(e) =>
                      setForm({ ...form, senha: e.target.value })
                    }
                  />
                </label>
                <label>
                  Perfil
                  <select
                    value={form.perfil}
                    onChange={(e) =>
                      setForm({ ...form, perfil: e.target.value })
                    }
                  >
                    {profiles
                      .filter((item) => item.ativo)
                      .map((item) => (
                        <option key={item.id}>{item.nome}</option>
                      ))}
                  </select>
                </label>
              </div>
              <fieldset>
                <legend>Escolas onde trabalha</legend>
                <div className="choice-grid">
                  {schools.map((item) => (
                    <label className="choice" key={item.id}>
                      <input
                        type="checkbox"
                        checked={form.escola_ids.includes(item.id)}
                        onChange={() => toggle("escola_ids", item.id)}
                      />
                      <span>{item.nome}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {form.perfil === "Pais" && (
                <fieldset>
                  <legend>Filhos / alunos que poderá acompanhar</legend>
                  <div className="choice-grid scroll">
                    {students.map((item) => (
                      <label className="choice" key={item.id}>
                        <input
                          type="checkbox"
                          checked={form.aluno_ids.includes(item.id)}
                          onChange={() => toggle("aluno_ids", item.id)}
                        />
                        <span>
                          {item.nome} · {item.turma}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="access-hint">
                <KeyRound size={17} />
                <span>
                  O usuário poderá trocar de senha em uma versão futura.
                  Entregue a senha inicial de forma segura.
                </span>
              </div>
              <Button className="full">Criar usuário</Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

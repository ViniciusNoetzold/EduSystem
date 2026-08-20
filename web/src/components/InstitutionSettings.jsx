import { useEffect, useMemo, useState } from "react";
import {
  Check,
  DatabaseBackup,
  Network,
  Save,
  Server,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { api } from "../services/api";
import "./institution-settings.css";

const types = [
  [
    "escola",
    "Escola",
    "Educação infantil, fundamental e gestão escolar geral.",
  ],
  [
    "ensino_medio",
    "Ensino médio",
    "Turmas, disciplinas, notas e acompanhamento por bimestre.",
  ],
  ["creche", "Creche", "Alunos, turmas, frequência e rotina infantil."],
  [
    "cursinho",
    "Cursinho",
    "Turmas preparatórias, matérias, frequência e desempenho.",
  ],
  [
    "faculdade",
    "Faculdade",
    "Cursos, alunos, disciplinas, notas e frequência acadêmica.",
  ],
  [
    "universidade",
    "Universidade",
    "Gestão acadêmica completa com cursos e instituições.",
  ],
];
const modules = [
  ["dashboard", "Dashboard"],
  ["alunos", "Alunos"],
  ["turmas", "Turmas"],
  ["materias", "Matérias"],
  ["notas", "Notas"],
  ["frequencia", "Frequência"],
  ["quadro", "Quadro Branco"],
  ["relatorios", "Relatórios"],
  ["escolas", "Escolas"],
  ["universidades", "Universidades"],
  ["cursos", "Cursos"],
  ["equipe", "Equipe e acessos"],
];
const defaults = {
  escola: [
    "dashboard",
    "alunos",
    "turmas",
    "materias",
    "notas",
    "frequencia",
    "quadro",
    "relatorios",
    "escolas",
    "equipe",
  ],
  ensino_medio: [
    "dashboard",
    "alunos",
    "turmas",
    "materias",
    "notas",
    "frequencia",
    "relatorios",
    "escolas",
    "equipe",
  ],
  creche: [
    "dashboard",
    "alunos",
    "turmas",
    "frequencia",
    "relatorios",
    "equipe",
  ],
  cursinho: [
    "dashboard",
    "alunos",
    "turmas",
    "materias",
    "notas",
    "frequencia",
    "relatorios",
    "cursos",
    "equipe",
  ],
  faculdade: [
    "dashboard",
    "alunos",
    "turmas",
    "materias",
    "notas",
    "frequencia",
    "quadro",
    "relatorios",
    "cursos",
    "universidades",
    "equipe",
  ],
  universidade: [
    "dashboard",
    "alunos",
    "turmas",
    "materias",
    "notas",
    "frequencia",
    "quadro",
    "relatorios",
    "cursos",
    "universidades",
    "escolas",
    "equipe",
  ],
};

export default function InstitutionSettings({ config, setConfig }) {
  const [form, setForm] = useState({
    ...config,
    modulos: config.modulos || {},
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api
      .configuracoes()
      .then((value) => {
        setForm(value);
        setConfig(value);
        localStorage.setItem("edusystem_config", JSON.stringify(value));
      })
      .catch(() => {});
  }, []);
  const enabled = useMemo(() => {
    const base = defaults[form.tipo] || defaults.escola;
    return (key) =>
      form.modulos?.[key] === undefined
        ? base.includes(key)
        : Boolean(form.modulos[key]);
  }, [form]);
  function chooseType(tipo) {
    setForm((previous) => ({ ...previous, tipo, modulos: {} }));
    setSaved(false);
  }
  function toggle(key) {
    setForm((previous) => ({
      ...previous,
      modulos: { ...previous.modulos, [key]: !enabled(key) },
    }));
    setSaved(false);
  }
  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const value = await api.saveConfiguracoes(form);
      setConfig(value);
      setForm(value);
      localStorage.setItem("edusystem_config", JSON.stringify(value));
      setSaved(true);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SISTEMA</p>
          <h1>Configurações</h1>
          <p className="muted">
            Defina o tipo de instituição e organize os módulos exibidos na
            aplicação.
          </p>
        </div>
      </div>
      <form onSubmit={save} className="institution-settings">
        <section className="card settings-panel">
          <div className="settings-panel-title">
            <div className="settings-icon">
              <Settings2 size={19} />
            </div>
            <div>
              <h3>Perfil da instituição</h3>
              <p className="muted">
                Essa escolha adapta a navegação e os cadastros ao seu contexto.
              </p>
            </div>
          </div>
          <div className="institution-type-grid">
            {types.map(([value, label, description]) => (
              <button
                type="button"
                key={value}
                className={`institution-type ${form.tipo === value ? "selected" : ""}`}
                onClick={() => chooseType(value)}
              >
                <strong>{label}</strong>
                <span>{description}</span>
                {form.tipo === value && <Check size={17} />}
              </button>
            ))}
          </div>
          <div className="form-grid settings-fields">
            <label>
              Nome da instituição
              <input
                value={form.nome || ""}
                onChange={(event) =>
                  setForm({ ...form, nome: event.target.value })
                }
                required
              />
            </label>
            <label>
              Descrição ou unidade
              <input
                value={form.descricao || ""}
                onChange={(event) =>
                  setForm({ ...form, descricao: event.target.value })
                }
              />
            </label>
          </div>
        </section>
        <section className="card settings-panel">
          <div className="settings-panel-title">
            <div className="settings-icon">
              <Settings2 size={19} />
            </div>
            <div>
              <h3>Módulos visíveis</h3>
              <p className="muted">
                Você pode personalizar a sugestão do perfil e ocultar módulos
                que não usa.
              </p>
            </div>
          </div>
          <div className="module-grid">
            {modules.map(([key, label]) => (
              <label
                className={`module-toggle ${enabled(key) ? "active" : ""}`}
                key={key}
              >
                <input
                  type="checkbox"
                  checked={enabled(key)}
                  onChange={() => toggle(key)}
                />
                <span>{label}</span>
                <i>{enabled(key) ? "Ativo" : "Oculto"}</i>
              </label>
            ))}
          </div>
        </section>
        <section className="card settings-panel sync-blueprint">
          <div className="settings-panel-title">
            <div className="settings-icon">
              <Network size={19} />
            </div>
            <div>
              <h3>Centralização em rede</h3>
              <p className="muted">
                Arquitetura planejada para os computadores enviarem somente
                dados do EduSystem ao diretor.
              </p>
            </div>
            <span className="planned-badge">Planejado · não ativado</span>
          </div>
          <div className="sync-flow">
            <article>
              <Server size={20} />
              <strong>PC do diretor</strong>
              <span>
                Funciona como central local e aprova os pacotes recebidos.
              </span>
            </article>
            <i>← rede local →</i>
            <article>
              <Network size={20} />
              <strong>PCs da equipe</strong>
              <span>
                Enviam apenas alterações permitidas pelo perfil do usuário.
              </span>
            </article>
          </div>
          <div className="sync-rules">
            <div>
              <ShieldCheck size={17} />
              <span>
                <strong>Segurança</strong> Dispositivos autorizados, conexão
                criptografada e nenhuma senha dentro dos pacotes.
              </span>
            </div>
            <div>
              <DatabaseBackup size={17} />
              <span>
                <strong>Conflitos e recuperação</strong> Fila de aprovação,
                histórico de alterações e backup antes de aplicar cada
                sincronização.
              </span>
            </div>
          </div>
          <p className="sync-note">
            O pacote de transferência manual disponível em Alunos é a primeira
            etapa dessa arquitetura. A sincronização automática exigirá ativação
            explícita e configuração da rede da instituição.
          </p>
        </section>
        <div className="settings-save">
          <ButtonSave saving={saving} />
          {saved && (
            <span className="settings-saved">
              Configuração salva. O menu foi atualizado.
            </span>
          )}
        </div>
      </form>
    </>
  );
}
function ButtonSave({ saving }) {
  return (
    <button className="btn btn-primary" disabled={saving}>
      <Save size={16} />
      {saving ? "Salvando…" : "Salvar configuração"}
    </button>
  );
}

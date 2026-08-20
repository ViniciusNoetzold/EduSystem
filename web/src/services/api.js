const desktopPort =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("apiPort")
    : null;
const API_URL =
  import.meta.env.VITE_API_URL || `http://127.0.0.1:${desktopPort || 3333}/api`;

async function request(path, options = {}) {
  const token = JSON.parse(
    sessionStorage.getItem("gestao_user") || "null",
  )?.token;
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Não foi possível concluir a requisição");
  }
  return response.status === 204 ? null : response.json();
}

export const api = {
  authStatus: () => request("/auth/status"),
  login: (identifier, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),
  register: (payload) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => request("/me"),
  preference: (key) => request(`/preferencias/${encodeURIComponent(key)}`),
  savePreference: (key, value) =>
    request(`/preferencias/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
  perfis: (params = "") => request(`/perfis${params ? `?${params}` : ""}`),
  setPerfilStatus: (id, ativo) =>
    request(`/perfis/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ ativo }),
    }),
  usuarios: (params = "") => request(`/usuarios${params ? `?${params}` : ""}`),
  createUsuario: (payload) =>
    request("/usuarios", { method: "POST", body: JSON.stringify(payload) }),
  updateUsuario: (id, payload) =>
    request(`/usuarios/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  saveVinculosUsuario: (id, payload) =>
    request(`/usuarios/${id}/vinculos`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  configuracoes: () => request("/configuracoes"),
  saveConfiguracoes: (payload) =>
    request("/configuracoes", { method: "PUT", body: JSON.stringify(payload) }),
  dashboard: (params = "") =>
    request(`/dashboard${params ? `?${params}` : ""}`),
  turmas: (params = "") => request(`/turmas${params ? `?${params}` : ""}`),
  createTurma: (payload) =>
    request("/turmas", { method: "POST", body: JSON.stringify(payload) }),
  updateTurma: (id, payload) =>
    request(`/turmas/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteTurma: (id) => request(`/turmas/${id}`, { method: "DELETE" }),
  setTurmaStatus: (id, ativo) =>
    request(`/turmas/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ ativo }),
    }),
  materias: (params = "") => request(`/materias${params ? `?${params}` : ""}`),
  createMateria: (payload) =>
    request("/materias", { method: "POST", body: JSON.stringify(payload) }),
  updateMateria: (id, payload) =>
    request(`/materias/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteMateria: (id) => request(`/materias/${id}`, { method: "DELETE" }),
  setMateriaStatus: (id, ativo) =>
    request(`/materias/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ ativo }),
    }),
  cursos: (params = "") => request(`/cursos${params ? `?${params}` : ""}`),
  createCurso: (payload) =>
    request("/cursos", { method: "POST", body: JSON.stringify(payload) }),
  updateCurso: (id, payload) =>
    request(`/cursos/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCurso: (id) => request(`/cursos/${id}`, { method: "DELETE" }),
  setCursoStatus: (id, ativo) =>
    request(`/cursos/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ ativo }),
    }),
  alunos: (params = "") => request(`/alunos${params ? `?${params}` : ""}`),
  createAluno: (payload) =>
    request("/alunos", { method: "POST", body: JSON.stringify(payload) }),
  updateAluno: (id, payload) =>
    request(`/alunos/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteAluno: (id) => request(`/alunos/${id}`, { method: "DELETE" }),
  setAlunoStatus: (id, ativo) =>
    request(`/alunos/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ ativo }),
    }),
  aluno: (id) => request(`/alunos/${id}`),
  importAlunos: (rows) =>
    request("/alunos/importar", {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
  acompanhamentos: (id) => request(`/alunos/${id}/acompanhamentos`),
  createAcompanhamento: (id, payload) =>
    request(`/alunos/${id}/acompanhamentos`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteAcompanhamento: (id) =>
    request(`/acompanhamentos/${id}`, { method: "DELETE" }),
  notas: (params = "") => request(`/notas${params ? `?${params}` : ""}`),
  saveNota: (payload) =>
    request("/notas", { method: "POST", body: JSON.stringify(payload) }),
  updateNota: (id, payload) =>
    request(`/notas/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteNota: (id) => request(`/notas/${id}`, { method: "DELETE" }),
  setNotaStatus: (id, ativo) =>
    request(`/notas/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ ativo }),
    }),
  frequencias: (params = "") =>
    request(`/frequencias${params ? `?${params}` : ""}`),
  saveFrequencia: (payload) =>
    request("/frequencias", { method: "POST", body: JSON.stringify(payload) }),
  escolas: (params = "") => request(`/escolas${params ? `?${params}` : ""}`),
  createEscola: (payload) =>
    request("/escolas", { method: "POST", body: JSON.stringify(payload) }),
  updateEscola: (id, payload) =>
    request(`/escolas/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteEscola: (id) => request(`/escolas/${id}`, { method: "DELETE" }),
  setEscolaStatus: (id, ativo) =>
    request(`/escolas/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ ativo }),
    }),
  universidades: (params = "") =>
    request(`/universidades${params ? `?${params}` : ""}`),
  createUniversidade: (payload) =>
    request("/universidades", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateUniversidade: (id, payload) =>
    request(`/universidades/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteUniversidade: (id) =>
    request(`/universidades/${id}`, { method: "DELETE" }),
  setUniversidadeStatus: (id, ativo) =>
    request(`/universidades/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ ativo }),
    }),
  exportTransfer: (turmaId = "") =>
    request(
      `/transferencia/exportar${turmaId ? `?turma_id=${encodeURIComponent(turmaId)}` : ""}`,
    ),
  importTransfer: (payload) =>
    request("/transferencia/importar", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  quadros: () => request("/quadros"),
  saveQuadro: (payload) =>
    request("/quadros", { method: "POST", body: JSON.stringify(payload) }),
  reportAluno: (id, ano) =>
    requestBlob(`/relatorios/aluno/${id}${ano ? `?ano=${ano}` : ""}`),
  reportTurma: (id, ano) =>
    requestBlob(`/relatorios/turma/${id}${ano ? `?ano=${ano}` : ""}`),
};

export async function requestBlob(path) {
  const token = JSON.parse(
    sessionStorage.getItem("gestao_user") || "null",
  )?.token;
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Não foi possível baixar o arquivo");
  }
  return response.blob();
}

import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import puppeteer from "puppeteer";
import fs from "node:fs";
import db from "./src/database.js";
import { createClassReportHandler, createReportHandler } from "./src/report.js";
import { dashboardHandler } from "./src/dashboard.js";

const app = express();
const PORT = Number(process.env.PORT || 3333);
const SECRET = process.env.JWT_SECRET || "edusystem-local-secret-change-me";
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const chromePath =
  process.env.PUPPETEER_EXECUTABLE_PATH || chromeCandidates.find(fs.existsSync);
const reportAluno = createReportHandler({ puppeteer, chromePath });
const reportTurma = createClassReportHandler({ puppeteer, chromePath });
app.use(cors());
app.use(express.json({ limit: "50mb" }));
const publicUser = (r) => ({
  id: r.id,
  name: r.nome,
  email: r.email,
  role: r.perfil,
  perfil: r.perfil,
});
const tokenFor = (r) => jwt.sign(publicUser(r), SECRET, { expiresIn: "30d" });
function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res
      .status(401)
      .json({ message: "Sessão expirada ou token inválido" });
  }
}
const normalizeRole = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const allow =
  (...roles) =>
  (req, res, next) =>
    roles.map(normalizeRole).includes(normalizeRole(req.user.role))
      ? next()
      : res
          .status(403)
          .json({ message: "Seu perfil não possui permissão para esta ação" });
function studentScope(req, alias = "a") {
  const role = normalizeRole(req.user.role);
  if (role === "professor")
    return {
      sql: `EXISTS(SELECT 1 FROM turmas access_t WHERE access_t.id=${alias}.turma_id AND access_t.professor_id=?)`,
      args: [req.user.id],
    };
  if (role === "pais")
    return {
      sql: `EXISTS(SELECT 1 FROM usuario_alunos access_a WHERE access_a.aluno_id=${alias}.id AND access_a.usuario_id=?)`,
      args: [req.user.id],
    };
  return { sql: "1=1", args: [] };
}
function statusClause(value, column, activeValue = 1, inactiveValue = 0) {
  if (value === "all") return { sql: "1=1", args: [] };
  if (value === "inactive" || value === "inativo")
    return { sql: `${column}=?`, args: [inactiveValue] };
  return { sql: `${column}=?`, args: [activeValue] };
}
function ageOn(date) {
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
function validateStudent(payload) {
  const turma = db
    .prepare("SELECT id,nome,ativo FROM turmas WHERE id=?")
    .get(payload.turma_id);
  if (!turma) return "Selecione uma turma cadastrada";
  const schoolClass = /(^|\s)[1-9]\s*[º°ª]\s*[a-z]?($|\s)/i.test(turma.nome);
  const age = ageOn(payload.data_nascimento);
  const minor = age !== null && age < 18;
  if (payload.curso_id) {
    const course = db
      .prepare("SELECT id,nome,entidade_tipo,ativo FROM cursos WHERE id=?")
      .get(payload.curso_id);
    if (!course || !course.ativo) return "Selecione um curso ativo";
    if (course.entidade_tipo === "universidade" && (schoolClass || minor))
      return `${course.nome} é um curso superior e não pode ser vinculado a um aluno menor de 18 anos ou a uma turma escolar como ${turma.nome}`;
  }
  if ((minor || schoolClass) && !String(payload.responsavel || "").trim())
    return "Informe o nome do responsável para alunos menores de idade ou de turmas escolares";
  if (
    (minor || schoolClass) &&
    !String(
      payload.telefone_responsavel || payload.contato_responsavel || "",
    ).trim()
  )
    return "Informe o telefone do responsável para alunos menores de idade ou de turmas escolares";
  return null;
}
const userQuery =
  "SELECT u.*,p.nome AS perfil FROM usuarios u JOIN perfis p ON p.id=u.perfil_id";
app.get("/api/health", (_, res) =>
  res.json({ ok: true, service: "edusystem-api", database: "sqlite" }),
);
app.get("/api/configuracoes", auth, (req, res) => {
  const row = db
    .prepare("SELECT valor FROM configuracoes WHERE chave='instituicao'")
    .get();
  try {
    res.json(
      row
        ? JSON.parse(row.valor)
        : {
            tipo: "escola",
            nome: "Grupo Horizonte",
            descricao: "Gestão escolar",
            modulos: {},
          },
    );
  } catch {
    res.json({
      tipo: "escola",
      nome: "Grupo Horizonte",
      descricao: "Gestão escolar",
      modulos: {},
    });
  }
});
app.put(
  "/api/configuracoes",
  auth,
  allow("Diretor", "Coordenador"),
  (req, res) => {
    const {
      tipo = "escola",
      nome = "Grupo Horizonte",
      descricao = "",
      modulos = {},
    } = req.body;
    const tipos = [
      "escola",
      "ensino_medio",
      "creche",
      "cursinho",
      "faculdade",
      "universidade",
    ];
    if (!tipos.includes(tipo))
      return res.status(400).json({ message: "Tipo de instituição inválido" });
    const value = {
      tipo,
      nome: String(nome).trim() || "Minha instituição",
      descricao: String(descricao || "").trim(),
      modulos: modulos || {},
    };
    db.prepare(
      "INSERT INTO configuracoes(chave,valor,atualizado_em) VALUES('instituicao',?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,atualizado_em=CURRENT_TIMESTAMP",
    ).run(JSON.stringify(value));
    res.json(value);
  },
);
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const row = db
    .prepare(`${userQuery} WHERE u.email=? AND u.ativo=1 AND p.ativo=1`)
    .get(
      String(email || "")
        .trim()
        .toLowerCase(),
    );
  if (!row || !bcrypt.compareSync(password || "", row.senha_hash))
    return res.status(401).json({ message: "Credenciais inválidas" });
  res.json({ user: publicUser(row), token: tokenFor(row) });
});
app.post("/api/auth/register", (req, res) => {
  const { name, email, password, role = "Pais" } = req.body;
  if (!name || !email || !password)
    return res
      .status(400)
      .json({ message: "Nome, e-mail e senha são obrigatórios" });
  try {
    const p =
      db.prepare("SELECT id FROM perfis WHERE nome=? AND ativo=1").get(role) ||
      db.prepare("SELECT id FROM perfis WHERE nome='Pais' AND ativo=1").get();
    const id = db
      .prepare(
        "INSERT INTO usuarios(nome,email,senha_hash,perfil_id) VALUES(?,?,?,?)",
      )
      .run(
        name,
        email.toLowerCase(),
        bcrypt.hashSync(password, 10),
        p.id,
      ).lastInsertRowid;
    const row = db.prepare(`${userQuery} WHERE u.id=?`).get(id);
    res.status(201).json({ user: publicUser(row), token: tokenFor(row) });
  } catch {
    res.status(409).json({ message: "E-mail já cadastrado" });
  }
});
app.get("/api/me", auth, (req, res) => res.json(req.user));
app.get("/api/perfis", auth, (req, res) => {
  const status = statusClause(req.query.status, "ativo");
  res.json(
    db
      .prepare(
        `SELECT id,nome,descricao,ativo,(SELECT COUNT(*) FROM usuarios u WHERE u.perfil_id=perfis.id) total_usuarios FROM perfis WHERE ${status.sql} ORDER BY id`,
      )
      .all(...status.args),
  );
});
app.patch("/api/perfis/:id/status", auth, allow("Diretor"), (req, res) => {
  const ativo = req.body.ativo ? 1 : 0;
  const profile = db
    .prepare("SELECT * FROM perfis WHERE id=?")
    .get(req.params.id);
  if (!profile)
    return res.status(404).json({ message: "Perfil não encontrado" });
  if (!ativo) {
    const activeUsers = db
      .prepare(
        "SELECT COUNT(*) total FROM usuarios WHERE perfil_id=? AND ativo=1",
      )
      .get(req.params.id).total;
    if (activeUsers)
      return res.status(409).json({
        message: `Este perfil possui ${activeUsers} usuário(s) ativo(s). Desative ou mova esses usuários primeiro.`,
      });
  }
  db.prepare("UPDATE perfis SET ativo=? WHERE id=?").run(ativo, req.params.id);
  res.json({ ok: true, ativo });
});
app.get("/api/usuarios", auth, allow("Diretor", "Coordenador"), (req, res) => {
  const status = statusClause(req.query.status, "u.ativo");
  res.json(
    db
      .prepare(
        `SELECT u.id,u.nome,u.email,u.ativo,p.nome perfil,GROUP_CONCAT(DISTINCT e.nome) escolas,GROUP_CONCAT(DISTINCT a.nome) alunos_vinculados FROM usuarios u JOIN perfis p ON p.id=u.perfil_id LEFT JOIN usuario_escolas ue ON ue.usuario_id=u.id LEFT JOIN escolas e ON e.id=ue.escola_id LEFT JOIN usuario_alunos ua ON ua.usuario_id=u.id LEFT JOIN alunos a ON a.id=ua.aluno_id WHERE ${status.sql} GROUP BY u.id ORDER BY u.nome`,
      )
      .all(...status.args),
  );
});
app.post("/api/usuarios", auth, allow("Diretor"), (req, res) => {
  const {
    nome,
    email,
    senha,
    perfil = "Professor",
    escola_ids = [],
    aluno_ids = [],
  } = req.body;
  if (!nome?.trim() || !email?.trim() || String(senha || "").length < 6)
    return res.status(400).json({
      message:
        "Nome, e-mail e senha de pelo menos 6 caracteres são obrigatórios",
    });
  const role = db
    .prepare("SELECT id FROM perfis WHERE nome=? AND ativo=1")
    .get(perfil);
  if (!role) return res.status(400).json({ message: "Perfil inválido" });
  try {
    const id = db.transaction(() => {
      const newId = db
        .prepare(
          "INSERT INTO usuarios(nome,email,senha_hash,perfil_id) VALUES(?,?,?,?)",
        )
        .run(
          nome.trim(),
          email.trim().toLowerCase(),
          bcrypt.hashSync(senha, 10),
          role.id,
        ).lastInsertRowid;
      const schoolLink = db.prepare(
        "INSERT OR IGNORE INTO usuario_escolas(usuario_id,escola_id) VALUES(?,?)",
      );
      escola_ids.forEach((item) => schoolLink.run(newId, item));
      const studentLink = db.prepare(
        "INSERT OR IGNORE INTO usuario_alunos(usuario_id,aluno_id) VALUES(?,?)",
      );
      aluno_ids.forEach((item) => studentLink.run(newId, item));
      return newId;
    })();
    res.status(201).json({ id });
  } catch (error) {
    res.status(409).json({ message: "E-mail já cadastrado" });
  }
});
app.put("/api/usuarios/:id", auth, allow("Diretor"), (req, res) => {
  const { nome, email, perfil, ativo = 1, senha } = req.body;
  const role = db
    .prepare("SELECT id FROM perfis WHERE nome=? AND ativo=1")
    .get(perfil);
  if (!role || !nome?.trim() || !email?.trim())
    return res
      .status(400)
      .json({ message: "Nome, e-mail e perfil válidos são obrigatórios" });
  if (senha && String(senha).length < 6)
    return res
      .status(400)
      .json({ message: "A nova senha deve ter pelo menos 6 caracteres" });
  const args = [
    nome.trim(),
    email.trim().toLowerCase(),
    role.id,
    ativo ? 1 : 0,
  ];
  let sql = "UPDATE usuarios SET nome=?,email=?,perfil_id=?,ativo=?";
  if (senha) {
    sql += ",senha_hash=?";
    args.push(bcrypt.hashSync(senha, 10));
  }
  sql += " WHERE id=?";
  args.push(req.params.id);
  db.prepare(sql).run(...args);
  res.json({ ok: true });
});
app.put(
  "/api/usuarios/:id/vinculos",
  auth,
  allow("Diretor", "Coordenador"),
  (req, res) => {
    const { escola_ids = [], aluno_ids = [] } = req.body;
    db.transaction(() => {
      db.prepare("DELETE FROM usuario_escolas WHERE usuario_id=?").run(
        req.params.id,
      );
      db.prepare("DELETE FROM usuario_alunos WHERE usuario_id=?").run(
        req.params.id,
      );
      const schoolLink = db.prepare(
        "INSERT OR IGNORE INTO usuario_escolas(usuario_id,escola_id) VALUES(?,?)",
      );
      escola_ids.forEach((item) => schoolLink.run(req.params.id, item));
      const studentLink = db.prepare(
        "INSERT OR IGNORE INTO usuario_alunos(usuario_id,aluno_id) VALUES(?,?)",
      );
      aluno_ids.forEach((item) => studentLink.run(req.params.id, item));
    })();
    res.json({ ok: true });
  },
);
app.get("/api/turmas", auth, (req, res) => {
  const status = statusClause(req.query.status, "t.ativo");
  let where = status.sql;
  const args = [...status.args];
  const role = normalizeRole(req.user.role);
  if (role === "professor") {
    where += " AND t.professor_id=?";
    args.push(req.user.id);
  }
  if (role === "pais") {
    where +=
      " AND EXISTS(SELECT 1 FROM alunos pa JOIN usuario_alunos ua ON ua.aluno_id=pa.id WHERE pa.turma_id=t.id AND ua.usuario_id=?)";
    args.push(req.user.id);
  }
  res.json(
    db
      .prepare(
        `SELECT t.*,e.nome escola_nome,u.nome professor_nome,COUNT(a.id) total_alunos FROM turmas t LEFT JOIN alunos a ON a.turma_id=t.id LEFT JOIN escolas e ON e.id=t.escola_id LEFT JOIN usuarios u ON u.id=t.professor_id WHERE ${where} GROUP BY t.id ORDER BY t.ano_letivo DESC,t.nome`,
      )
      .all(...args),
  );
});
app.post("/api/turmas", auth, (req, res) => {
  const {
    nome,
    ano_letivo = 2026,
    serie = "",
    turno = "Manhã",
    sala = "",
    capacidade = 40,
    escola_id = null,
    professor_id = null,
  } = req.body;
  if (!String(nome || "").trim())
    return res.status(400).json({ message: "Nome da turma é obrigatório" });
  const id = db
    .prepare(
      "INSERT INTO turmas(nome,ano_letivo,serie,turno,sala,capacidade,escola_id,professor_id,escola) VALUES(?,?,?,?,?,?,?,?,?)",
    )
    .run(
      String(nome).trim(),
      Number(ano_letivo),
      serie,
      turno,
      sala,
      Number(capacidade) || 40,
      escola_id || null,
      professor_id || null,
      "Grupo Horizonte",
    ).lastInsertRowid;
  res.status(201).json(db.prepare("SELECT * FROM turmas WHERE id=?").get(id));
});
app.put("/api/turmas/:id", auth, (req, res) => {
  const {
    nome,
    ano_letivo,
    serie = "",
    turno = "Manhã",
    sala = "",
    capacidade = 40,
    escola_id = null,
    professor_id = null,
  } = req.body;
  if (!String(nome || "").trim())
    return res.status(400).json({ message: "Nome da turma é obrigatório" });
  const result = db
    .prepare(
      "UPDATE turmas SET nome=?,ano_letivo=?,serie=?,turno=?,sala=?,capacidade=?,escola_id=?,professor_id=? WHERE id=?",
    )
    .run(
      String(nome).trim(),
      Number(ano_letivo),
      serie,
      turno,
      sala,
      Number(capacidade) || 40,
      escola_id || null,
      professor_id || null,
      req.params.id,
    );
  if (!result.changes)
    return res.status(404).json({ message: "Turma não encontrada" });
  res.json(db.prepare("SELECT * FROM turmas WHERE id=?").get(req.params.id));
});
app.delete("/api/turmas/:id", auth, (req, res) => {
  const activeStudents = db
    .prepare(
      "SELECT COUNT(*) total FROM alunos WHERE turma_id=? AND status='Ativo'",
    )
    .get(req.params.id).total;
  if (activeStudents)
    return res.status(409).json({
      message: `A turma possui ${activeStudents} aluno(s) ativo(s). Mova ou inative os alunos antes de arquivar a turma.`,
    });
  const result = db
    .prepare("UPDATE turmas SET ativo=0 WHERE id=?")
    .run(req.params.id);
  if (!result.changes)
    return res.status(404).json({ message: "Turma não encontrada" });
  res.status(204).end();
});
app.patch("/api/turmas/:id/status", auth, (req, res) => {
  const ativo = req.body.ativo ? 1 : 0;
  const result = db
    .prepare("UPDATE turmas SET ativo=? WHERE id=?")
    .run(ativo, req.params.id);
  if (!result.changes)
    return res.status(404).json({ message: "Turma não encontrada" });
  res.json({ ok: true, ativo });
});
app.get("/api/materias", auth, (req, res) => {
  const status = statusClause(req.query.status, "ativo");
  res.json(
    db
      .prepare(`SELECT * FROM materias WHERE ${status.sql} ORDER BY nome`)
      .all(...status.args),
  );
});
app.post("/api/materias", auth, (req, res) => {
  const {
    nome,
    codigo = "",
    carga_horaria = null,
    etapa = "",
    descricao = "",
  } = req.body;
  if (!String(nome || "").trim())
    return res.status(400).json({ message: "Nome da matéria é obrigatório" });
  try {
    const id = db
      .prepare(
        "INSERT INTO materias(nome,codigo,carga_horaria,etapa,descricao) VALUES(?,?,?,?,?)",
      )
      .run(
        String(nome).trim(),
        codigo,
        Number(carga_horaria) || null,
        etapa,
        descricao,
      ).lastInsertRowid;
    res
      .status(201)
      .json(db.prepare("SELECT * FROM materias WHERE id=?").get(id));
  } catch (error) {
    res.status(409).json({ message: "Já existe uma matéria com este nome" });
  }
});
app.put("/api/materias/:id", auth, (req, res) => {
  const {
    nome,
    codigo = "",
    carga_horaria = null,
    etapa = "",
    descricao = "",
  } = req.body;
  if (!String(nome || "").trim())
    return res.status(400).json({ message: "Nome da matéria é obrigatório" });
  const result = db
    .prepare(
      "UPDATE materias SET nome=?,codigo=?,carga_horaria=?,etapa=?,descricao=? WHERE id=?",
    )
    .run(
      String(nome).trim(),
      codigo,
      Number(carga_horaria) || null,
      etapa,
      descricao,
      req.params.id,
    );
  if (!result.changes)
    return res.status(404).json({ message: "Matéria não encontrada" });
  res.json(db.prepare("SELECT * FROM materias WHERE id=?").get(req.params.id));
});
app.delete("/api/materias/:id", auth, (req, res) => {
  const result = db
    .prepare("UPDATE materias SET ativo=0 WHERE id=?")
    .run(req.params.id);
  if (!result.changes)
    return res.status(404).json({ message: "Matéria não encontrada" });
  res.status(204).end();
});
app.patch("/api/materias/:id/status", auth, (req, res) => {
  const ativo = req.body.ativo ? 1 : 0;
  const result = db
    .prepare("UPDATE materias SET ativo=? WHERE id=?")
    .run(ativo, req.params.id);
  if (!result.changes)
    return res.status(404).json({ message: "Matéria não encontrada" });
  res.json({ ok: true, ativo });
});
app.get("/api/cursos", auth, (req, res) => {
  const { entidade_tipo, entidade_id } = req.query;
  const status = statusClause(req.query.status, "c.ativo");
  let sql = `SELECT c.*,CASE WHEN c.entidade_tipo='escola' THEN e.nome ELSE u.nome END entidade_nome FROM cursos c LEFT JOIN escolas e ON c.entidade_tipo='escola' AND e.id=c.entidade_id LEFT JOIN universidades u ON c.entidade_tipo='universidade' AND u.id=c.entidade_id WHERE ${status.sql}`;
  const args = [...status.args];
  if (entidade_tipo) {
    sql += " AND c.entidade_tipo=?";
    args.push(entidade_tipo);
  }
  if (entidade_id) {
    sql += " AND c.entidade_id=?";
    args.push(entidade_id);
  }
  sql += " ORDER BY c.nome";
  res.json(db.prepare(sql).all(...args));
});
app.post("/api/cursos", auth, (req, res) => {
  const {
    nome,
    codigo = "",
    duracao = "",
    modalidade = "Presencial",
    entidade_tipo = "universidade",
    entidade_id = null,
    descricao = "",
  } = req.body;
  if (!String(nome || "").trim())
    return res.status(400).json({ message: "Nome do curso é obrigatório" });
  const id = db
    .prepare(
      "INSERT INTO cursos(nome,codigo,duracao,modalidade,entidade_tipo,entidade_id,descricao) VALUES(?,?,?,?,?,?,?)",
    )
    .run(
      String(nome).trim(),
      codigo,
      duracao,
      modalidade,
      entidade_tipo,
      entidade_id || null,
      descricao,
    ).lastInsertRowid;
  res.status(201).json(db.prepare("SELECT * FROM cursos WHERE id=?").get(id));
});
app.put("/api/cursos/:id", auth, (req, res) => {
  const {
    nome,
    codigo = "",
    duracao = "",
    modalidade = "Presencial",
    entidade_tipo = "universidade",
    entidade_id = null,
    descricao = "",
  } = req.body;
  if (!String(nome || "").trim())
    return res.status(400).json({ message: "Nome do curso é obrigatório" });
  const result = db
    .prepare(
      "UPDATE cursos SET nome=?,codigo=?,duracao=?,modalidade=?,entidade_tipo=?,entidade_id=?,descricao=? WHERE id=?",
    )
    .run(
      String(nome).trim(),
      codigo,
      duracao,
      modalidade,
      entidade_tipo,
      entidade_id || null,
      descricao,
      req.params.id,
    );
  if (!result.changes)
    return res.status(404).json({ message: "Curso não encontrado" });
  res.json(db.prepare("SELECT * FROM cursos WHERE id=?").get(req.params.id));
});
app.delete("/api/cursos/:id", auth, (req, res) => {
  const result = db
    .prepare("UPDATE cursos SET ativo=0 WHERE id=?")
    .run(req.params.id);
  if (!result.changes)
    return res.status(404).json({ message: "Curso não encontrado" });
  res.status(204).end();
});
app.patch("/api/cursos/:id/status", auth, (req, res) => {
  const ativo = req.body.ativo ? 1 : 0;
  const result = db
    .prepare("UPDATE cursos SET ativo=? WHERE id=?")
    .run(ativo, req.params.id);
  if (!result.changes)
    return res.status(404).json({ message: "Curso não encontrado" });
  res.json({ ok: true, ativo });
});
app.get("/api/alunos", auth, (req, res) => {
  const { turma_id, q, include_inativos } = req.query;
  const access = studentScope(req);
  const requested = include_inativos === "1" ? "all" : req.query.status;
  const status = statusClause(requested, "a.status", "Ativo", "Inativo");
  let sql =
    "SELECT a.*,t.nome turma,t.ativo turma_ativo,t.escola_id,e.nome escola_nome,c.nome curso_nome,c.entidade_tipo curso_tipo,ROUND(COALESCE((SELECT AVG(n.nota) FROM notas n WHERE n.aluno_id=a.id AND COALESCE(n.ativo,1)=1),0),1) media,ROUND(COALESCE((SELECT AVG(f.presente)*100 FROM frequencias f WHERE f.aluno_id=a.id),0),1) frequencia,(SELECT COUNT(*) FROM acompanhamentos ac WHERE ac.aluno_id=a.id) total_acompanhamentos FROM alunos a JOIN turmas t ON t.id=a.turma_id LEFT JOIN escolas e ON e.id=t.escola_id LEFT JOIN cursos c ON c.id=a.curso_id WHERE " +
    access.sql;
  const args = [...access.args];
  sql += ` AND ${status.sql}`;
  args.push(...status.args);
  if (turma_id) {
    sql += " AND a.turma_id=?";
    args.push(turma_id);
  }
  if (q) {
    sql += " AND(a.nome LIKE ? OR a.matricula LIKE ?)";
    args.push(`%${q}%`, `%${q}%`);
  }
  sql += " ORDER BY a.nome";
  res.json(db.prepare(sql).all(...args));
});
app.get("/api/alunos/:id", auth, (req, res) => {
  const access = studentScope(req);
  const aluno = db
    .prepare(
      "SELECT a.*,t.nome turma,e.nome escola_nome,c.nome curso_nome FROM alunos a JOIN turmas t ON t.id=a.turma_id LEFT JOIN escolas e ON e.id=t.escola_id LEFT JOIN cursos c ON c.id=a.curso_id WHERE a.id=? AND " +
        access.sql,
    )
    .get(req.params.id, ...access.args);
  if (!aluno) return res.status(404).json({ message: "Aluno não encontrado" });
  const acompanhamentos = db
    .prepare(
      "SELECT ac.*,u.nome autor FROM acompanhamentos ac LEFT JOIN usuarios u ON u.id=ac.autor_id WHERE ac.aluno_id=? ORDER BY ac.data DESC,ac.id DESC",
    )
    .all(req.params.id);
  res.json({ ...aluno, acompanhamentos });
});
app.post(
  "/api/alunos",
  auth,
  allow("Diretor", "Coordenador", "Professor", "Secretário"),
  (req, res) => {
    const {
      nome,
      matricula,
      turma_id,
      responsavel = "",
      contato_responsavel = "",
      telefone_responsavel = "",
      email_responsavel = "",
      data_nascimento = null,
      email = "",
      telefone = "",
      endereco = "",
      comportamento = 5,
      observacoes = "",
      curso_id = null,
    } = req.body;
    if (!nome?.trim() || !String(matricula || "").trim() || !turma_id)
      return res
        .status(400)
        .json({ message: "Nome, matrícula e turma são obrigatórios" });
    const validation = validateStudent({
      ...req.body,
      responsavel,
      contato_responsavel,
      telefone_responsavel,
      turma_id,
      curso_id,
      data_nascimento,
    });
    if (validation) return res.status(400).json({ message: validation });
    try {
      const id = db
        .prepare(
          "INSERT INTO alunos(nome,matricula,turma_id,responsavel,contato_responsavel,telefone_responsavel,email_responsavel,data_nascimento,email,telefone,endereco,comportamento,observacoes,curso_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          nome.trim(),
          String(matricula).trim(),
          turma_id,
          responsavel,
          telefone_responsavel || contato_responsavel,
          telefone_responsavel || contato_responsavel,
          email_responsavel,
          data_nascimento || null,
          email,
          telefone,
          endereco,
          Math.min(10, Math.max(1, Number(comportamento) || 5)),
          observacoes,
          curso_id || null,
        ).lastInsertRowid;
      res
        .status(201)
        .json(db.prepare("SELECT * FROM alunos WHERE id=?").get(id));
    } catch (e) {
      res.status(400).json({
        message: String(e.message).includes("UNIQUE")
          ? "Matrícula já cadastrada"
          : e.message,
      });
    }
  },
);
app.put(
  "/api/alunos/:id",
  auth,
  allow("Diretor", "Coordenador", "Professor", "Secretário"),
  (req, res) => {
    const {
      nome,
      matricula,
      turma_id,
      responsavel = "",
      contato_responsavel = "",
      telefone_responsavel = "",
      email_responsavel = "",
      data_nascimento = null,
      email = "",
      telefone = "",
      endereco = "",
      comportamento = 5,
      observacoes = "",
      curso_id = null,
    } = req.body;
    if (!nome?.trim() || !matricula || !turma_id)
      return res
        .status(400)
        .json({ message: "Nome, matrícula e turma são obrigatórios" });
    const validation = validateStudent({
      ...req.body,
      responsavel,
      contato_responsavel,
      telefone_responsavel,
      turma_id,
      curso_id,
      data_nascimento,
    });
    if (validation) return res.status(400).json({ message: validation });
    db.prepare(
      "UPDATE alunos SET nome=?,matricula=?,turma_id=?,responsavel=?,contato_responsavel=?,telefone_responsavel=?,email_responsavel=?,data_nascimento=?,email=?,telefone=?,endereco=?,comportamento=?,observacoes=?,curso_id=? WHERE id=?",
    ).run(
      nome.trim(),
      matricula,
      turma_id,
      responsavel,
      telefone_responsavel || contato_responsavel,
      telefone_responsavel || contato_responsavel,
      email_responsavel,
      data_nascimento || null,
      email,
      telefone,
      endereco,
      Math.min(10, Math.max(1, Number(comportamento) || 5)),
      observacoes,
      curso_id || null,
      req.params.id,
    );
    res.json(db.prepare("SELECT * FROM alunos WHERE id=?").get(req.params.id));
  },
);
app.post(
  "/api/alunos/importar",
  auth,
  allow("Diretor", "Coordenador", "Professor", "Secretário"),
  (req, res) => {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length)
      return res.status(400).json({ message: "A planilha não contém alunos" });
    const classes = db
      .prepare("SELECT id,nome FROM turmas WHERE ativo=1")
      .all();
    const insert = db.prepare(
      "INSERT INTO alunos(nome,matricula,turma_id,responsavel,contato_responsavel,telefone_responsavel,email_responsavel,data_nascimento,email,telefone,endereco,comportamento) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    );
    const failures = [];
    let imported = 0;
    db.transaction(() =>
      rows.forEach((row, index) => {
        const nome = String(row.nome || row.aluno || "").trim();
        const matricula = String(
          row.matricula || row["matrícula"] || "",
        ).trim();
        const turmaId =
          Number(row.turma_id) ||
          classes.find(
            (item) => normalizeRole(item.nome) === normalizeRole(row.turma),
          )?.id;
        if (!nome || !matricula || !turmaId) {
          failures.push({
            linha: index + 2,
            motivo: "Nome, matrícula ou turma ausente/inválida",
          });
          return;
        }
        const telefoneResponsavel = String(
          row.telefone_responsavel ||
            row.contato_responsavel ||
            row.contato ||
            "",
        ).trim();
        const responsavel = row.responsavel || row["responsável"] || "";
        const validation = validateStudent({
          turma_id: turmaId,
          responsavel,
          telefone_responsavel: telefoneResponsavel,
          data_nascimento: row.data_nascimento || null,
          curso_id: null,
        });
        if (validation) {
          failures.push({ linha: index + 2, motivo: validation });
          return;
        }
        try {
          insert.run(
            nome,
            matricula,
            turmaId,
            responsavel,
            telefoneResponsavel,
            telefoneResponsavel,
            row.email_responsavel || "",
            row.data_nascimento || null,
            row.email || "",
            row.telefone || "",
            row.endereco || row["endereço"] || "",
            Math.min(10, Math.max(1, Number(row.comportamento) || 5)),
          );
          imported++;
        } catch (error) {
          failures.push({
            linha: index + 2,
            motivo: String(error.message).includes("UNIQUE")
              ? "Matrícula duplicada"
              : error.message,
          });
        }
      }),
    )();
    res.json({ importados: imported, falhas: failures, total: rows.length });
  },
);
app.delete("/api/alunos/:id", auth, (req, res) => {
  db.prepare("UPDATE alunos SET status='Inativo' WHERE id=?").run(
    req.params.id,
  );
  res.status(204).end();
});
app.patch("/api/alunos/:id/status", auth, (req, res) => {
  const status = req.body.ativo ? "Ativo" : "Inativo";
  const result = db
    .prepare("UPDATE alunos SET status=? WHERE id=?")
    .run(status, req.params.id);
  if (!result.changes)
    return res.status(404).json({ message: "Aluno não encontrado" });
  res.json({ ok: true, status });
});
app.get("/api/alunos/:id/acompanhamentos", auth, (req, res) =>
  res.json(
    db
      .prepare(
        "SELECT ac.*,u.nome autor FROM acompanhamentos ac LEFT JOIN usuarios u ON u.id=ac.autor_id WHERE ac.aluno_id=? ORDER BY ac.data DESC,ac.id DESC",
      )
      .all(req.params.id),
  ),
);
app.post(
  "/api/alunos/:id/acompanhamentos",
  auth,
  allow("Diretor", "Coordenador", "Professor"),
  (req, res) => {
    const {
      data = new Date().toISOString().slice(0, 10),
      tipo = "Observação",
      titulo,
      descricao,
      comportamento = null,
    } = req.body;
    if (!titulo?.trim() || !descricao?.trim())
      return res
        .status(400)
        .json({ message: "Título e descrição são obrigatórios" });
    const value =
      comportamento === null || comportamento === ""
        ? null
        : Math.min(10, Math.max(1, Number(comportamento)));
    const id = db
      .prepare(
        "INSERT INTO acompanhamentos(aluno_id,data,tipo,titulo,descricao,comportamento,autor_id) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        req.params.id,
        data,
        tipo,
        titulo.trim(),
        descricao.trim(),
        value,
        req.user.id,
      ).lastInsertRowid;
    if (value)
      db.prepare("UPDATE alunos SET comportamento=? WHERE id=?").run(
        value,
        req.params.id,
      );
    res
      .status(201)
      .json(db.prepare("SELECT * FROM acompanhamentos WHERE id=?").get(id));
  },
);
app.delete(
  "/api/acompanhamentos/:id",
  auth,
  allow("Diretor", "Coordenador", "Professor"),
  (req, res) => {
    db.prepare("DELETE FROM acompanhamentos WHERE id=?").run(req.params.id);
    res.status(204).end();
  },
);
app.get("/api/notas", auth, (req, res) => {
  const { turma_id, bimestre, aluno_id, ano, disciplina } = req.query;
  const access = studentScope(req);
  const status = statusClause(req.query.status, "COALESCE(n.ativo,1)");
  let sql =
    "SELECT n.*,a.nome aluno,a.turma_id,t.nome turma FROM notas n JOIN alunos a ON a.id=n.aluno_id JOIN turmas t ON t.id=a.turma_id WHERE " +
    access.sql;
  const args = [...access.args];
  sql += ` AND ${status.sql}`;
  args.push(...status.args);
  if (turma_id) {
    sql += " AND a.turma_id=?";
    args.push(turma_id);
  }
  if (bimestre) {
    sql += " AND n.bimestre=?";
    args.push(bimestre);
  }
  if (aluno_id) {
    sql += " AND a.id=?";
    args.push(aluno_id);
  }
  if (ano) {
    sql += " AND n.ano=?";
    args.push(ano);
  }
  if (disciplina) {
    sql += " AND n.disciplina=?";
    args.push(disciplina);
  }
  sql += " ORDER BY a.nome,n.disciplina,n.ano,n.bimestre";
  res.json(db.prepare(sql).all(...args));
});
app.post(
  "/api/notas",
  auth,
  allow("Diretor", "Coordenador", "Professor"),
  (req, res) => {
    const {
      aluno_id,
      disciplina,
      bimestre,
      ano = 2026,
      nota,
      conceito,
    } = req.body;
    const subject = db
      .prepare("SELECT id FROM materias WHERE nome=? AND ativo=1")
      .get(disciplina);
    if (!subject)
      return res
        .status(400)
        .json({ message: "Selecione uma matéria cadastrada" });
    const row = db
      .prepare(
        "INSERT INTO notas(aluno_id,disciplina,bimestre,ano,nota,conceito,ativo) VALUES(?,?,?,?,?,?,1) ON CONFLICT(aluno_id,disciplina,bimestre,ano) DO UPDATE SET nota=excluded.nota,conceito=excluded.conceito,ativo=1",
      )
      .run(aluno_id, disciplina, bimestre, ano, nota, conceito);
    res.json({ id: row.lastInsertRowid });
  },
);
app.put(
  "/api/notas/:id",
  auth,
  allow("Diretor", "Coordenador", "Professor"),
  (req, res) => {
    const {
      aluno_id,
      disciplina,
      bimestre,
      ano,
      nota,
      conceito = null,
    } = req.body;
    if (
      !aluno_id ||
      !disciplina ||
      !bimestre ||
      !ano ||
      nota === "" ||
      Number(nota) < 0 ||
      Number(nota) > 10
    )
      return res.status(400).json({
        message: "Preencha aluno, matéria, período e uma nota entre 0 e 10",
      });
    db.prepare(
      "UPDATE notas SET aluno_id=?,disciplina=?,bimestre=?,ano=?,nota=?,conceito=?,ativo=1 WHERE id=?",
    ).run(
      aluno_id,
      disciplina,
      bimestre,
      ano,
      Number(nota),
      conceito,
      req.params.id,
    );
    res.json(db.prepare("SELECT * FROM notas WHERE id=?").get(req.params.id));
  },
);
app.delete(
  "/api/notas/:id",
  auth,
  allow("Diretor", "Coordenador", "Professor"),
  (req, res) => {
    db.prepare("UPDATE notas SET ativo=0 WHERE id=?").run(req.params.id);
    res.status(204).end();
  },
);
app.patch(
  "/api/notas/:id/status",
  auth,
  allow("Diretor", "Coordenador", "Professor"),
  (req, res) => {
    const ativo = req.body.ativo ? 1 : 0;
    const result = db
      .prepare("UPDATE notas SET ativo=? WHERE id=?")
      .run(ativo, req.params.id);
    if (!result.changes)
      return res.status(404).json({ message: "Nota não encontrada" });
    res.json({ ok: true, ativo });
  },
);
app.get("/api/frequencias", auth, (req, res) => {
  const { turma_id, data } = req.query;
  const access = studentScope(req);
  let sql =
    "SELECT a.id aluno_id,a.nome,a.matricula,a.turma_id,day.presente,ROUND(COALESCE(AVG(allf.presente)*100,0),1) frequencia,COUNT(allf.id) total_registros FROM alunos a LEFT JOIN frequencias allf ON allf.aluno_id=a.id LEFT JOIN frequencias day ON day.aluno_id=a.id AND day.data=? WHERE a.status='Ativo' AND " +
    access.sql;
  const args = [data || "", ...access.args];
  if (turma_id) {
    sql += " AND a.turma_id=?";
    args.push(turma_id);
  }
  sql += " GROUP BY a.id ORDER BY a.nome";
  res.json(db.prepare(sql).all(...args));
});
app.post(
  "/api/frequencias",
  auth,
  allow("Diretor", "Coordenador", "Professor", "Secretário"),
  (req, res) => {
    const { aluno_id, data, presente } = req.body;
    db.prepare(
      "INSERT INTO frequencias(aluno_id,data,presente) VALUES(?,?,?) ON CONFLICT(aluno_id,data) DO UPDATE SET presente=excluded.presente",
    ).run(aluno_id, data, Boolean(presente) ? 1 : 0);
    res.status(204).end();
  },
);
app.get("/api/escolas", auth, (req, res) => {
  const status = statusClause(req.query.status, "ativo");
  res.json(
    db
      .prepare(`SELECT * FROM escolas WHERE ${status.sql} ORDER BY nome`)
      .all(...status.args),
  );
});
app.post("/api/escolas", auth, (req, res) => {
  const {
    nome,
    endereco = "",
    telefone = "",
    email = "",
    codigo_inep = "",
    diretor = "",
    tipo = "Particular",
    cidade = "",
    estado = "",
    cep = "",
  } = req.body;
  if (!nome?.trim())
    return res.status(400).json({ message: "Nome da escola é obrigatório" });
  const id = db
    .prepare(
      "INSERT INTO escolas(nome,endereco,telefone,email,codigo_inep,diretor,tipo,cidade,estado,cep) VALUES(?,?,?,?,?,?,?,?,?,?)",
    )
    .run(
      nome.trim(),
      endereco,
      telefone,
      email,
      codigo_inep,
      diretor,
      tipo,
      cidade,
      estado,
      cep,
    ).lastInsertRowid;
  res.status(201).json(db.prepare("SELECT * FROM escolas WHERE id=?").get(id));
});
app.put("/api/escolas/:id", auth, (req, res) => {
  const {
    nome,
    endereco = "",
    telefone = "",
    email = "",
    codigo_inep = "",
    diretor = "",
    tipo = "Particular",
    cidade = "",
    estado = "",
    cep = "",
  } = req.body;
  if (!nome?.trim())
    return res.status(400).json({ message: "Nome da escola é obrigatório" });
  db.prepare(
    "UPDATE escolas SET nome=?,endereco=?,telefone=?,email=?,codigo_inep=?,diretor=?,tipo=?,cidade=?,estado=?,cep=? WHERE id=?",
  ).run(
    nome.trim(),
    endereco,
    telefone,
    email,
    codigo_inep,
    diretor,
    tipo,
    cidade,
    estado,
    cep,
    req.params.id,
  );
  res.json(db.prepare("SELECT * FROM escolas WHERE id=?").get(req.params.id));
});
app.delete("/api/escolas/:id", auth, (req, res) => {
  db.prepare("UPDATE escolas SET ativo=0 WHERE id=?").run(req.params.id);
  res.status(204).end();
});
app.patch("/api/escolas/:id/status", auth, (req, res) => {
  const ativo = req.body.ativo ? 1 : 0;
  const result = db
    .prepare("UPDATE escolas SET ativo=? WHERE id=?")
    .run(ativo, req.params.id);
  if (!result.changes)
    return res.status(404).json({ message: "Escola não encontrada" });
  res.json({ ok: true, ativo });
});
app.get("/api/universidades", auth, (req, res) => {
  const status = statusClause(req.query.status, "ativo");
  res.json(
    db
      .prepare(`SELECT * FROM universidades WHERE ${status.sql} ORDER BY nome`)
      .all(...status.args),
  );
});
app.post("/api/universidades", auth, (req, res) => {
  const {
    nome,
    endereco = "",
    cnpj = "",
    reitor = "",
    telefone = "",
    email = "",
    cidade = "",
    estado = "",
    cep = "",
    tipo = "Universidade",
  } = req.body;
  if (!nome?.trim())
    return res
      .status(400)
      .json({ message: "Nome da universidade é obrigatório" });
  const id = db
    .prepare(
      "INSERT INTO universidades(nome,endereco,cnpj,reitor,telefone,email,cidade,estado,cep,tipo) VALUES(?,?,?,?,?,?,?,?,?,?)",
    )
    .run(
      nome.trim(),
      endereco,
      cnpj,
      reitor,
      telefone,
      email,
      cidade,
      estado,
      cep,
      tipo,
    ).lastInsertRowid;
  res
    .status(201)
    .json(db.prepare("SELECT * FROM universidades WHERE id=?").get(id));
});
app.put("/api/universidades/:id", auth, (req, res) => {
  const {
    nome,
    endereco = "",
    cnpj = "",
    reitor = "",
    telefone = "",
    email = "",
    cidade = "",
    estado = "",
    cep = "",
    tipo = "Universidade",
  } = req.body;
  if (!nome?.trim())
    return res
      .status(400)
      .json({ message: "Nome da universidade é obrigatório" });
  db.prepare(
    "UPDATE universidades SET nome=?,endereco=?,cnpj=?,reitor=?,telefone=?,email=?,cidade=?,estado=?,cep=?,tipo=? WHERE id=?",
  ).run(
    nome.trim(),
    endereco,
    cnpj,
    reitor,
    telefone,
    email,
    cidade,
    estado,
    cep,
    tipo,
    req.params.id,
  );
  res.json(
    db.prepare("SELECT * FROM universidades WHERE id=?").get(req.params.id),
  );
});
app.delete("/api/universidades/:id", auth, (req, res) => {
  db.prepare("UPDATE universidades SET ativo=0 WHERE id=?").run(req.params.id);
  res.status(204).end();
});
app.patch("/api/universidades/:id/status", auth, (req, res) => {
  const ativo = req.body.ativo ? 1 : 0;
  const result = db
    .prepare("UPDATE universidades SET ativo=? WHERE id=?")
    .run(ativo, req.params.id);
  if (!result.changes)
    return res.status(404).json({ message: "Universidade não encontrada" });
  res.json({ ok: true, ativo });
});

app.get(
  "/api/transferencia/exportar",
  auth,
  allow("Diretor", "Coordenador"),
  (req, res) => {
    const turmaId = Number(req.query.turma_id) || null;
    const classWhere = turmaId ? "WHERE t.id=?" : "";
    const classArgs = turmaId ? [turmaId] : [];
    const turmas = db
      .prepare(
        `SELECT t.id,t.nome,t.ano_letivo,t.serie,t.turno,t.sala,t.capacidade,t.ativo,e.nome escola_nome
         FROM turmas t LEFT JOIN escolas e ON e.id=t.escola_id ${classWhere}
         ORDER BY t.ano_letivo,t.nome`,
      )
      .all(...classArgs);
    if (turmaId && !turmas.length)
      return res.status(404).json({ message: "Turma não encontrada" });
    const classIds = turmas.map((item) => item.id);
    const placeholders = classIds.map(() => "?").join(",");
    const alunos = classIds.length
      ? db
          .prepare(
            `SELECT id,nome,matricula,data_nascimento,responsavel,telefone_responsavel,email_responsavel,email,telefone,endereco,comportamento,observacoes,status,turma_id
             FROM alunos WHERE turma_id IN (${placeholders}) ORDER BY nome`,
          )
          .all(...classIds)
      : [];
    const studentIds = alunos.map((item) => item.id);
    const studentPlaceholders = studentIds.map(() => "?").join(",");
    const notas = studentIds.length
      ? db
          .prepare(
            `SELECT * FROM notas WHERE aluno_id IN (${studentPlaceholders})`,
          )
          .all(...studentIds)
      : [];
    const frequencias = studentIds.length
      ? db
          .prepare(
            `SELECT * FROM frequencias WHERE aluno_id IN (${studentPlaceholders})`,
          )
          .all(...studentIds)
      : [];
    const acompanhamentos = studentIds.length
      ? db
          .prepare(
            `SELECT id,aluno_id,data,tipo,titulo,descricao,comportamento,criado_em FROM acompanhamentos WHERE aluno_id IN (${studentPlaceholders})`,
          )
          .all(...studentIds)
      : [];
    const config = db
      .prepare("SELECT valor FROM configuracoes WHERE chave='instituicao'")
      .get();
    res.json({
      format: "edusystem-transfer",
      version: 1,
      created_at: new Date().toISOString(),
      source: config ? JSON.parse(config.valor) : {},
      scope: turmaId
        ? { type: "turma", turma_id: turmaId }
        : { type: "instituicao" },
      data: { turmas, alunos, notas, frequencias, acompanhamentos },
    });
  },
);

app.post(
  "/api/transferencia/importar",
  auth,
  allow("Diretor", "Coordenador", "Professor"),
  (req, res) => {
    const pack = req.body?.package || req.body;
    if (
      pack?.format !== "edusystem-transfer" ||
      pack?.version !== 1 ||
      !pack?.data
    )
      return res
        .status(400)
        .json({
          message:
            "Arquivo de transferência EduSystem inválido ou incompatível",
        });
    const role = normalizeRole(req.user.role);
    const counts = {
      turmas: 0,
      alunos: 0,
      notas: 0,
      frequencias: 0,
      acompanhamentos: 0,
    };
    try {
      db.transaction(() => {
        const classMap = new Map();
        for (const item of pack.data.turmas || []) {
          let local = db
            .prepare("SELECT id FROM turmas WHERE nome=? AND ano_letivo=?")
            .get(item.nome, item.ano_letivo);
          if (!local) {
            const id = db
              .prepare(
                "INSERT INTO turmas(nome,ano_letivo,serie,turno,sala,capacidade,professor_id,escola,ativo) VALUES(?,?,?,?,?,?,?,?,?)",
              )
              .run(
                item.nome,
                item.ano_letivo,
                item.serie || item.nome,
                item.turno || "Manhã",
                item.sala || "",
                item.capacidade || 40,
                role === "professor" ? req.user.id : null,
                item.escola_nome || "Instituição importada",
                item.ativo === 0 ? 0 : 1,
              ).lastInsertRowid;
            local = { id };
            counts.turmas++;
          } else if (role === "professor") {
            db.prepare("UPDATE turmas SET professor_id=? WHERE id=?").run(
              req.user.id,
              local.id,
            );
          }
          classMap.set(Number(item.id), Number(local.id));
        }
        const studentMap = new Map();
        for (const item of pack.data.alunos || []) {
          const turmaId = classMap.get(Number(item.turma_id));
          if (!turmaId) continue;
          let local = db
            .prepare("SELECT id FROM alunos WHERE matricula=?")
            .get(item.matricula);
          if (!local) {
            const id = db
              .prepare(
                `INSERT INTO alunos(nome,matricula,data_nascimento,responsavel,contato_responsavel,telefone_responsavel,email_responsavel,email,telefone,endereco,comportamento,observacoes,status,turma_id)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
              )
              .run(
                item.nome,
                item.matricula,
                item.data_nascimento || null,
                item.responsavel || "",
                item.telefone_responsavel || "",
                item.telefone_responsavel || "",
                item.email_responsavel || "",
                item.email || "",
                item.telefone || "",
                item.endereco || "",
                item.comportamento || 5,
                item.observacoes || "",
                item.status === "Inativo" ? "Inativo" : "Ativo",
                turmaId,
              ).lastInsertRowid;
            local = { id };
            counts.alunos++;
          }
          studentMap.set(Number(item.id), Number(local.id));
        }
        for (const item of pack.data.notas || []) {
          const alunoId = studentMap.get(Number(item.aluno_id));
          if (!alunoId) continue;
          db.prepare(
            `INSERT INTO notas(aluno_id,disciplina,bimestre,ano,nota,conceito,ativo) VALUES(?,?,?,?,?,?,?)
             ON CONFLICT(aluno_id,disciplina,bimestre,ano) DO UPDATE SET nota=excluded.nota,conceito=excluded.conceito,ativo=excluded.ativo`,
          ).run(
            alunoId,
            item.disciplina,
            item.bimestre,
            item.ano,
            item.nota,
            item.conceito,
            item.ativo === 0 ? 0 : 1,
          );
          counts.notas++;
        }
        for (const item of pack.data.frequencias || []) {
          const alunoId = studentMap.get(Number(item.aluno_id));
          if (!alunoId) continue;
          db.prepare(
            "INSERT INTO frequencias(aluno_id,data,presente) VALUES(?,?,?) ON CONFLICT(aluno_id,data) DO UPDATE SET presente=excluded.presente",
          ).run(alunoId, item.data, item.presente ? 1 : 0);
          counts.frequencias++;
        }
        for (const item of pack.data.acompanhamentos || []) {
          const alunoId = studentMap.get(Number(item.aluno_id));
          if (!alunoId) continue;
          const exists = db
            .prepare(
              "SELECT id FROM acompanhamentos WHERE aluno_id=? AND data=? AND tipo=? AND titulo=? AND descricao=?",
            )
            .get(alunoId, item.data, item.tipo, item.titulo, item.descricao);
          if (exists) continue;
          db.prepare(
            "INSERT INTO acompanhamentos(aluno_id,data,tipo,titulo,descricao,comportamento,autor_id) VALUES(?,?,?,?,?,?,?)",
          ).run(
            alunoId,
            item.data,
            item.tipo,
            item.titulo,
            item.descricao,
            item.comportamento,
            req.user.id,
          );
          counts.acompanhamentos++;
        }
        db.prepare(
          "INSERT INTO auditoria(entidade,entidade_id,acao,dados_json) VALUES('transferencia',?,'pacote_importado',?)",
        ).run(
          req.user.id,
          JSON.stringify({
            created_at: pack.created_at,
            source: pack.source,
            counts,
          }),
        );
      })();
      res.json({ ok: true, ...counts });
    } catch (error) {
      res
        .status(400)
        .json({ message: `Falha ao importar pacote: ${error.message}` });
    }
  },
);
app.get("/api/quadros", auth, (req, res) =>
  res.json(
    db
      .prepare("SELECT * FROM quadros WHERE usuario_id=? ORDER BY pasta,nome")
      .all(req.user.id),
  ),
);
app.get("/api/quadros/:id", auth, (req, res) => {
  const row = db
    .prepare("SELECT * FROM quadros WHERE id=? AND usuario_id=?")
    .get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ message: "Quadro não encontrado" });
  res.json(row);
});
app.post("/api/quadros", auth, (req, res) => {
  const {
    id,
    nome = "Quadro principal",
    pasta = "Geral",
    dados_json,
  } = req.body;
  if (!dados_json)
    return res.status(400).json({ message: "Estado do quadro é obrigatório" });
  let rowId = id
    ? db
        .prepare("SELECT id FROM quadros WHERE id=? AND usuario_id=?")
        .get(id, req.user.id)?.id
    : null;
  if (rowId) {
    db.prepare(
      "UPDATE quadros SET nome=?,pasta=?,dados_json=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=?",
    ).run(
      String(nome).trim() || "Quadro principal",
      String(pasta).trim() || "Geral",
      dados_json,
      rowId,
    );
  } else {
    rowId = db
      .prepare(
        "INSERT INTO quadros(nome,pasta,usuario_id,dados_json) VALUES(?,?,?,?)",
      )
      .run(
        String(nome).trim() || "Quadro principal",
        String(pasta).trim() || "Geral",
        req.user.id,
        dados_json,
      ).lastInsertRowid;
  }
  res.json(db.prepare("SELECT * FROM quadros WHERE id=?").get(rowId));
});
app.get("/api/relatorios/aluno/:id", auth, reportAluno);
app.get("/api/relatorios/turma/:id", auth, reportTurma);
app.get("/api/dashboard", auth, dashboardHandler);
app.listen(PORT, () =>
  console.log(`EduSystem API em http://localhost:${PORT}`),
);

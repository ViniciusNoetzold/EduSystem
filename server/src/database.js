import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir =
  process.env.EDUSYSTEM_DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "database.sqlite"));
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS perfis (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL UNIQUE,descricao TEXT,ativo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,usuario TEXT UNIQUE COLLATE NOCASE,email TEXT NOT NULL UNIQUE COLLATE NOCASE,senha_hash TEXT NOT NULL,perfil_id INTEGER NOT NULL,ativo INTEGER NOT NULL DEFAULT 1,criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(perfil_id) REFERENCES perfis(id));
CREATE TABLE IF NOT EXISTS turmas (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,ano_letivo INTEGER NOT NULL,escola TEXT NOT NULL DEFAULT 'Grupo Horizonte',professor_id INTEGER,FOREIGN KEY(professor_id) REFERENCES usuarios(id));
CREATE TABLE IF NOT EXISTS alunos (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,matricula TEXT NOT NULL UNIQUE,data_nascimento TEXT,responsavel TEXT,contato_responsavel TEXT,turma_id INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'Ativo',criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(turma_id) REFERENCES turmas(id));
CREATE TABLE IF NOT EXISTS notas (id INTEGER PRIMARY KEY AUTOINCREMENT,aluno_id INTEGER NOT NULL,disciplina TEXT NOT NULL,bimestre INTEGER NOT NULL CHECK(bimestre BETWEEN 1 AND 4),ano INTEGER NOT NULL,nota REAL CHECK(nota BETWEEN 0 AND 10),conceito TEXT,UNIQUE(aluno_id,disciplina,bimestre,ano),FOREIGN KEY(aluno_id) REFERENCES alunos(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS frequencias (id INTEGER PRIMARY KEY AUTOINCREMENT,aluno_id INTEGER NOT NULL,data TEXT NOT NULL,presente INTEGER NOT NULL DEFAULT 1 CHECK(presente IN(0,1)),UNIQUE(aluno_id,data),FOREIGN KEY(aluno_id) REFERENCES alunos(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS escolas (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,endereco TEXT,telefone TEXT,email TEXT,criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS universidades (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,endereco TEXT,criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS materias (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL UNIQUE,codigo TEXT,carga_horaria INTEGER,etapa TEXT,descricao TEXT,ativo INTEGER NOT NULL DEFAULT 1,criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS cursos (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,codigo TEXT,duracao TEXT,modalidade TEXT,entidade_tipo TEXT NOT NULL DEFAULT 'universidade',entidade_id INTEGER,descricao TEXT,ativo INTEGER NOT NULL DEFAULT 1,criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY,valor TEXT NOT NULL,atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS quadros (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL DEFAULT 'Quadro principal',usuario_id INTEGER NOT NULL,dados_json TEXT NOT NULL,atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(usuario_id) REFERENCES usuarios(id));
CREATE TABLE IF NOT EXISTS acompanhamentos (id INTEGER PRIMARY KEY AUTOINCREMENT,aluno_id INTEGER NOT NULL,data TEXT NOT NULL,tipo TEXT NOT NULL DEFAULT 'Observação',titulo TEXT NOT NULL,descricao TEXT NOT NULL,comportamento INTEGER CHECK(comportamento BETWEEN 1 AND 10),autor_id INTEGER,criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,FOREIGN KEY(autor_id) REFERENCES usuarios(id));
CREATE TABLE IF NOT EXISTS usuario_escolas (usuario_id INTEGER NOT NULL,escola_id INTEGER NOT NULL,PRIMARY KEY(usuario_id,escola_id),FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,FOREIGN KEY(escola_id) REFERENCES escolas(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS usuario_alunos (usuario_id INTEGER NOT NULL,aluno_id INTEGER NOT NULL,PRIMARY KEY(usuario_id,aluno_id),FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,FOREIGN KEY(aluno_id) REFERENCES alunos(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS auditoria (id INTEGER PRIMARY KEY AUTOINCREMENT,entidade TEXT NOT NULL,entidade_id INTEGER,acao TEXT NOT NULL,dados_json TEXT,criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS preferencias_usuario (usuario_id INTEGER NOT NULL,chave TEXT NOT NULL,valor TEXT NOT NULL,atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(usuario_id,chave),FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE);
`);

const ensureColumn = (table, column, definition) => {
  if (
    !db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .some((item) => item.name === column)
  )
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};
for (const [column, definition] of [
  ["serie", "TEXT"],
  ["turno", "TEXT DEFAULT 'Manhã'"],
  ["sala", "TEXT"],
  ["capacidade", "INTEGER DEFAULT 40"],
  ["escola_id", "INTEGER"],
  ["ativo", "INTEGER NOT NULL DEFAULT 1"],
])
  ensureColumn("turmas", column, definition);
for (const [column, definition] of [
  ["codigo_inep", "TEXT"],
  ["diretor", "TEXT"],
  ["tipo", "TEXT DEFAULT 'Particular'"],
  ["cidade", "TEXT"],
  ["estado", "TEXT"],
  ["cep", "TEXT"],
  ["ativo", "INTEGER NOT NULL DEFAULT 1"],
])
  ensureColumn("escolas", column, definition);
for (const [column, definition] of [
  ["cnpj", "TEXT"],
  ["reitor", "TEXT"],
  ["telefone", "TEXT"],
  ["email", "TEXT"],
  ["cidade", "TEXT"],
  ["estado", "TEXT"],
  ["cep", "TEXT"],
  ["tipo", "TEXT DEFAULT 'Universidade'"],
  ["ativo", "INTEGER NOT NULL DEFAULT 1"],
])
  ensureColumn("universidades", column, definition);
for (const [column, definition] of [
  ["email", "TEXT"],
  ["telefone", "TEXT"],
  ["endereco", "TEXT"],
  ["comportamento", "INTEGER NOT NULL DEFAULT 5"],
  ["observacoes", "TEXT"],
  ["curso_id", "INTEGER"],
  ["telefone_responsavel", "TEXT"],
  ["email_responsavel", "TEXT"],
])
  ensureColumn("alunos", column, definition);
ensureColumn("notas", "criado_em", "TEXT");
ensureColumn("notas", "ativo", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("perfis", "ativo", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("usuarios", "usuario", "TEXT");
for (const row of db
  .prepare("SELECT id,email FROM usuarios WHERE usuario IS NULL OR TRIM(usuario)='' ORDER BY id")
  .all()) {
  const localPart = String(row.email || "usuario")
    .split("@")[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase() || "usuario";
  let candidate = localPart;
  let suffix = 1;
  while (db.prepare("SELECT 1 FROM usuarios WHERE usuario=? AND id<>?").get(candidate, row.id)) {
    suffix += 1;
    candidate = `${localPart}${suffix}`;
  }
  db.prepare("UPDATE usuarios SET usuario=? WHERE id=?").run(candidate, row.id);
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS usuarios_usuario_unique ON usuarios(usuario COLLATE NOCASE)");
db.prepare(
  "UPDATE notas SET criado_em=COALESCE(criado_em,CURRENT_TIMESTAMP)",
).run();
db.prepare("UPDATE notas SET ativo=COALESCE(ativo,1)").run();
db.prepare("UPDATE perfis SET ativo=COALESCE(ativo,1)").run();
db.prepare(
  `UPDATE alunos SET
  email_responsavel=CASE WHEN COALESCE(email_responsavel,'')='' AND contato_responsavel LIKE '%@%' THEN contato_responsavel ELSE email_responsavel END,
  telefone_responsavel=CASE WHEN COALESCE(telefone_responsavel,'')='' AND COALESCE(contato_responsavel,'')<>'' AND contato_responsavel NOT LIKE '%@%' THEN contato_responsavel ELSE telefone_responsavel END
`,
).run();
try {
  db.exec("ALTER TABLE quadros ADD COLUMN pasta TEXT NOT NULL DEFAULT 'Geral'");
} catch (error) {
  if (!String(error.message).includes("duplicate column")) throw error;
}

const insertPerfil = db.prepare(
  "INSERT OR IGNORE INTO perfis(nome,descricao) VALUES(?,?)",
);
for (const profile of [
  ["Diretor", "Acesso completo"],
  ["Coordenador", "Gestão pedagógica"],
  ["Professor", "Turmas e alunos vinculados"],
  ["Secretário", "Cadastros e relatórios"],
  ["Pais", "Acompanhamento do aluno"],
])
  insertPerfil.run(...profile);

// A edição distribuída cria somente o esquema. Dados demonstrativos são
// opcionais para desenvolvimento e nunca entram no primeiro uso do professor.
if (process.env.EDUSYSTEM_SEED_DEMO === "1") {
db.transaction(() => {
  let diretor = db
    .prepare("SELECT id FROM usuarios WHERE email=?")
    .get("diretora@escola.com");
  if (!diretor) {
    const perfil = db
      .prepare("SELECT id FROM perfis WHERE nome='Diretor'")
      .get();
    diretor = {
      id: db
        .prepare(
          "INSERT INTO usuarios(nome,email,senha_hash,perfil_id) VALUES(?,?,?,?)",
        )
        .run(
          "Marina Alves",
          "diretora@escola.com",
          bcrypt.hashSync("123456", 10),
          perfil.id,
        ).lastInsertRowid,
    };
  }
  let professor = db
    .prepare("SELECT id FROM usuarios WHERE email=?")
    .get("professor@escola.com");
  if (!professor) {
    const perfil = db
      .prepare("SELECT id FROM perfis WHERE nome='Professor'")
      .get();
    professor = {
      id: db
        .prepare(
          "INSERT INTO usuarios(nome,email,senha_hash,perfil_id) VALUES(?,?,?,?)",
        )
        .run(
          "Rafael Costa",
          "professor@escola.com",
          bcrypt.hashSync("123456", 10),
          perfil.id,
        ).lastInsertRowid,
    };
  }
  if (db.prepare("SELECT COUNT(*) total FROM turmas").get().total === 0) {
    const insert = db.prepare(
      "INSERT INTO turmas(nome,ano_letivo,escola,professor_id) VALUES(?,?,?,?)",
    );
    ["9º A", "8º B", "7º C"].forEach((nome) =>
      insert.run(nome, 2026, "Grupo Horizonte", professor.id),
    );
  }
  if (db.prepare("SELECT COUNT(*) total FROM escolas").get().total === 0) {
    const insert = db.prepare(
      "INSERT INTO escolas(nome,endereco,telefone,email) VALUES(?,?,?,?)",
    );
    insert.run(
      "Grupo Horizonte",
      "Av. das Acácias, 120",
      "(11) 3000-1000",
      "contato@horizonte.edu.br",
    );
    insert.run(
      "Unidade Norte",
      "Rua Aurora, 40",
      "(11) 3000-2000",
      "norte@horizonte.edu.br",
    );
  }
  if (
    db.prepare("SELECT COUNT(*) total FROM universidades").get().total === 0
  ) {
    const insert = db.prepare(
      "INSERT INTO universidades(nome,endereco) VALUES(?,?)",
    );
    insert.run("Universidade Federal", "Campus Central");
    insert.run("Faculdade Horizonte", "Av. do Conhecimento, 80");
  }
  if (db.prepare("SELECT COUNT(*) total FROM materias").get().total === 0) {
    const insert = db.prepare(
      "INSERT INTO materias(nome,codigo,carga_horaria,etapa,descricao) VALUES(?,?,?,?,?)",
    );
    [
      [
        "Matemática",
        "MAT-001",
        160,
        "Ensino Fundamental",
        "Raciocínio lógico e resolução de problemas",
      ],
      [
        "Português",
        "POR-001",
        160,
        "Ensino Fundamental",
        "Leitura, escrita e produção textual",
      ],
      [
        "Ciências",
        "CIE-001",
        120,
        "Ensino Fundamental",
        "Investigação científica e meio ambiente",
      ],
      [
        "História",
        "HIS-001",
        80,
        "Ensino Fundamental",
        "Sociedade, cultura e cidadania",
      ],
      [
        "Geografia",
        "GEO-001",
        80,
        "Ensino Fundamental",
        "Território, espaço e sociedade",
      ],
    ].forEach((row) => insert.run(...row));
  }
  if (db.prepare("SELECT COUNT(*) total FROM cursos").get().total === 0) {
    const universidade = db
      .prepare("SELECT id FROM universidades ORDER BY id LIMIT 1")
      .get();
    const insert = db.prepare(
      "INSERT INTO cursos(nome,codigo,duracao,modalidade,entidade_tipo,entidade_id,descricao) VALUES(?,?,?,?,?,?,?)",
    );
    insert.run(
      "Pedagogia",
      "PED-001",
      "4 anos",
      "Presencial",
      "universidade",
      universidade?.id || null,
      "Formação de profissionais da educação",
    );
    insert.run(
      "Administração",
      "ADM-001",
      "4 anos",
      "Híbrido",
      "universidade",
      universidade?.id || null,
      "Gestão, negócios e empreendedorismo",
    );
  }
  db.prepare(
    "INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES('instituicao',?)",
  ).run(
    JSON.stringify({
      tipo: "escola",
      nome: "Grupo Horizonte",
      descricao: "Gestão escolar",
      modulos: {},
    }),
  );
  db.prepare(
    "UPDATE turmas SET serie=COALESCE(serie,nome),turno=COALESCE(turno,'Manhã'),capacidade=COALESCE(capacidade,40),ativo=COALESCE(ativo,1)",
  ).run();
  if (db.prepare("SELECT COUNT(*) total FROM alunos").get().total === 0) {
    const turmas = db.prepare("SELECT id FROM turmas ORDER BY id").all();
    const insert = db.prepare(
      "INSERT INTO alunos(nome,matricula,responsavel,contato_responsavel,turma_id) VALUES(?,?,?,?,?)",
    );
    const data = [
      ["Ana Clara Souza", "2026-001", "Paula Souza", "paula@example.com"],
      ["Bruno Martins", "2026-002", "Carlos Martins", "carlos@example.com"],
      ["Camila Oliveira", "2026-003", "Joana Oliveira", "joana@example.com"],
      ["Diego Lima", "2026-004", "Marta Lima", "marta@example.com"],
      ["Elisa Rocha", "2026-005", "Lucia Rocha", "lucia@example.com"],
      ["Felipe Costa", "2026-006", "Marcos Costa", "marcos@example.com"],
    ];
    data.forEach((a, i) => insert.run(...a, turmas[i % turmas.length].id));
    const insertNota = db.prepare(
      "INSERT INTO notas(aluno_id,disciplina,bimestre,ano,nota) VALUES(?,?,?,?,?)",
    );
    const insertFreq = db.prepare(
      "INSERT INTO frequencias(aluno_id,data,presente) VALUES(?,?,?)",
    );
    for (const [idx, a] of db
      .prepare("SELECT id FROM alunos")
      .all()
      .entries()) {
      for (const d of ["Matemática", "Português", "Ciências"])
        for (let b = 1; b <= 3; b++)
          insertNota.run(
            a.id,
            d,
            b,
            2026,
            Math.min(10, 6.5 + idx * 0.25 + b * 0.25),
          );
      for (let day = 1; day <= 20; day++)
        insertFreq.run(
          a.id,
          `2026-08-${String(day).padStart(2, "0")}`,
          day % ((idx % 3) + 5) !== 0 ? 1 : 0,
        );
    }
  }
})();
}

// Corrige vínculos legados impossíveis sem apagar o histórico: o vínculo anterior
// fica registrado em auditoria e pode ser consultado em uma migração futura.
db.transaction(() => {
  const candidates = db
    .prepare(
      `SELECT a.id,a.nome,a.curso_id,t.nome turma,c.nome curso,c.entidade_tipo
       FROM alunos a
       JOIN turmas t ON t.id=a.turma_id
       JOIN cursos c ON c.id=a.curso_id
       WHERE c.entidade_tipo='universidade'`,
    )
    .all();
  const schoolClass = /(^|\s)[1-9]\s*[º°ª]\s*[a-z]?($|\s)/i;
  const audit = db.prepare(
    "INSERT INTO auditoria(entidade,entidade_id,acao,dados_json) VALUES('aluno',?,'curso_incompativel_removido',?)",
  );
  const unlink = db.prepare("UPDATE alunos SET curso_id=NULL WHERE id=?");
  for (const row of candidates) {
    if (!schoolClass.test(row.turma)) continue;
    audit.run(
      row.id,
      JSON.stringify({
        aluno: row.nome,
        turma: row.turma,
        curso_id: row.curso_id,
        curso: row.curso,
        motivo: "Turma escolar incompatível com curso de ensino superior",
      }),
    );
    unlink.run(row.id);
  }
})();

export default db;

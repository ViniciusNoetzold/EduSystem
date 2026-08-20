import db from './database.js'

const number = value => Number(value || 0)
const currentYear = () => new Date().getFullYear()

function context(req) {
  const scope = String(req.query.scope || 'geral')
  const id = req.query.id ? Number(req.query.id) : null
  const year = Number(req.query.ano || currentYear())
  const period = ['bimestre', 'semestre', 'mes', 'ano', 'anos'].includes(req.query.periodo) ? req.query.periodo : 'bimestre'
  const filters = ["a.status='Ativo'", 't.ativo=1']
  const args = []
  const role = String(req.user?.role||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  if (role === 'professor') { filters.push('t.professor_id=?'); args.push(req.user.id) }
  if (role === 'pais') { filters.push('EXISTS(SELECT 1 FROM usuario_alunos dashboard_access WHERE dashboard_access.aluno_id=a.id AND dashboard_access.usuario_id=?)'); args.push(req.user.id) }
  const accessWhere = filters.join(' AND ')
  const accessArgs = [...args]
  if (scope === 'aluno' && id) { filters.push('a.id=?'); args.push(id) }
  if (scope === 'turma' && id) { filters.push('t.id=?'); args.push(id) }
  if (scope === 'escola' && id) { filters.push('t.escola_id=?'); args.push(id) }
  if (scope === 'curso' && id) { filters.push('a.curso_id=?'); args.push(id) }
  if (scope === 'universidade' && id) { filters.push("EXISTS(SELECT 1 FROM cursos scope_c WHERE scope_c.id=a.curso_id AND scope_c.entidade_tipo='universidade' AND scope_c.entidade_id=?)"); args.push(id) }
  if (scope === 'materia' && req.query.nome) { filters.push('EXISTS(SELECT 1 FROM notas scope_n WHERE scope_n.aluno_id=a.id AND scope_n.disciplina=?)'); args.push(String(req.query.nome)) }
  return { scope, id, year, period, where: filters.join(' AND '), args, accessWhere, accessArgs }
}

function evolutionQuery(ctx) {
  const yearFilter = ctx.period === 'anos' ? '' : ' AND n.ano=?'
  const args = [...ctx.args, ...(ctx.period === 'anos' ? [] : [ctx.year])]
  const definitions = {
    bimestre: { key: 'n.bimestre', label: value => `${value}º bim` },
    semestre: { key: 'CAST((n.bimestre+1)/2 AS INTEGER)', label: value => `${value}º semestre` },
    mes: { key: "CAST(strftime('%m',COALESCE(n.criado_em,CURRENT_TIMESTAMP)) AS INTEGER)", label: value => new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(2026,Number(value)-1,1)).replace('.','') },
    ano: { key: 'n.ano', label: value => String(value) },
    anos: { key: 'n.ano', label: value => String(value) }
  }
  const definition = definitions[ctx.period]
  const rows = db.prepare(`SELECT ${definition.key} period_key,ROUND(AVG(n.nota),1) media,COUNT(n.id) lancamentos FROM notas n JOIN alunos a ON a.id=n.aluno_id JOIN turmas t ON t.id=a.turma_id WHERE ${ctx.where}${yearFilter} AND n.nota IS NOT NULL GROUP BY period_key ORDER BY period_key`).all(...args)
  return rows.map(row => ({ ...row, name: definition.label(row.period_key) }))
}

export function dashboardHandler(req, res) {
  const ctx = context(req)
  const from = 'FROM alunos a JOIN turmas t ON t.id=a.turma_id'
  const noteYear = ctx.period === 'anos' ? '' : ' AND n.ano=?'
  const noteArgs = [...ctx.args, ...(ctx.period === 'anos' ? [] : [ctx.year])]
  const frequencyYear = ctx.period === 'anos' ? '' : " AND substr(f.data,1,4)=?"
  const frequencyArgs = [...ctx.args, ...(ctx.period === 'anos' ? [] : [String(ctx.year)])]
  const total = db.prepare(`SELECT COUNT(DISTINCT a.id) total ${from} WHERE ${ctx.where}`).get(...ctx.args).total
  const media = db.prepare(`SELECT ROUND(COALESCE(AVG(n.nota),0),1) valor FROM notas n JOIN alunos a ON a.id=n.aluno_id JOIN turmas t ON t.id=a.turma_id WHERE ${ctx.where}${noteYear} AND n.nota IS NOT NULL`).get(...noteArgs).valor
  const frequencia = db.prepare(`SELECT ROUND(COALESCE(AVG(f.presente)*100,0),1) valor FROM frequencias f JOIN alunos a ON a.id=f.aluno_id JOIN turmas t ON t.id=a.turma_id WHERE ${ctx.where}${frequencyYear}`).get(...frequencyArgs).valor
  const maior = db.prepare(`SELECT a.nome,ROUND(AVG(f.presente)*100,1) valor FROM frequencias f JOIN alunos a ON a.id=f.aluno_id JOIN turmas t ON t.id=a.turma_id WHERE ${ctx.where}${frequencyYear} GROUP BY a.id ORDER BY valor DESC,a.nome LIMIT 1`).get(...frequencyArgs) || { nome: '-', valor: 0 }
  const evolution = evolutionQuery(ctx)

  let groups
  if (ctx.scope === 'aluno' && ctx.id) {
    const frequencySub = ctx.period === 'anos' ? '' : " AND substr(f.data,1,4)=?"
    const args = ctx.period === 'anos' ? [...ctx.args] : [String(ctx.year),...ctx.args,ctx.year]
    groups = db.prepare(`SELECT n.disciplina name,1 alunos,ROUND(AVG(n.nota),1) media,ROUND(COALESCE((SELECT AVG(f.presente)*100 FROM frequencias f WHERE f.aluno_id=a.id${frequencySub}),0),1) frequencia FROM notas n JOIN alunos a ON a.id=n.aluno_id JOIN turmas t ON t.id=a.turma_id WHERE ${ctx.where}${noteYear} GROUP BY n.disciplina ORDER BY n.disciplina`).all(...args)
  } else {
    const noteFilter = ctx.period === 'anos' ? '' : ` AND gn.ano=${ctx.year}`
    const attendanceFilter = ctx.period === 'anos' ? '' : ` AND substr(gf.data,1,4)='${ctx.year}'`
    groups = db.prepare(`SELECT t.nome name,COUNT(DISTINCT a.id) alunos,
      ROUND(COALESCE((SELECT AVG(gn.nota) FROM notas gn JOIN alunos ga ON ga.id=gn.aluno_id WHERE ga.turma_id=t.id${noteFilter}),0),1) media,
      ROUND(COALESCE((SELECT AVG(gf.presente)*100 FROM frequencias gf JOIN alunos gfa ON gfa.id=gf.aluno_id WHERE gfa.turma_id=t.id${attendanceFilter}),0),1) frequencia
      FROM alunos a JOIN turmas t ON t.id=a.turma_id WHERE ${ctx.where} GROUP BY t.id ORDER BY t.nome`).all(...ctx.args)
  }

  const filters = {
    alunos: db.prepare(`SELECT a.id,a.nome FROM alunos a JOIN turmas t ON t.id=a.turma_id WHERE ${ctx.accessWhere} ORDER BY a.nome`).all(...ctx.accessArgs),
    turmas: db.prepare('SELECT id,nome FROM turmas WHERE ativo=1 ORDER BY nome').all(),
    escolas: db.prepare('SELECT id,nome FROM escolas WHERE ativo=1 ORDER BY nome').all(),
    universidades: db.prepare('SELECT id,nome FROM universidades WHERE ativo=1 ORDER BY nome').all(),
    cursos: db.prepare('SELECT id,nome,entidade_tipo,entidade_id FROM cursos WHERE ativo=1 ORDER BY nome').all(),
    materias: db.prepare('SELECT id,nome FROM materias WHERE ativo=1 ORDER BY nome').all(),
    anos: db.prepare('SELECT ano FROM notas GROUP BY ano ORDER BY ano DESC').all().map(item=>item.ano)
  }
  let catalog = []
  if (ctx.scope === 'universidade' && ctx.id) catalog = db.prepare("SELECT nome,codigo,modalidade,duracao FROM cursos WHERE ativo=1 AND entidade_tipo='universidade' AND entidade_id=? ORDER BY nome").all(ctx.id)
  if (ctx.scope === 'curso' && ctx.id) catalog = db.prepare('SELECT nome,codigo,modalidade,duracao FROM cursos WHERE ativo=1 AND id=?').all(ctx.id)
  res.json({ scope:ctx.scope, selected_id:ctx.id, ano:ctx.year, periodo:ctx.period, metrics:{ total_alunos:total, media_geral:number(media), frequencia_media:number(frequencia), maior_frequencia:maior }, evolution, groups, catalog, filters })
}

import db from "./database.js";

const esc = (value) =>
  String(value ?? "-").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
const n = (value) => Number(value || 0);
const avg = (values) =>
  values.length ? values.reduce((a, b) => a + n(b), 0) / values.length : 0;
const tone = (value) =>
  n(value) >= 7 ? "good" : n(value) >= 5 ? "warn" : "risk";

export function createReportHandler({ puppeteer, chromePath }) {
  return async (req, res) => {
    const ano = Number(req.query.ano || new Date().getFullYear());
    const role = String(req.user?.role || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    let access = "";
    const accessArgs = [];
    if (role === "professor") {
      access = " AND t.professor_id=?";
      accessArgs.push(req.user.id);
    }
    if (role === "pais") {
      access =
        " AND EXISTS(SELECT 1 FROM usuario_alunos ra WHERE ra.aluno_id=a.id AND ra.usuario_id=?)";
      accessArgs.push(req.user.id);
    }
    const aluno = db
      .prepare(
        "SELECT a.*,t.nome turma,t.ativo turma_ativa FROM alunos a JOIN turmas t ON t.id=a.turma_id WHERE a.id=?" +
          access,
      )
      .get(req.params.id, ...accessArgs);
    if (!aluno)
      return res.status(404).json({ message: "Aluno não encontrado" });
    const notas = db
      .prepare(
        "SELECT disciplina,bimestre,ano,nota,conceito FROM notas WHERE aluno_id=? AND ano=? AND COALESCE(ativo,1)=1 ORDER BY disciplina,bimestre",
      )
      .all(aluno.id, ano);
    const freq = db
      .prepare(
        "SELECT ROUND(COALESCE(AVG(presente)*100,0),1) percentual,COUNT(*) total,SUM(presente) presencas,SUM(CASE WHEN presente=0 THEN 1 ELSE 0 END) faltas FROM frequencias WHERE aluno_id=? AND substr(data,1,4)=?",
      )
      .get(aluno.id, String(ano));
    const acompanhamentos = db
      .prepare(
        "SELECT ac.*,u.nome autor FROM acompanhamentos ac LEFT JOIN usuarios u ON u.id=ac.autor_id WHERE ac.aluno_id=? AND substr(ac.data,1,4)=? ORDER BY ac.data DESC,ac.id DESC LIMIT 6",
      )
      .all(aluno.id, String(ano));
    const subjects = [...new Set(notas.map((row) => row.disciplina))].map(
      (disciplina) => {
        const items = notas.filter((row) => row.disciplina === disciplina);
        return {
          disciplina,
          items,
          media: avg(
            items.map((row) => row.nota).filter((value) => value !== null),
          ),
        };
      },
    );
    const media = avg(
      notas.map((row) => row.nota).filter((value) => value !== null),
    );
    const percentual = n(freq.percentual);
    const interpretation =
      percentual >= 90
        ? "A frequência está excelente e indica participação consistente."
        : percentual >= 75
          ? "A frequência está dentro do esperado, mas deve continuar sendo acompanhada."
          : "A frequência está abaixo do recomendado e requer um plano de acompanhamento.";
    const rows = subjects.length
      ? subjects
          .map((subject) => {
            const cells = [1, 2, 3, 4]
              .map((bimestre) => {
                const row = subject.items.find(
                  (item) => item.bimestre === bimestre,
                );
                return row
                  ? '<td><b class="grade ' +
                      tone(row.nota) +
                      '">' +
                      n(row.nota).toFixed(1) +
                      "</b></td>"
                  : '<td class="empty">-</td>';
              })
              .join("");
            return (
              "<tr><td><strong>" +
              esc(subject.disciplina) +
              "</strong><small>" +
              (subject.media >= 7 ? "Bom desempenho" : "Em acompanhamento") +
              "</small></td>" +
              cells +
              '<td><b class="grade ' +
              tone(subject.media) +
              '">' +
              (subject.media ? subject.media.toFixed(1) : "-") +
              "</b></td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="6" class="empty-row">Ainda não há notas lançadas para este aluno.</td></tr>';
    const bars = subjects.length
      ? subjects
          .map(
            (subject) =>
              '<div class="bar-row"><span>' +
              esc(subject.disciplina) +
              "</span><b>" +
              subject.media.toFixed(1) +
              '</b><i><em style="width:' +
              Math.min(100, subject.media * 10) +
              '%"></em></i></div>',
          )
          .join("")
      : '<p class="muted">Sem notas suficientes para gerar a comparação.</p>';
    const generated = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date());
    const timeline = acompanhamentos.length
      ? acompanhamentos
          .map(
            (item) =>
              '<div class="timeline-item"><i></i><div><b>' +
              esc(item.titulo) +
              "</b><small>" +
              esc(
                new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR"),
              ) +
              " · " +
              esc(item.tipo) +
              (item.comportamento
                ? " · Comportamento " + item.comportamento + "/10"
                : "") +
              "</small><p>" +
              esc(item.descricao) +
              "</p></div></div>",
          )
          .join("")
      : '<p class="muted">Nenhum registro pedagógico lançado neste ano.</p>';
    const html =
      '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>' +
      "@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#26384d;font-family:Arial,sans-serif;font-size:11px;line-height:1.45}.page{width:210mm;min-height:297mm;margin:auto;background:#fff;padding:14mm 16mm 14mm;position:relative}.brand{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:1px solid #dce5ed}.brand-left{display:flex;align-items:center;gap:9px}.logo{width:34px;height:34px;border-radius:10px;background:#18b8a8;color:white;display:grid;place-items:center;font-size:18px;font-weight:bold}.brand-name{font-size:17px;font-weight:bold;color:#14324f}.brand-name span{color:#18a99c}.type{text-align:right;color:#7a8999;font-size:9px;letter-spacing:1px;text-transform:uppercase}.hero{display:flex;justify-content:space-between;margin-top:15px;padding:18px 22px;border-radius:15px;background:linear-gradient(120deg,#102d49,#1d5066);color:#fff}.hero h1{margin:0 0 7px;font-size:24px}.hero p{margin:0;color:#d5e7ed}.hero-side{text-align:right}.hero-side b{display:block;font-size:27px}.hero-side small{color:#b9d9df}.section{margin-top:13px}.section-title{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid #e1e9ee;padding-bottom:7px;margin-bottom:11px}.section-title h2{margin:0;color:#143652;font-size:15px}.section-title p{margin:0;color:#7d8c9c;font-size:9px}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.metric{border:1px solid #dfe8ed;border-top:3px solid #18b8a8;border-radius:9px;padding:8px;background:#fcfdfe}.metric:nth-child(2){border-top-color:#3c72d4}.metric:nth-child(3){border-top-color:#edae42}.metric:nth-child(4){border-top-color:#8366d8}.metric:nth-child(5){border-top-color:#ef7f67}.metric label{display:block;color:#7d8d9d;font-size:8px;text-transform:uppercase;letter-spacing:.4px}.metric strong{display:block;color:#143652;font-size:19px;margin:4px 0}.metric small{color:#7d8d9d;font-size:8px}.analysis{display:grid;grid-template-columns:1fr 1fr;gap:10px}.panel{border:1px solid #dfe8ed;border-radius:10px;padding:10px}.panel h3{margin:0 0 7px;color:#143652;font-size:12px}.panel p{margin:0;color:#596c80}.bar-row{position:relative;margin:10px 0 14px;color:#52677b;font-size:10px}.bar-row b{float:right;color:#143652}.bar-row i{display:block;clear:both;height:7px;border-radius:99px;background:#e8eef2;margin-top:4px;overflow:hidden}.bar-row em{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#18b8a8,#3c72d4)}table{width:100%;border-collapse:collapse;border:1px solid #dce5eb}th{padding:9px 10px;background:#edf4f7;color:#47617a;text-align:left;font-size:9px;text-transform:uppercase}td{padding:9px 10px;border-top:1px solid #e5edf1;color:#344a60}td small{display:block;color:#8998a6;font-size:9px}.grade{padding:3px 6px;border-radius:5px;font-size:10px}.good{color:#087c6e;background:#def5ef}.warn{color:#996000;background:#fff0cc}.risk{color:#ae3c49;background:#ffe0e3}.empty,.empty-row{color:#95a3af}.empty-row{text-align:center;padding:18px}.legend{display:flex;gap:14px;margin-top:8px;color:#758598;font-size:9px}.frequency{page-break-inside:avoid;display:grid;grid-template-columns:100px 1fr;gap:16px;align-items:center}.ring{width:82px;height:82px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#18b8a8 " +
      Math.min(100, percentual) +
      '%,#e8eef2 0);position:relative}.ring:after{content:"";position:absolute;width:60px;height:60px;border-radius:50%;background:white}.ring b{position:relative;z-index:1;color:#143652;font-size:16px}.timeline-item{display:grid;grid-template-columns:10px 1fr;gap:8px;margin:8px 0}.timeline-item>i{width:7px;height:7px;border-radius:50%;background:#18b8a8;margin-top:4px}.timeline-item b,.timeline-item small{display:block}.timeline-item small{font-size:8px;color:#7d8c9c}.timeline-item p{margin-top:2px}.muted{color:#7d8c9c}.foot{position:absolute;left:18mm;right:18mm;bottom:8mm;border-top:1px solid #dce5ed;padding-top:7px;display:flex;justify-content:space-between;color:#8291a0;font-size:9px}</style></head><body><main class="page">' +
      '<header class="brand"><div class="brand-left"><div class="logo">E</div><div class="brand-name">edu<span>system</span></div></div><div class="type">Relatório pedagógico<br><strong>' +
      esc(generated) +
      "</strong></div></header>" +
      '<section class="hero"><div><h1>Relatório individual</h1><p>Acompanhamento acadêmico, frequência e desenvolvimento · ' +
      ano +
      '</p><p style="margin-top:13px"><strong>' +
      esc(aluno.nome) +
      "</strong> · Matrícula " +
      esc(aluno.matricula) +
      " · Turma " +
      esc(aluno.turma) +
      '</p></div><div class="hero-side"><b>' +
      (media ? media.toFixed(1) : "-") +
      "</b><small>média geral</small></div></section>" +
      '<section class="section"><div class="section-title"><h2>Resumo do período</h2><p>Dados calculados a partir dos lançamentos disponíveis</p></div><div class="cards"><div class="metric"><label>Frequência</label><strong>' +
      percentual.toFixed(0) +
      "%</strong><small>" +
      (freq.total || 0) +
      ' registros</small></div><div class="metric"><label>Presenças</label><strong>' +
      (freq.presencas || 0) +
      '</strong><small>dias presentes</small></div><div class="metric"><label>Faltas</label><strong>' +
      (freq.faltas || 0) +
      '</strong><small>dias ausentes</small></div><div class="metric"><label>Disciplinas</label><strong>' +
      subjects.length +
      '</strong><small>com notas lançadas</small></div><div class="metric"><label>Comportamento</label><strong>' +
      n(aluno.comportamento || 5) +
      "/10</strong><small>avaliação atual</small></div></div></section>" +
      '<section class="section analysis"><div class="panel"><h3>Leitura pedagógica</h3><p>' +
      esc(interpretation) +
      '</p><p style="margin-top:8px">' +
      (subjects[0]
        ? "A maior média é em <strong>" +
          esc([...subjects].sort((a, b) => b.media - a.media)[0].disciplina) +
          "</strong>."
        : "Lance notas para visualizar uma leitura personalizada.") +
      '</p></div><div class="panel"><h3>Média por disciplina</h3>' +
      bars +
      "</div></section>" +
      '<section class="section"><div class="section-title"><h2>Boletim por bimestre</h2><p>Notas de 0 a 10 · "-" significa sem lançamento</p></div><table><thead><tr><th>Disciplina</th><th>1º bim.</th><th>2º bim.</th><th>3º bim.</th><th>4º bim.</th><th>Média</th></tr></thead><tbody>' +
      rows +
      '</tbody></table><div class="legend">Verde: bom desempenho · Amarelo: em acompanhamento · Vermelho: necessita apoio</div></section>' +
      '<section class="section"><div class="section-title"><h2>Frequência e participação</h2><p>Registros de chamada</p></div><div class="panel frequency"><div class="ring"><b>' +
      percentual.toFixed(0) +
      "%</b></div><div><h3>" +
      (percentual >= 75 ? "Frequência adequada" : "Frequência requer atenção") +
      "</h3><p>" +
      esc(interpretation) +
      '</p><p style="margin-top:7px;color:#7d8c9c">Total: ' +
      (freq.total || 0) +
      " dias · Presenças: " +
      (freq.presencas || 0) +
      " · Faltas: " +
      (freq.faltas || 0) +
      "</p></div></div></section>" +
      '<section class="section"><div class="section-title"><h2>Desenvolvimento e registros pedagógicos</h2><p>Observações para acompanhamento e reuniões</p></div><div class="panel">' +
      timeline +
      "</div></section>" +
      '<footer class="foot"><span>EduSystem · Gestão escolar</span><span>Relatório individual · Consulte a equipe pedagógica para interpretar os indicadores</span></footer></main></body></html>';
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        ...(chromePath ? { executablePath: chromePath } : {}),
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 1600 });
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });
      res
        .set({
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="relatorio_' + aluno.matricula + '.pdf"',
        })
        .send(pdf);
    } catch (error) {
      res.status(500).json({ message: "Falha ao gerar PDF: " + error.message });
    } finally {
      if (browser) await browser.close();
    }
  };
}

export function createClassReportHandler({ puppeteer, chromePath }) {
  return async (req, res) => {
    const ano = Number(req.query.ano || new Date().getFullYear());
    const role = String(req.user?.role || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const teacherAccess = role === "professor" ? " AND t.professor_id=?" : "";
    const accessArgs = role === "professor" ? [req.user.id] : [];
    if (role === "pais")
      return res.status(403).json({
        message:
          "O perfil de responsável gera somente relatórios individuais vinculados",
      });
    const turma = db
      .prepare(
        "SELECT t.*,e.nome escola_nome,u.nome professor_nome FROM turmas t LEFT JOIN escolas e ON e.id=t.escola_id LEFT JOIN usuarios u ON u.id=t.professor_id WHERE t.id=?" +
          teacherAccess,
      )
      .get(req.params.id, ...accessArgs);
    if (!turma)
      return res.status(404).json({ message: "Turma não encontrada" });
    const alunos = db
      .prepare(
        `SELECT a.id,a.nome,a.matricula,a.comportamento,
      ROUND(COALESCE((SELECT AVG(n.nota) FROM notas n WHERE n.aluno_id=a.id AND n.ano=? AND COALESCE(n.ativo,1)=1),0),1) media,
      ROUND(COALESCE((SELECT AVG(f.presente)*100 FROM frequencias f WHERE f.aluno_id=a.id AND substr(f.data,1,4)=?),0),1) frequencia,
      (SELECT COUNT(*) FROM acompanhamentos ac WHERE ac.aluno_id=a.id AND substr(ac.data,1,4)=?) registros
      FROM alunos a WHERE a.turma_id=? AND a.status='Ativo' ORDER BY a.nome`,
      )
      .all(ano, String(ano), String(ano), turma.id);
    const media = avg(alunos.map((item) => item.media));
    const frequencia = avg(alunos.map((item) => item.frequencia));
    const comportamento = avg(alunos.map((item) => item.comportamento));
    const rows = alunos.length
      ? alunos
          .map(
            (item, index) =>
              `<tr><td>${index + 1}</td><td><strong>${esc(item.nome)}</strong><small>${esc(item.matricula)}</small></td><td><b class="pill ${tone(item.media)}">${n(item.media).toFixed(1)}</b></td><td>${n(item.frequencia).toFixed(0)}%</td><td>${n(item.comportamento).toFixed(0)}/10</td><td>${item.registros}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="6" class="empty">Nenhum aluno ativo nesta turma.</td></tr>';
    const top = [...alunos].sort((a, b) => b.media - a.media).slice(0, 5);
    const bars = top.length
      ? top
          .map(
            (item) =>
              `<div class="bar"><span>${esc(item.nome)}</span><b>${n(item.media).toFixed(1)}</b><i><em style="width:${Math.min(100, n(item.media) * 10)}%"></em></i></div>`,
          )
          .join("")
      : '<p class="muted">Sem notas disponíveis.</p>';
    const generated = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date());
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
      @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#26384d;font:11px/1.45 Arial,sans-serif}.page{width:210mm;min-height:297mm;margin:auto;background:white;padding:14mm 16mm;position:relative}.brand{display:flex;justify-content:space-between;align-items:center;padding-bottom:13px;border-bottom:1px solid #dce5ed}.logo{display:flex;align-items:center;gap:9px;font-size:17px;font-weight:700;color:#14324f}.logo i{width:34px;height:34px;border-radius:10px;background:#18b8a8;color:white;display:grid;place-items:center;font-style:normal}.logo span{color:#18a99c}.generated{text-align:right;color:#7b8997;font-size:9px}.hero{margin-top:15px;padding:18px 22px;border-radius:15px;color:white;background:linear-gradient(120deg,#102d49,#1d5066);display:flex;justify-content:space-between}.hero h1{margin:0 0 6px;font-size:24px}.hero p{margin:2px 0;color:#d5e7ed}.hero strong{font-size:18px}.section{margin-top:15px}.section-title{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid #e1e9ee;padding-bottom:7px;margin-bottom:10px}.section-title h2{margin:0;font-size:15px;color:#143652}.section-title span{font-size:9px;color:#7d8c9c}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.metric{border:1px solid #dfe8ed;border-top:3px solid #18b8a8;border-radius:9px;padding:10px}.metric:nth-child(2){border-top-color:#3c72d4}.metric:nth-child(3){border-top-color:#edae42}.metric:nth-child(4){border-top-color:#8366d8}.metric label{display:block;text-transform:uppercase;color:#7d8d9d;font-size:8px}.metric strong{display:block;color:#143652;font-size:20px;margin-top:4px}.analysis{display:grid;grid-template-columns:1fr 1fr;gap:10px}.panel{border:1px solid #dfe8ed;border-radius:10px;padding:11px}.panel h3{margin:0 0 8px;color:#143652;font-size:12px}.bar{margin:8px 0;color:#52677b}.bar b{float:right}.bar i{display:block;clear:both;height:7px;background:#e8eef2;border-radius:9px;overflow:hidden}.bar em{display:block;height:100%;background:linear-gradient(90deg,#18b8a8,#3c72d4)}table{width:100%;border-collapse:collapse;border:1px solid #dce5eb}th{padding:8px;background:#edf4f7;color:#47617a;text-align:left;font-size:8px;text-transform:uppercase}td{padding:8px;border-top:1px solid #e5edf1}td small{display:block;color:#8998a6}.pill{display:inline-block;padding:3px 7px;border-radius:5px}.good{color:#087c6e;background:#def5ef}.warn{color:#996000;background:#fff0cc}.risk{color:#ae3c49;background:#ffe0e3}.empty{text-align:center;padding:20px;color:#8998a6}.muted{color:#7d8c9c}.foot{position:absolute;bottom:8mm;left:16mm;right:16mm;border-top:1px solid #dce5ed;padding-top:7px;display:flex;justify-content:space-between;color:#8291a0;font-size:9px}
    </style></head><body><main class="page"><header class="brand"><div class="logo"><i>E</i><b>edu<span>system</span></b></div><div class="generated">RELATÓRIO CONSOLIDADO<br><strong>${esc(generated)}</strong></div></header><section class="hero"><div><h1>Relatório da turma</h1><strong>${esc(turma.nome)}</strong><p>${esc(turma.escola_nome || turma.escola)} · ${ano}</p><p>Professor(a): ${esc(turma.professor_nome || "Não informado")}</p></div><div><strong>${alunos.length}</strong><p>alunos ativos</p></div></section><section class="section"><div class="section-title"><h2>Resumo executivo</h2><span>Indicadores consolidados do período</span></div><div class="cards"><div class="metric"><label>Alunos</label><strong>${alunos.length}</strong></div><div class="metric"><label>Média da turma</label><strong>${media.toFixed(1)}</strong></div><div class="metric"><label>Frequência</label><strong>${frequencia.toFixed(0)}%</strong></div><div class="metric"><label>Comportamento</label><strong>${comportamento.toFixed(1)}/10</strong></div></div></section><section class="section analysis"><div class="panel"><h3>Destaques acadêmicos</h3>${bars}</div><div class="panel"><h3>Leitura da turma</h3><p>A turma apresenta média <strong>${media.toFixed(1)}</strong> e frequência média de <strong>${frequencia.toFixed(0)}%</strong>.</p><p style="margin-top:8px">${frequencia >= 75 ? "A presença está dentro do parâmetro esperado." : "A frequência requer acompanhamento da equipe pedagógica."}</p><p style="margin-top:8px">Os registros pedagógicos ajudam a contextualizar os números para reuniões e planos de intervenção.</p></div></section><section class="section"><div class="section-title"><h2>Alunos e indicadores</h2><span>Visão individual para acompanhamento</span></div><table><thead><tr><th>#</th><th>Aluno</th><th>Média</th><th>Frequência</th><th>Comportamento</th><th>Registros</th></tr></thead><tbody>${rows}</tbody></table></section><footer class="foot"><span>EduSystem · Gestão escolar</span><span>Relatório da turma ${esc(turma.nome)} · ${ano}</span></footer></main></body></html>`;
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        ...(chromePath ? { executablePath: chromePath } : {}),
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 1600 });
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });
      res
        .set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="relatorio_turma_${turma.id}_${ano}.pdf"`,
        })
        .send(pdf);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Falha ao gerar PDF da turma: " + error.message });
    } finally {
      if (browser) await browser.close();
    }
  };
}

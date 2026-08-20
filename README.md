# EduSystem

![Logo do EduSystem](web/public/edusystem-logo.png)

Gestão educacional desktop para escolas, creches, cursinhos, faculdades e universidades. O aplicativo combina uma interface React em glassmorphism, API Express, banco SQLite local e empacotamento portátil com Electron.

## Download

O executável portátil fica disponível na página **Releases** do repositório. Ele não exige instalação: basta baixar e abrir.

Na primeira execução, o EduSystem cria automaticamente:

```text
C:\EduSystem\
├── dados\database.sqlite
├── relatorios\
├── importacoes\
├── anexos\
└── backups\
```

Se a unidade `C:` não estiver disponível para escrita, os dados são criados na pasta de dados do usuário do Windows.

## Funcionalidades

- dashboard filtrável por turma, escola, curso e universidade;
- alunos ativos, inativos, contatos familiares e histórico pedagógico;
- importação por Excel/CSV e pacote de transferência EduSystem;
- cadastros de escolas, universidades, turmas, matérias e cursos;
- notas com arquivamento lógico e restauração;
- chamada individual por aluno, turma e data;
- relatórios profissionais em PDF para aluno e turma;
- quadro branco com desenho, formas, textos, post-its, imagens, conectores e pastas;
- seleção única para mover, redimensionar, editar e conectar objetos, com zoom por `Ctrl + rolagem`;
- perfis Diretor, Coordenador, Professor, Secretário e Pais;
- permissões e vínculos por usuário;
- login obrigatório em toda abertura, salvando opcionalmente somente o identificador;
- apresentação orientada no primeiro acesso de cada usuário;
- banco SQLite persistente criado e migrado automaticamente.

## Arquitetura

```text
Electron
├── React + Vite (interface)
├── Node.js + Express (API local)
└── better-sqlite3 (C:\EduSystem\dados\database.sqlite)
```

O Electron procura uma porta local livre, inicia a API em segundo plano e conecta o frontend usando autenticação JWT. O banco nunca precisa ser configurado manualmente.

## Desenvolvimento

Requisitos: Node.js 20+ e Windows 10/11 para o build portátil.

```powershell
cd server
npm ci
npm start
```

Em outro terminal:

```powershell
cd web
npm ci
npm run dev
```

## Gerar o executável portátil

```powershell
cd web
npm ci
npm run build

cd ..\desktop
npm ci
npm run dist
```

Saída:

```text
desktop\dist-final\EduSystem-Portable-<versão>.exe
```

## Banco de dados

Use **DB Browser for SQLite** para visualizar o arquivo `database.sqlite`. Não use IBExpert: ele é destinado principalmente ao Firebird.

Antes de abrir o banco em uma ferramenta externa, feche o EduSystem e copie `database.sqlite` para a pasta de backups. Consulte [docs/BANCO-DE-DADOS.md](docs/BANCO-DE-DADOS.md).

## Segurança e dados

- senhas são armazenadas com bcrypt;
- o banco novo nasce sem alunos ou credenciais demonstrativas;
- cada usuário possui conta, preferências, apresentação e quadros próprios;
- a chave local de sessão é aleatória e exclusiva de cada instalação;
- usuários e senhas nunca entram nos pacotes de transferência;
- exclusões administrativas são lógicas e preservam o histórico;
- arquivos `.sqlite`, `.env`, builds e dependências locais não são versionados;
- cada instalação mantém seus dados fora da pasta do executável.

## Estrutura do repositório

```text
web/      frontend React + Vite
server/   API Express, SQLite, relatórios e regras de negócio
desktop/  processo Electron, ícones e configuração do portátil
docs/     documentação operacional
```

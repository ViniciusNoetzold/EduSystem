# EduSystem API

API Express com JWT e SQLite via `better-sqlite3`.

```powershell
cd C:\Users\Ana\Documents\ChatGPT\EduSystem\server
npm ci
npm run dev
```

O banco é criado automaticamente em `server/data/database.sqlite`. O seed inicial usa:

```text
diretora@escola.com / 123456
professor@escola.com / 123456
```

Endpoints principais: `/api/auth/login`, `/api/auth/register`, `/api/alunos`, `/api/notas`, `/api/frequencias`, `/api/turmas` e `/api/dashboard`.

As credenciais acima são apenas para desenvolvimento. Em uma implantação real, crie usuários próprios e não compartilhe bancos de produção. No executável portátil, o banco é gravado em `C:\EduSystem\dados\database.sqlite`.

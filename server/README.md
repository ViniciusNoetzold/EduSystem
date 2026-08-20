# EduSystem API

API Express com JWT e SQLite via `better-sqlite3`.

```powershell
cd C:\Users\Ana\Documents\ChatGPT\EduSystem\server
npm ci
npm run dev
```

O banco é criado automaticamente em `server/data/database.sqlite`. Por padrão ele nasce sem usuários e sem dados acadêmicos. A primeira conta do diretor é criada pela tela de primeiro acesso.

Dados demonstrativos só são habilitados explicitamente em desenvolvimento com `EDUSYSTEM_SEED_DEMO=1`; eles nunca são incluídos no primeiro uso do executável distribuído.

Endpoints principais: `/api/auth/login`, `/api/auth/register`, `/api/alunos`, `/api/notas`, `/api/frequencias`, `/api/turmas` e `/api/dashboard`.

No executável portátil, o banco é gravado em `C:\EduSystem\dados\database.sqlite`. Cada abertura exige novamente a senha; apenas o nome de usuário ou e-mail pode ser lembrado no computador.

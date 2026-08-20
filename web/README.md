# Gestão Escolar Web

Interface SaaS responsiva em React + Vite, Tailwind CSS, React Router, Recharts e Konva. A autenticação local mantém o token em `localStorage` quando “Lembrar de mim” está marcado. A API opcional em `../server` usa Express e JWT.

## Executar

```powershell
cd web
npm ci
npm run dev
```

Abra `http://localhost:5173` com a API rodando. O login seed é `diretora@escola.com` / `123456`. O primeiro acesso usa `POST /api/auth/register`, e “Lembrar de mim” persiste o JWT localmente.

Alunos, notas e frequência são carregados pela API real em `http://localhost:3333` e persistidos em `server/data/database.sqlite` durante o desenvolvimento.

## API local

```powershell
cd server
npm ci
npm run dev
```

## Build

```powershell
cd web
npm run build
```

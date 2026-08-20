# EduSystem Desktop

Shell Electron portátil que inicia automaticamente a API Express/SQLite e abre o frontend React compilado.

O executável é criado em `desktop/dist-final/EduSystem-Portable-<versão>.exe`.

O processo desktop cria `C:\EduSystem\dados`, procura uma porta local livre, inicia o backend como subprocesso oculto e carrega o frontend compilado. Os ativos de marca ficam em `desktop/assets`.

```powershell
npm ci
npm run dist
```

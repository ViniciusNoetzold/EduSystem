# Publicação de uma versão

## Checklist

1. Atualizar a versão em `desktop/package.json`.
2. Executar o smoke test de release com banco temporário vazio em `server`.
3. Executar `npm ci` e `npm run build` em `web`.
4. Executar `npm ci` e `npm run dist` em `desktop`.
5. Validar o backend empacotado em `desktop/dist-final/win-unpacked/resources/server`.
6. Executar `npm run test:packaged` em `server`.
7. Calcular o SHA-256 do executável.
8. Criar uma tag `vX.Y.Z` e publicar o `.exe` como asset do GitHub Release.

## PowerShell

```powershell
cd server
npm ci
npm run test:release

cd ..\web
npm ci
npm run build

cd ..\desktop
npm ci
npm run dist

cd ..\server
npm run test:packaged

Get-FileHash ..\desktop\dist-final\EduSystem-Portable-X.Y.Z.exe -Algorithm SHA256
```

O executável não deve ser commitado no histórico Git. Ele deve ser anexado ao GitHub Release para evitar inflar permanentemente o repositório.


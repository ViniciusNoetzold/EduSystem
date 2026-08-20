# Publicação de uma versão

## Checklist

1. Atualizar a versão em `desktop/package.json`.
2. Executar `npm ci` e `npm run build` em `web`.
3. Executar `npm ci` e `npm run dist` em `desktop`.
4. Validar o backend empacotado em `desktop/dist-final/win-unpacked/resources/server`.
5. Calcular o SHA-256 do executável.
6. Criar uma tag `vX.Y.Z` e publicar o `.exe` como asset do GitHub Release.

## PowerShell

```powershell
cd web
npm ci
npm run build

cd ..\desktop
npm ci
npm run dist

Get-FileHash .\dist-final\EduSystem-Portable-X.Y.Z.exe -Algorithm SHA256
```

O executável não deve ser commitado no histórico Git. Ele deve ser anexado ao GitHub Release para evitar inflar permanentemente o repositório.


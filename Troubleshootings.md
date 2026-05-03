# Troubleshootings

## ERROR  Error: Cannot find module 'babel-preset-expo'

Neste caso, instale a lib com, pois há um conflito de versões:

```bash
npm install --save-dev babel-preset-expo --legacy-peer-deps
```

## ERROR  TypeError: Body is unusable: Body has already been read

Ocorre no `npm start` / `expo start`, durante o check online de versões de native modules do `@expo/cli`:

```
TypeError: Body is unusable: Body has already been read
    at consumeBody (node:internal/deps/undici/undici:...)
    at _Response.json (...)
    at getNativeModuleVersionsAsync (.../getNativeModuleVersions.ts:47:31)
    at ... validateDependenciesVersionsAsync
```

É um bug conhecido do Expo CLI no Node 22 (undici) — o body da resposta HTTP é consumido duas vezes no caminho de erro. Não impede o dev server de funcionar, mas trava o boot.

**Solução**: rodar com `EXPO_OFFLINE=1`, que pula a validação online (não afeta Metro nem bundler):

```powershell
# PowerShell — ad hoc
$env:EXPO_OFFLINE = '1'; npm start

# ou use .\dev-up.ps1 — o script já seta a variável antes de iniciar o Expo
```

```bash
# macOS / Linux / Git Bash
EXPO_OFFLINE=1 npm start
```

## `npm run dev:up` falha com `pwsh: command not found`

Os scripts `dev:up`, `dev:up:noexpo`, `dev:up:rebuild`, `dev:down`, `dev:nuke` e `dev:status` invocam `pwsh ./dev-up.ps1` por padrão (PowerShell Core). Em máquinas sem `pwsh` no PATH (macOS/Linux sem PowerShell instalado), eles falham.

**Solução**: use as variantes `:sh` que delegam para `bash ./dev-up.sh`:

```bash
npm run dev:up:sh      # equivalente a dev:up
npm run dev:down:sh    # equivalente a dev:down
npm run dev:status:sh  # equivalente a dev:status
```

Para usar `pwsh` no macOS/Linux, instale via `brew install --cask powershell` ou `apt install powershell`.

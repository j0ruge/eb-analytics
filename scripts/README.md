# Scripts

Utilitários de linha de comando para tarefas operacionais do EB Insights. Nenhum destes scripts é executado pelo app em runtime — são ferramentas de desenvolvimento, manutenção e sincronização.

## Google Sheets — Sincronização com a planilha `eb_insights`

Esses scripts espelham os dados de coleta semanal do Obsidian (`EB-Insights.md`) para a planilha Google Sheets do coordenador. Veja o runbook completo em `.claude/rules/google-sheets-sync.md`.

| Script | Comando | O que faz | Seguro? |
|---|---|---|---|
| `google-auth.js` | `node scripts/google-auth.js` | Fluxo OAuth interativo — abre o Chrome, pede consentimento, salva tokens em `.secrets/google-token.json` | ✅ Só grava em `.secrets/` |
| `_google-auth-helper.js` | *(não rodar diretamente)* | Helper interno — exporta `authClient()` com OAuth2 autenticado para os outros scripts | — |
| `sheet-read.js` | `node scripts/sheet-read.js` | Diagnóstico — lista abas da planilha e imprime as primeiras 25 linhas de cada | ✅ Read-only |
| `sheet-sync.js` | `node scripts/sheet-sync.js` | Atualiza a planilha. Sem flags = dry-run (imprime o que faria). Com `--apply` = escreve de fato | ⚠️ Destrutivo com `--apply` |

**Pré-requisitos**: `.secrets/google-client.json` (OAuth Desktop client do projeto GCP `gabiclaw-488717`) e `.secrets/google-token.json` (gerado pelo `google-auth.js`). Ambos são git-ignored.

**Se o token expirar** (`invalid_grant` ou `401`): rode `node scripts/google-auth.js` novamente.

---

## Banco de Dados

| Script | Comando | O que faz |
|---|---|---|
| `reset-database.js` | `node scripts/reset-database.js` | Reseta o banco SQLite deletando o arquivo do DB. Útil quando a migração entra em estado inconsistente durante desenvolvimento. O app recria o banco automaticamente no próximo boot. |
| `seed-from-collections.js` | `node scripts/seed-from-collections.js` | Valida o arquivo `src/data/seed-collections.json` (formato v2). **Não popula o SQLite diretamente** — o banco vive no runtime do Expo e não é acessível por scripts Node externos. Para popular o banco, use o botão "Carregar dados de exemplo" em `Configurações → Desenvolvimento` dentro do app. |

---

## Desenvolvimento / E2E

| Script | Comando | O que faz |
|---|---|---|
| `kill-expo-web.sh` | `bash scripts/kill-expo-web.sh [porta]` | Mata o servidor Expo web rodando na porta especificada (default: 8082). Cross-platform (Windows Git Bash, macOS, Linux). Útil após sessões de teste E2E com Playwright que deixam o metro bundler rodando em background. |

**Uso com testes E2E**: o `playwright.config.ts` inicia o servidor automaticamente via `webServer.command`, mas se o servidor já estiver rodando (`reuseExistingServer: true`), ele reutiliza. Após os testes, rode `bash scripts/kill-expo-web.sh` para liberar a porta.

---

## Convenções

- Scripts Node.js (`.js`) são CommonJS — rodam com `node scripts/<nome>.js`
- Scripts shell (`.sh`) são Bash — rodam com `bash scripts/<nome>.sh`
- Nenhum script modifica código-fonte ou arquivos do repo (exceto `.secrets/` que é git-ignored)
- Scripts prefixados com `_` são helpers internos, não devem ser executados diretamente

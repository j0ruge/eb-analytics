# Runbook — Sincronização Google Sheets (`eb_insights`)

Procedimento para espelhar o JSON consolidado de `EB-Insights.md` (Obsidian) na planilha `eb_insights` do Google Sheets. Este runbook é acionado a partir do ponteiro na seção 17 do `CLAUDE.md`.

## Objetivo

Manter a planilha atualizada com as coletas semanais (cada sábado é uma linha). As coletas originais ficam em `G:\My Drive\01-Pessoal\Backup\pc_casa\Documents\obsidian\01 Projects\EB-Insights.md`, frequentemente com **múltiplos coletores por sábado**, e precisam ser consolidadas antes de entrar na planilha.

## Planilha alvo

- **ID**: `1HXTD-hO1N1xsLV2_LuSxS_4Hhn6Z_HY-Zkx0Vr5Umws`
- **URL**: https://docs.google.com/spreadsheets/d/1HXTD-hO1N1xsLV2_LuSxS_4Hhn6Z_HY-Zkx0Vr5Umws/edit
- **Aba principal**: `dados`
- **Aba secundária**: `Progressão` (timeline minuto-a-minuto de alguns sábados — **não mexer**)

### Colunas da aba `dados`

| Col | Campo | Formato / Exemplo |
|-----|---|---|
| A | Série de lições | `Eb354`, `Eb355`, `Eb356` |
| B | Tema da lição | texto livre |
| C | Professor | nome completo (ex: `Alex Tolomei`, `Jefferson Pedro`) |
| D | Data | `2026/mmm./DD` — mês abreviado em minúscula, com ponto (ex: `2026/mar./28`) |
| E | Hora Início | `HH:MM` sem "h" (ex: `10:07`) |
| F | Pessoas no início | número inteiro |
| G | Pessoas no meio | número inteiro |
| H | Pessoal no final | número inteiro |
| I | No. Participantes distintos | número inteiro |
| J | Hora Fim | `HH:MM` |
| K | Clima | texto livre (ex: `Ensolarado`, `28°C sol entre nuvens`) |
| L | Obs | texto livre — usado para flags como "Contagem incluindo o professor", divergências, eventos especiais |

## Estilo de consolidação do dono da planilha

**Regra crítica**: o dono da planilha **não desconta o professor** das contagens de presença. Quando um coletor marca "c prof" e os outros não, a estratégia é:

- Manter a contagem mais representativa (mediana de 3, média de 2, valor único).
- Se há assimetria (um incluiu professor, outro não), sinalizar na coluna **Obs** com algo como `"Jeff contando com professor"` ou `"Contagem incluindo o professor"`.
- **Nunca** modificar linhas já existentes na planilha — o dono já consolidou manualmente e pode ter informação extra que o MD não tem (caso documentado: fev/14 na planilha diverge do MD).

## Credenciais

Vivem em `.secrets/` (git-ignored):

- `.secrets/google-client.json` — OAuth 2.0 Desktop client (projeto GCP: `gabiclaw-488717`). Download original: `Downloads\client_secret_*.json`.
- `.secrets/google-token.json` — Gerado pelo script `google-auth.js`. Contém `access_token` + `refresh_token`. **Nunca commitar**.

**Escopo OAuth**: `https://www.googleapis.com/auth/spreadsheets` (leitura + escrita).

### Se o token expirar

Sintoma: `sheet-read.js` ou `sheet-sync.js` retorna `invalid_grant` ou `401`.

Solução: rodar de novo o fluxo interativo:

```bash
node scripts/google-auth.js
```

Isso abre o Chrome, pede novo consentimento e sobrescreve `.secrets/google-token.json`. Em ambiente Windows, o script força o caminho do Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) para evitar abrir no Brave ou Edge.

## Scripts disponíveis

Todos em `scripts/` no formato CommonJS (`.js`), rodados diretamente com `node`:

| Script | Finalidade | Seguro? |
|---|---|---|
| `scripts/google-auth.js` | Fluxo OAuth inicial (browser interativo) | ✅ só grava em `.secrets/` |
| `scripts/sheet-read.js` | Diagnóstico — lista abas e imprime primeiras 25 linhas de cada | ✅ read-only |
| `scripts/sheet-sync.js` | Atualização da planilha. `--dry-run` (default) imprime; `--apply` escreve. | ⚠️ destrutivo com `--apply` |
| `scripts/_google-auth-helper.js` | Helper interno — exporta `authClient()` | (não rodar direto) |

## Fluxo recorrente — adicionar novas semanas

1. **Coletar** os dados da(s) nova(s) semana(s) no MD `EB-Insights.md` do Obsidian (múltiplos coletores idealmente).
2. **Verificar estado atual da planilha**:
   ```bash
   node scripts/sheet-read.js
   ```
   Anotar: quais datas já estão preenchidas? Quais linhas estão vazias (semi-preenchidas com apenas Série+Data)? Qual é a próxima linha livre?
3. **Consolidar** as contagens do MD seguindo o estilo do dono (acima). Tomar cuidado especial com coletores que marcam "c prof" vs os que não marcam.
4. **Editar `scripts/sheet-sync.js`** — adicionar as novas linhas ao array `UPDATES`. Dois tipos:
   - **Preenchimento parcial** de linha semi-existente: `{ range: "'dados'!B<N>:L<N>", values: [[tema, prof, "", horaIni, f, g, h, dist, horaFim, clima, obs]] }`. Note o `""` na posição de D (data) — a data já está preenchida.
   - **Linha nova no final**: `{ range: "'dados'!A<N>:L<N>", values: [[serie, tema, prof, data, horaIni, f, g, h, dist, horaFim, clima, obs]] }`.
5. **Dry-run**:
   ```bash
   node scripts/sheet-sync.js
   ```
   Revisar o payload impresso. Confirmar formato de data, contagens, obs. **Importante**: confirmar com o usuário antes do próximo passo.
6. **Aplicar**:
   ```bash
   node scripts/sheet-sync.js --apply
   ```
   O script faz um `values.get` das faixas alvo antes de escrever, e **aborta** se detectar dados inesperados (proteção contra condição de corrida).
7. **Verificar**:
   ```bash
   node scripts/sheet-read.js
   ```
   Conferir que as novas linhas aparecem corretamente e que as antigas ficaram intactas.
8. **Commit**:
   ```
   chore(scripts): sync week 2026-mm-dd to sheet
   ```
   Lembrete: `.secrets/` está no `.gitignore`, mas revise `git status` antes para ter certeza.

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `invalid_grant` / `401` | Token expirado ou revogado | Rodar `node scripts/google-auth.js` novamente |
| `403 insufficient_scope` | Token foi gerado com escopo só-leitura | Apagar `.secrets/google-token.json` e rodar `google-auth.js` (tem scope correto) |
| `ENOENT google-client.json` | `.secrets/` foi apagado | Recriar a partir do OAuth client JSON original no GCP Console |
| Script aborta: "faixa já preenchida" | Alguém editou a planilha entre o dry-run e o apply | Rodar `sheet-read.js` de novo, revisar, atualizar `UPDATES` |
| Navegador errado abre no OAuth (Brave/Edge) | Chrome não encontrado | Verificar `scripts/google-auth.js` → função `openBrowser()`; ajustar caminho do Chrome |
| Data aparece como número na planilha | `valueInputOption` errado | Garantir `valueInputOption: 'USER_ENTERED'` no `batchUpdate` |

## Segurança

- **Nunca commitar** `.secrets/` — já coberto em `.gitignore` (padrões `.secrets/`, `google-*.json`, `client_secret*.json`).
- Client secret de Desktop OAuth é considerado **semi-público** (Google permite incluir em apps distribuídos), mas ainda assim manter fora do repo é a boa prática.
- Não imprimir o conteúdo de `.secrets/google-token.json` em logs. Os scripts atuais não fazem isso — manter assim.
- Se o cliente OAuth for comprometido, revogar em https://console.cloud.google.com → APIs & Services → Credentials → projeto `gabiclaw-488717`.

## Contexto histórico

Este runbook foi criado em abril/2026 durante a primeira sincronização em lote, que transportou as semanas 2026-03-14 → 2026-04-11 do MD para a planilha. Até então a planilha era preenchida 100% à mão. Ver `specs/` ou histórico git para a análise original de divergências entre coletores (ex: Jeff sempre conta com professor, mar/28 teve divergência de 9 pessoas no fim, abr/04 teve divergência de tema).

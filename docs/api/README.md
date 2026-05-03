# API EB Insights — Referência OpenAPI

Contrato completo do backend em [`openapi.json`](./openapi.json) (OpenAPI 3.0.3, **21 endpoints** em 7 tags).

## Importar no Insomnia

1. `Application menu` → **Import** → selecionar `docs/api/openapi.json`.
2. Insomnia cria um workspace com 7 pastas (uma por tag) e todos os requests prontos, com examples embutidos.
3. Na aba **Environments**, crie ou ajuste `base_url = http://localhost:3000` (ou `http://<seu-ip>:3000` se for testar do celular). O servidor `{lanIp}` no OpenAPI já oferece essa variável.
4. Fluxo mínimo pra testar:
   - `POST /auth/register` com o example → `201` com `{ jwt, user }`
   - Copie o `jwt` do response → cole em **Auth → Bearer Token** no environment
   - `GET /me` → `200` confirma que o token funciona
   - Demais endpoints já herdam o Bearer do environment

> **Dica**: o Insomnia tem um helper de resposta — em vez de copiar/colar, configure o Bearer Token com `{% response 'body', 'req_<id-do-login>', 'b64::anY=::46b', 'never', 60 %}` apontando pro `.jwt` do response do login. Assim o token rotaciona sozinho.

## Importar no Postman / Bruno

Mesmo fluxo: File → Import → `openapi.json`. Ambos parseiam OpenAPI 3.0.3 nativamente. No Postman use `{{base_url}}` / `{{jwt}}` como variáveis de environment.

## Visualizar no Swagger UI

Com Docker (recomendado, zero config):

```powershell
docker run --rm -p 8080:8080 `
  -v "${PWD}/docs/api:/api" `
  -e SWAGGER_JSON=/api/openapi.json `
  swaggerapi/swagger-ui
```

```bash
docker run --rm -p 8080:8080 \
  -v "$PWD/docs/api:/api" \
  -e SWAGGER_JSON=/api/openapi.json \
  swaggerapi/swagger-ui
```

Abre em <http://localhost:8080>. "Try it out" funciona contra o backend local se ele estiver em `http://localhost:3000` (CORS já inclui `8080` se você rodar o `swagger-ui` com Authorize no header).

## Rationale — por que X do jeito Y?

Este OpenAPI é a **fonte de verdade** pro contrato operacional. Pro *porquê* de cada decisão (escolha de mediana, advisory locks, idempotência, moderação com recompute em cascata), consulte:

- [`specs/007-sync-backend/contracts/`](../../specs/007-sync-backend/contracts/) — um arquivo por domínio:
  - `auth.md`, `catalog.md`, `sync.md`, `instances.md`, `users.md`
  - `error-codes.md` — registro canônico dos `code` em snake_case
- [`specs/007-sync-backend/spec.md`](../../specs/007-sync-backend/spec.md) — requirements (FR-xxx) referenciados nas descrições.
- [`specs/005-export-contract-v2/contracts/export-envelope.v2.schema.json`](../../specs/005-export-contract-v2/contracts/export-envelope.v2.schema.json) — schema JSON autoritativo do envelope v2 consumido por `POST /sync/batch`.

## Manter sincronizado

Quando alterar uma rota em `server/src/routes/*.ts`:

1. Atualize o contrato do domínio em `specs/007-sync-backend/contracts/*.md`.
2. Atualize `docs/api/openapi.json` (paths, schemas, examples afetados).
3. Valide com um linter:
   ```powershell
   npx @redocly/cli@latest lint docs/api/openapi.json
   ```
4. Re-importe no Insomnia / Postman pra atualizar os requests.

## Estrutura do contrato

| Tag | Endpoints | Auth típica |
|-----|-----------|-------------|
| `auth` | `POST /auth/register`, `POST /auth/login`, `GET /me` | pública (register/login), JWT (me) |
| `health` | `GET /health` | pública |
| `sync` | `POST /sync/batch` | JWT |
| `collections` | `GET /collections?mine=true` | JWT |
| `catalog` | `GET /catalog` + 9 mutations de series/topics/professors | JWT (GET) / COORDINATOR (mutations) |
| `instances` | `GET /instances`, `GET /instances/:id`, `POST /instances/:id/recompute` | COORDINATOR |
| `users` | `GET /users`, `PATCH /users/:id/accepted` | COORDINATOR |

Shape de erro padrão: `{ code: string (snake_case), message: string (pt-BR) }`. Status HTTP segue semântica comum — ver `components/responses` no `openapi.json` para todos os `code` possíveis em cada status.

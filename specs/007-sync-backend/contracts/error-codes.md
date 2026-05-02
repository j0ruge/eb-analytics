# Contracts — Error Code Registry (FR-065)

Every 4xx/5xx response body is `{ "code": "<snake_case_english>", "message": "<pt-BR>" }`. Tests and clients branch on `code`; `message` is human-facing and may be rephrased without bumping anything.

## Auth / session

| HTTP | `code` | Suggested pt-BR `message` | Source |
|---|---|---|---|
| 400 | `password_too_short` | `A senha deve ter no mínimo 8 caracteres.` | FR-015 |
| 400 | `invalid_email` | `E-mail inválido.` | FR-010 |
| 409 | `email_already_registered` | `Este e-mail já está cadastrado.` | FR-010 |
| 401 | `invalid_credentials` | `E-mail ou senha inválidos.` | FR-011, US-4 scenario 3 |
| 401 | `unauthenticated` | `Credencial ausente ou inválida.` | FR-060 |
| 403 | `forbidden` | `Acesso restrito a coordenadores.` | FR-061 |

## Sync

| HTTP | `code` | Suggested pt-BR `message` | Source |
|---|---|---|---|
| 400 | `schema_version_required` | `O campo schema_version é obrigatório.` | EC-006 |
| 400 | `schema_version_unsupported` | `Versão de schema não suportada — esperada v2.` | EC-006 |
| 413 | `batch_too_large` | `Lote excede o limite (máx. 500 coletas ou 5 MB).` | EC-007 |
| 400 | `invalid_query` | `Parâmetros de consulta inválidos.` | Generic |

## Per-collection rejection codes (inside `response.rejected[].code`)

These are **not** HTTP errors — they are per-item outcomes carried by a 200 response. They are still English `snake_case` for consistency.

| `code` | When | Source |
|---|---|---|
| `missing_catalog_reference` | No `*_id` and fallback text also unknown. | EC-001 |
| `invalid_collection_payload` | Fields malformed, out-of-range, or unparseable. | EC-003 |
| `already_rejected_older` | A newer rejection for the same id is already persisted. | FR-021 interplay |

## Catalog

| HTTP | `code` | Suggested pt-BR `message` | Source |
|---|---|---|---|
| 409 | `code_already_exists` | `Código já existe.` | FR-032 unique |
| 409 | `email_already_exists` | `E-mail já existe.` | FR-032 unique |
| 409 | `id_conflict` | `ID já existe com payload diferente.` | Idempotent replay divergence |
| 404 | `not_found` | `Registro não encontrado.` | Generic |
| 409 | `series_referenced` | `Série não pode ser excluída enquanto houver aulas associadas.` | FR-034 |
| 409 | `topic_referenced` | `Tópico não pode ser excluído enquanto houver aulas associadas.` | FR-034 |
| 409 | `professor_referenced` | `Professor não pode ser excluído enquanto houver aulas associadas.` | FR-034 |
| 400 | `invalid_payload` | `Payload inválido.` | Generic 4xx |

## Moderation / users

| HTTP | `code` | Suggested pt-BR `message` | Source |
|---|---|---|---|
| 400 | `invalid_payload` | `Campo accepted ausente ou inválido.` | FR-051 |

## Throttling

| HTTP | `code` | Suggested pt-BR `message` | Source |
|---|---|---|---|
| 429 | `rate_limited` | `Muitas requisições. Aguarde um instante.` | FR-063 |

## Server

| HTTP | `code` | Suggested pt-BR `message` | Source |
|---|---|---|---|
| 500 | `internal_error` | `Erro interno do servidor.` | Fallback |
| 503 | `database_unavailable` | `Banco de dados indisponível.` | US-7 scenario 2 |

## Notes

- Adding a new `code` is non-breaking for clients that already handle the existing set — they just fall through to a generic "unknown error" branch.
- Renaming an existing `code` **is** breaking. Never rename; add a new one and retire the old across client releases.
- `message` is pt-BR only in MVP; `Accept-Language` negotiation is explicitly out of scope (FR-065, spec clarification Q5).

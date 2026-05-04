# TODO — CPF do Professor (round-trip mobile ↔ backend)

**Sessão:** 2026-05-03
**Status:** ✅ Implementado e testado, **NÃO commitado** — revisar e commitar quando voltar.
**Plano original:** `C:\Users\pc_admin\.claude\plans\continue-em-plan-floofy-piglet.md`

---

## 1. Bug original (relatado pelo usuário)

> "Criei um professor no front com CPF, mas no banco o CPF não foi registrado e no frontend aparece o UUID no lugar do CPF."

**Cadeia confirmada por psql + leitura de código:**

1. Mobile coletava CPF localmente (`src/services/professorService.ts:41-44`).
2. Mas o POST omitia `doc_id` (linha 49-53) — CPF morria no envio.
3. Backend rejeitava `doc_id` (`additionalProperties: false` + DTO sem o campo + model Prisma sem coluna).
4. Sync de download (`src/services/catalogSyncService.ts:87-101`) tinha workaround `doc_id = p.id` que **sobrescrevia o CPF local com o UUID do servidor**.
5. Tela exibia UUID porque `formatCpfDisplay(uuid)` falhava em formatar e retornava o UUID inteiro.

---

## 2. O que foi feito

### Backend (server/)

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | Adicionado `docId String? @unique` em `Professor` |
| `prisma/migrations/0003_add_professor_doc_id/migration.sql` | Migration aplicada via `psql` + `prisma migrate resolve --applied` (shadow DB do Prisma quebra na 0002, por isso o caminho manual) |
| `src/routes/catalog.ts` | `professorCreateSchema` + `professorPatchSchema` aceitam `doc_id` com regex `^[0-9]{11}$` |
| `src/services/catalogService.ts` | DTOs/serializer/`createProfessor`/`updateProfessor` propagam `docId`; novo erro `doc_id_already_exists`; `prismaUniqueTarget` corrigido para o formato Prisma 7 driver-adapter (vinha em `meta.driverAdapterError.cause.constraint.fields`, não em `meta.target`) |
| `docs/api/openapi.json` | Schema `ProfessorItem`/`Create`/`Patch` documentam `doc_id` |
| `specs/007-sync-backend/contracts/error-codes.md` | Registrado `doc_id_already_exists` |
| `test/catalog.mutations.test.ts` | +7 casos cobrindo POST/PATCH/duplicata/regex/idempotência |

### Mobile (root)

| Arquivo | Mudança |
|---|---|
| `src/db/schema.ts` | `doc_id TEXT UNIQUE` (sem NOT NULL) — comentário explica o porquê |
| `src/db/migrations.ts` | Nova `migrateProfessorDocIdNullable` (010): recria a tabela para dropar `NOT NULL` e **limpa o lixo de UUIDs** (`CASE WHEN doc_id = id THEN NULL`) |
| `src/db/client.ts` | Wira `migrateProfessorDocIdNullable` no boot |
| `src/types/professor.ts` | `doc_id: string \| null` |
| `src/services/professorService.ts` | POST e PATCH agora enviam `doc_id`; fallback de 404 lê `name`+`doc_id` da tabela local pra reconstruir o POST |
| `src/services/catalogSyncService.ts` | DTO inclui `doc_id`; UPSERT usa `p.doc_id` (nunca mais `p.id`) com `COALESCE(excluded.doc_id, professors.doc_id)` para preservar CPF local quando o servidor não tem |
| `src/utils/cpf.ts` | `formatCpfDisplay` aceita `string \| null \| undefined` |
| `app/professors/[id].tsx` | `formatCpfDisplay` local também aceita `null` |
| `app/(tabs)/professors.tsx` | Lista mostra `"não cadastrado"` quando `doc_id == null` |
| `tests/unit/professorService.test.ts` | Atualizado: regression guard de POST com `doc_id`, PATCH propaga, fallback 404 |
| `tests/unit/catalogSyncService.test.ts` | Novo regression guard: sync NÃO escreve UUID em `doc_id`, usa COALESCE |
| `tests/unit/migration_010.test.ts` | Novo: 4 casos cobrindo a migration |

---

## 3. Decisão tomada (registrada)

Renomear tabela `Professor → Professores` (PT plural): **NÃO** feito agora.
Motivo: criaria inconsistência (única em PT no meio de `User`, `LessonSeries`, etc. todas singular EN padrão Prisma).
Vira tarefa separada se quiser padronizar tudo.

---

## 4. Verificação já feita

- ✅ Server tests: **85/86** (o 1 que falha é o `rateLimit` flake **pré-existente** — confirmado via `git stash`)
- ✅ Mobile tests: **192/192**
- ✅ `npx tsc --noEmit`: só os 3 erros pré-existentes do projeto (em `professorService.ts:132`, `seriesService.ts:143`, `topicService.ts:202` — todos sobre tipos do `runAsync` do expo-sqlite, não relacionados ao bug)
- ✅ `npm run lint`: 0 errors, 28 warnings (todos pré-existentes)
- ✅ Smoke E2E manual via curl/Invoke-RestMethod:
  - `POST /catalog/professors {name: "Smoke CPF", doc_id: "39053344705"}` → 201 com `doc_id` no response
  - `GET /catalog` → professor aparece com `doc_id` intacto
  - `psql`: confirmou `Smoke CPF | 39053344705` na coluna `docId`; legados (Jorge/Vanessa) com `docId NULL`

---

## 5. O que ainda FALTA fazer quando voltar

### 5.1. Smoke no app real (nunca rodei o Expo)
- [ ] `npm start` na raiz, abrir o app
- [ ] Verificar que a **migration 010 roda no boot** sem erro (olhar log: `"Starting migration 010..."` → `"Migration 010 complete"`)
- [ ] Confirmar que o professor antigo (que aparecia com UUID) agora aparece como **"CPF não cadastrado"** na lista
- [ ] Editar esse professor, preencher CPF, salvar
- [ ] Pull-to-refresh na lista — CPF formatado deve continuar visível (NÃO virar UUID)
- [ ] Conferir via psql: `SELECT id, name, "docId" FROM "Professor"` deve mostrar o CPF que acabou de salvar

### 5.2. E2E Playwright (não criei ainda)
- [ ] Criar `tests/e2e/professor-cpf-roundtrip.spec.ts`
- Cenário: criar professor com CPF → pull-to-refresh → CPF formatado continua visível
- Usar a skill `expo-e2e-playwright` (`.claude/skills/expo-e2e-playwright/SKILL.md`)

### 5.3. Estado git (NADA commitado ainda)
```
modified:   docs/api/openapi.json
modified:   server/prisma/schema.prisma
modified:   server/src/routes/catalog.ts
modified:   server/src/services/catalogService.ts
modified:   server/test/catalog.mutations.test.ts
modified:   specs/007-sync-backend/contracts/error-codes.md
modified:   src/db/client.ts
modified:   src/db/migrations.ts
modified:   src/db/schema.ts
modified:   src/services/catalogSyncService.ts
modified:   src/services/professorService.ts
modified:   src/types/professor.ts
modified:   src/utils/cpf.ts
modified:   app/(tabs)/professors.tsx
modified:   app/professors/[id].tsx
new file:   tests/unit/migration_010.test.ts
new file:   server/prisma/migrations/0003_add_professor_doc_id/migration.sql
new file:   docs/todos/2026-05-03-cpf-professor-roundtrip.md (este arquivo)
```

Sugestão de divisão de commits (atomic):
1. `feat(server): add docId field to Professor for CPF round-trip`
   (schema.prisma, migration 0003, openapi.json, error-codes.md, catalog.ts, catalogService.ts)
2. `test(server): cover doc_id round-trip + duplicate + idempotency`
   (catalog.mutations.test.ts)
3. `fix(mobile): round-trip CPF through sync; drop NOT NULL on local doc_id`
   (schema.ts, migrations.ts, client.ts, types/professor.ts, professorService.ts, catalogSyncService.ts, cpf.ts, app/professors/[id].tsx, app/(tabs)/professors.tsx)
4. `test(mobile): regression guard for CPF round-trip + migration 010`
   (professorService.test.ts, catalogSyncService.test.ts, migration_010.test.ts)
5. `docs: handoff for CPF round-trip session`
   (docs/todos/...)

### 5.4. Nada para mexer (mas dignos de nota)
- Os 3 professores legados no Postgres (`Jorge Ferrari`, `Vanessa Ferrari`, `Jorge Ferrari joruge@gmail.com`) ficam com `docId NULL`. Quando alguém editar pelo app, vai gravar o CPF. Sem urgência.
- O rate limit test (`server/test/rateLimit.test.ts:29`) é flaky pré-existente — pode ser endereçado em outro momento.

---

## 6. Comandos úteis pra retomar

```powershell
# Backend up
cd C:\Users\pc_admin\source\repos\eb-analytics\server
docker compose up -d

# Mobile dev
cd C:\Users\pc_admin\source\repos\eb-analytics
npm start

# Re-rodar testes
cd server; npm test                    # backend
cd ..; npx jest                        # mobile
npx tsc --noEmit                       # type check

# Inspecionar Postgres
docker exec server-db-1 psql -U eb -d eb_insights -c 'SELECT id, name, "docId" FROM "Professor" ORDER BY "updatedAt" DESC;'

# Ver mudanças
git status; git diff --stat
```

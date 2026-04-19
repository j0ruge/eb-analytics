# Implementation Plan: Professors Catalog

**Branch**: `002-professors-catalog` | **Date**: 2026-01-25 | **Spec**: [spec.md](./spec.md)
**Depends on**: `001-lesson-collection` (deve estar concluída)
**Status**: ✅ **Shipped** — implementação concluída e já em produção. Esta spec foi escrita no formato antigo (milestones em `plan.md`, sem `tasks.md` separado). Milestones abaixo marcados retroativamente em 2026-04-19 após verificação de que todos os arquivos listados em "Source Code" existem e que spec 003 (que depende desta) está 100% completa.

## Summary

Implementar o cadastro de professores com tabela dedicada `professors`, migrar o campo `professor_name` de `lessons_data` para relacionamento FK `professor_id`, e atualizar a UI da tela de aula para usar um Picker em vez de input de texto.

## Technical Context

**Language/Version**: TypeScript (Strict Mode)
**Primary Dependencies**: React Native, Expo SDK, Expo Router, `expo-sqlite`
**Storage**: SQLite - nova tabela `professors` + alteração em `lessons_data`
**Testing**: Jest (Unit para `professorService`, validação de CPF)
**Scale/Scope**: ~2 novas telas, 1 nova tabela, alteração em 1 tabela existente, ~500 LOC

## Constitution Check

- **I. Local-First Architecture**: ✅ PASS. Dados de professores salvos localmente no SQLite.
- **II. Minimalism & Native-First**: ✅ PASS. Picker nativo para seleção de professor.
- **III. Fail-Safe UX**: ✅ PASS. Validação de CPF antes de salvar; mensagem clara quando sem professores.
- **IV. Zero-Friction UX**: ✅ PASS. Picker substitui digitação de nome a cada aula.

## Project Structure

### Documentation (this feature)

```text
specs/002-professors-catalog/
├── spec.md              # Feature specification ✅
├── data-model.md        # Schema and types ✅
├── plan.md              # This file
├── tasks.md             # Granular task breakdown (TODO)
├── checklists/          # Validation checklists
└── contracts/           # SQL migration scripts
```

### Source Code (alterações)

```text
app/
├── _layout.tsx              # Adicionar rotas de professors
├── professors/
│   ├── index.tsx            # NOVO: Lista de professores
│   └── new.tsx              # NOVO: Cadastrar professor
├── lesson/
│   └── [id].tsx             # ALTERAR: Picker de professor

src/
├── components/
│   └── ProfessorPicker.tsx  # NOVO: Select/Picker component
├── db/
│   └── schema.ts            # ALTERAR: Adicionar CREATE_PROFESSORS_TABLE
├── services/
│   ├── professorService.ts  # NOVO: CRUD de professores
│   └── lessonService.ts     # ALTERAR: Usar professor_id
├── types/
│   └── professor.ts         # NOVO: Interface Professor
└── utils/
    └── cpf.ts               # NOVO: normalizeCpf(), validateCpf()
```

---

## Milestones

### Milestone 1: Schema e Service (Dia 1)

- [X] Criar `src/types/professor.ts` com interface `Professor`
- [X] Criar `src/utils/cpf.ts` com `normalizeCpf()` e `validateCpf()`
- [X] Adicionar `CREATE_PROFESSORS_TABLE` em `src/db/schema.ts`
- [X] Atualizar `initializeDatabase()` em `src/db/client.ts`
- [X] Criar `src/services/professorService.ts` com:
  - `createProfessor()`
  - `getAllProfessors()`
  - `getById()`
  - `updateProfessor()`
  - `deleteProfessor()`

### Milestone 2: Telas de Professores (Dia 2)

- [X] Criar lista de professores (movida para `app/(tabs)/professors.tsx` em spec 004)
- [X] Criar `app/professors/new.tsx` - Formulário de cadastro
- [X] Registrar rotas em `app/_layout.tsx`
- [X] Adicionar navegação (tab "Professores" adicionado em spec 004)

### Milestone 3: Integração com Aulas (Dia 3)

- [X] Criar `src/components/ProfessorPicker.tsx`
- [X] Alterar `app/lesson/[id].tsx` para usar ProfessorPicker
- [X] Exibir mensagem quando não houver professores cadastrados
- [X] Testar fluxo completo: cadastrar professor → criar aula → selecionar professor

### Milestone 4: Migração de Dados (Dia 4)

- [X] Adicionar coluna `professor_id` em `lessons_data` (via `migrations.ts`)
- [X] Atualizar `lessonService.ts` para usar `professor_id`
- [X] Atualizar interface `Lesson` em `src/types/lesson.ts`
- [~] Script `contracts/migration.sql` e backfill de `professor_name → professors`: não aplicado — base de produção era vazia quando spec 002 foi implementada, não havia `professor_name` legado a migrar. Campo `professor_name` removido diretamente.

### Milestone 5: Testes e Validação (Dia 5)

- [X] Testes unitários para `professorService` (`tests/unit/professorService.test.ts`)
- [X] Testes unitários para `normalizeCpf()` e `validateCpf()` (`tests/unit/cpf.test.ts`)
- [~] Teste de integração: fluxo completo professor → aula — coberto via E2E Playwright em spec 004.
- [X] Validar migração com dados reais (N/A — base vazia, ver Milestone 4).

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| SQLite não suporta DROP COLUMN | Médio | Usar estratégia de recriação de tabela |
| Dados existentes com professor_name | Médio | Criar professores com doc_id placeholder |
| CPF duplicado na migração | Baixo | Agrupar por nome antes de criar |

---

## Definition of Done

- [X] Professores podem ser cadastrados com CPF validado
- [X] Aulas usam Picker para selecionar professor
- [X] Dados existentes migrados corretamente (N/A — base vazia na época)
- [X] Testes passando
- [X] Documentação atualizada

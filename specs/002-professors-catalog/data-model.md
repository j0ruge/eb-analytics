# Data Model: Professors Catalog

## Entity: Professor

**Source of Truth**: `professors` table in SQLite.

### Fields

| Field Name   | Type (SQLite) | TS Type  | Description                 | Default           |
| :----------- | :------------ | :------- | :-------------------------- | :---------------- |
| `id`         | TEXT (PK)     | `string` | UUID v4                     | Generated         |
| `doc_id`     | TEXT (UNIQUE) | `string` | CPF sem formatação (11 dig) | Required          |
| `name`       | TEXT          | `string` | Nome completo do professor  | Required          |
| `created_at` | TEXT          | `string` | Timestamp ISO 8601          | CURRENT_TIMESTAMP |

### TypeScript Interface

```typescript
export interface Professor {
  id: string;
  doc_id: string;      // CPF limpo (apenas números)
  name: string;
  created_at: string;
}
```

### SQL Schema

```sql
CREATE TABLE IF NOT EXISTS professors (
    id TEXT PRIMARY KEY NOT NULL,
    doc_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_professors_doc_id ON professors(doc_id);
CREATE INDEX IF NOT EXISTS idx_professors_name ON professors(name);
```

### Validations

- `doc_id`: Obrigatório, 11 dígitos numéricos, único
- `name`: Obrigatório, não vazio

### Helper Function (CPF Normalization)

```typescript
// Remove pontos, traços e espaços do CPF
export function normalizeCpf(cpf: string): string {
  return cpf.replace(/[\.\-\s]/g, '');
}
```

---

## Entity: Lesson (Alteração)

**Migração**: Substituir `professor_name` por `professor_id`.

### Alteração de Campos

| Campo Antigo      | Campo Novo     | Tipo         | Descrição                |
| :---------------- | :------------- | :----------- | :----------------------- |
| `professor_name`  | ~~removido~~   | -            | Deprecado                |
| -                 | `professor_id` | TEXT (FK)    | FK → `professors.id`     |

### TypeScript Interface (Atualizada)

```typescript
export interface Lesson {
  id: string;
  date: string;
  coordinator_name: string;
  professor_id: string;        // NOVO: FK para professors
  // professor_name: string;   // REMOVIDO
  series_name: string;
  lesson_title: string;
  time_expected_start: string;
  time_real_start: string | null;
  time_expected_end: string;
  time_real_end: string | null;
  attendance_start: number;
  attendance_mid: number;
  attendance_end: number;
  unique_participants: number;
  status: LessonStatus;
  created_at: string;
}
```

### SQL Migration

```sql
-- Step 1: Add new column (nullable)
ALTER TABLE lessons_data ADD COLUMN professor_id TEXT;

-- Step 2: Create index for FK
CREATE INDEX IF NOT EXISTS idx_lessons_professor_id ON lessons_data(professor_id);

-- Step 3: After data migration, remove old column
-- SQLite não suporta DROP COLUMN diretamente em versões antigas
-- Estratégia: Criar nova tabela, copiar dados, renomear
```

---

## Relacionamento

```
┌─────────────────┐       1:N       ┌─────────────────┐
│   professors    │◄────────────────│  lessons_data   │
├─────────────────┤                 ├─────────────────┤
│ id (PK)         │                 │ professor_id(FK)│
│ doc_id          │                 │ ...             │
│ name            │                 │                 │
└─────────────────┘                 └─────────────────┘

Um professor → várias aulas
Uma aula → exatamente um professor
```

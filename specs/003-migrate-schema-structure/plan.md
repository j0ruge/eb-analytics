# Implementation Plan: Migração do Schema para Estrutura Normalizada

**Branch**: `003-migrate-schema-structure` | **Date**: 2026-01-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-migrate-schema-structure/spec.md`

## Summary

Migrar o schema do banco de dados SQLite de uma estrutura desnormalizada (campos `series_name` e `lesson_title` como texto livre em `lessons_data`) para uma estrutura normalizada com tabelas dedicadas `lesson_series` e `lesson_topics`. A migração deve preservar todos os dados existentes, manter compatibilidade com funcionalidades atuais, e aplicar normalização automática de texto para agrupar variações.

## Technical Context

**Language/Version**: TypeScript 5.9 / React Native 0.81 / Expo SDK 54
**Primary Dependencies**: expo-sqlite 16.x, expo-router 6.x, uuid 9.x, React 19.1
**Storage**: SQLite via expo-sqlite (banco local: `ebd_insights.db`)
**Testing**: Jest 29.x com jest-expo
**Target Platform**: Mobile (iOS/Android) via Expo
**Project Type**: Mobile app com expo-router
**Performance Goals**: Seleção de série/tópico em <10s, sem degradação perceptível
**Constraints**: Offline-capable, migração sem perda de dados, rollback disponível
**Scale/Scope**: App local, centenas de registros de aulas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Simplicidade | PASS | Normalização de schema é padrão de indústria, não over-engineering |
| Compatibilidade | PASS | Campos legados mantidos durante transição |
| Testabilidade | PASS | Migração testável em cópia do banco |

## Project Structure

### Documentation (this feature)

```text
specs/003-migrate-schema-structure/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── schema.sql       # DDL para novas tabelas e migrações
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── client.ts           # Inicialização e migrações do banco
│   └── schema.ts           # DDL statements (MODIFICAR)
├── types/
│   ├── lesson.ts           # Tipo Lesson (MODIFICAR)
│   ├── professor.ts        # Tipo Professor (sem alteração)
│   ├── lessonSeries.ts     # NOVO: Tipo LessonSeries
│   └── lessonTopic.ts      # NOVO: Tipo LessonTopic
├── services/
│   ├── lessonService.ts    # Service de aulas (MODIFICAR)
│   ├── professorService.ts # Service de professores (sem alteração)
│   ├── seriesService.ts    # NOVO: Service de séries
│   └── topicService.ts     # NOVO: Service de tópicos
└── components/
    ├── SeriesPicker.tsx    # NOVO: Componente de seleção de série
    └── TopicPicker.tsx     # NOVO: Componente de seleção de tópico

app/
├── lesson/
│   ├── new.tsx             # Criar aula (MODIFICAR)
│   └── [id].tsx            # Editar aula (MODIFICAR)
├── series/                 # NOVO: Telas de séries (CRUD completo)
│   ├── index.tsx           # Lista de séries
│   ├── new.tsx             # Criar nova série
│   └── [id].tsx            # Detalhes/edição de série
├── topics/                 # NOVO: Telas de tópicos
│   ├── new.tsx             # Criar novo tópico (recebe seriesId)
│   └── [id].tsx            # Detalhes/edição de tópico
└── ...
```

**Structure Decision**: Estrutura mobile com expo-router. Novos arquivos seguem padrão existente de separação types/services/components.

## Complexity Tracking

> Nenhuma violação de princípios identificada.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

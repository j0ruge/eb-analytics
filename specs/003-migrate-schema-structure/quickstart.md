# Quickstart: Migração do Schema para Estrutura Normalizada

**Feature**: 003-migrate-schema-structure
**Date**: 2026-01-31

## Visão Geral

Esta feature migra o schema do banco de dados de campos de texto livre (`series_name`, `lesson_title`) para uma estrutura normalizada com tabelas dedicadas (`lesson_series`, `lesson_topics`).

## Pré-requisitos

- Feature 002-professors-catalog implementada
- Node.js e Expo CLI instalados
- Ambiente de desenvolvimento configurado

## Arquivos a Criar

### 1. Tipos (`src/types/`)

```bash
# Criar novos arquivos de tipos
src/types/lessonSeries.ts
src/types/lessonTopic.ts
```

### 2. Services (`src/services/`)

```bash
# Criar novos services
src/services/seriesService.ts
src/services/topicService.ts
```

### 3. Componentes (`src/components/`)

```bash
# Criar novos componentes de seleção
src/components/SeriesPicker.tsx
src/components/TopicPicker.tsx
```

### 4. Telas (`app/`)

```bash
# Criar telas de gerenciamento de séries (CRUD completo)
app/series/index.tsx      # Lista de séries
app/series/new.tsx        # Criar nova série
app/series/[id].tsx       # Detalhes/edição de série

# Criar telas de gerenciamento de tópicos
app/topics/new.tsx        # Criar novo tópico
app/topics/[id].tsx       # Detalhes/edição de tópico
```

## Arquivos a Modificar

### 1. Schema (`src/db/schema.ts`)

Adicionar DDL para novas tabelas:
- `CREATE_LESSON_SERIES_TABLE`
- `CREATE_LESSON_TOPICS_TABLE`
- `CREATE_INDEX_*` para índices

### 2. Client (`src/db/client.ts`)

Adicionar na função `initializeDatabase()`:
- Criação das novas tabelas
- Função de migração de dados

### 3. Tipo Lesson (`src/types/lesson.ts`)

Adicionar campo:
- `lesson_topic_id: string`

### 4. LessonService (`src/services/lessonService.ts`)

Modificar:
- `createLesson()`: exigir `lesson_topic_id`
- Adicionar: popular campos legados automaticamente

### 5. Tela de Nova Aula (`app/lesson/new.tsx`)

Modificar fluxo:
- Adicionar seleção de série
- Adicionar seleção de tópico (filtrado por série)

## Sequência de Implementação

```
1. Criar tipos (lessonSeries.ts, lessonTopic.ts)
   └── Sem dependências

2. Atualizar schema.ts (DDL das novas tabelas)
   └── Depende de: tipos

3. Criar services (seriesService.ts, topicService.ts)
   └── Depende de: tipos, schema

4. Atualizar client.ts (migração)
   └── Depende de: schema, services

5. Criar componentes (SeriesPicker, TopicPicker)
   └── Depende de: services

6. Atualizar lessonService.ts
   └── Depende de: tipos atualizados

7. Atualizar lesson/new.tsx e [id].tsx
   └── Depende de: componentes, lessonService
```

## Comandos de Desenvolvimento

```bash
# Instalar dependências (já presentes)
npm install

# Iniciar em modo desenvolvimento
npm run start

# Executar testes
npm run test

# Limpar cache do Expo (se necessário após migração)
npx expo start --clear
```

## Testando a Migração

### 1. Criar dados de teste (antes da migração)

```typescript
// Via console ou script
await lessonService.createLesson({
  series_name: "EB354",
  lesson_title: "Lição 01 - O Início"
});
await lessonService.createLesson({
  series_name: "eb354",  // variação
  lesson_title: "Lição 01 - O Início"
});
```

### 2. Executar migração

A migração é executada automaticamente ao inicializar o banco:
```typescript
await initializeDatabase();
```

### 3. Verificar resultados

```typescript
// Deve ter 1 série (normalizada)
const series = await seriesService.getAllSeries();
console.log(series); // [{ code: "EB354", ... }]

// Deve ter 1 tópico
const topics = await topicService.getTopicsBySeries(series[0].id);
console.log(topics); // [{ title: "Lição 01 - O Início", ... }]

// Aulas devem ter lesson_topic_id preenchido
const lessons = await lessonService.getAllLessons();
console.log(lessons[0].lesson_topic_id); // UUID do tópico
```

## Rollback

### Rollback Implícito (Recomendado)

Os campos legados (`series_name`, `lesson_title`) são **preservados e populados automaticamente** em cada criação de aula. Isso serve como mecanismo de rollback implícito:

- Se a nova estrutura falhar, o app pode voltar a usar os campos legados
- Nenhuma perda de dados ocorre pois ambos os formatos coexistem
- Queries antigas que usam `series_name`/`lesson_title` continuam funcionando

### Rollback Explícito (Se Necessário)

Em caso de falha crítica que requeira remoção completa:

1. Reverter código para usar campos legados
2. Ignorar `lesson_topic_id` nas queries
3. Opcionalmente, executar queries de rollback (ver `contracts/schema.sql`):
   ```sql
   DROP INDEX IF EXISTS idx_lessons_topic_id;
   DROP TABLE IF EXISTS lesson_topics;
   DROP TABLE IF EXISTS lesson_series;
   -- Nota: SQLite não suporta DROP COLUMN, manter lesson_topic_id como NULL
   ```

## Checklist de Verificação

- [ ] Novas tabelas criadas no banco
- [ ] Dados existentes migrados corretamente
- [ ] Variações de texto normalizadas
- [ ] Valores vazios tratados com entradas padrão
- [ ] Campos legados preservados
- [ ] Fluxo de criação de aula funcional
- [ ] Listagem de aulas exibe série/tópico
- [ ] Testes de regressão passando

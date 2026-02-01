# Research: Migração do Schema para Estrutura Normalizada

**Feature**: 003-migrate-schema-structure
**Date**: 2026-01-31

## 1. Estratégia de Migração SQLite

### Decision
Usar abordagem incremental com ALTER TABLE para adicionar novas colunas e criar novas tabelas, mantendo campos legados durante transição.

### Rationale
- SQLite suporta `ALTER TABLE ADD COLUMN` sem recriação de tabela
- Padrão já utilizado no projeto (migração de `professor_id` em feature 002)
- Permite rollback simples removendo referências às novas tabelas
- Evita downtime ao não precisar recriar tabela principal

### Alternatives Considered
1. **Recreate table (copy data)**: Mais limpo mas arriscado, requer downtime
2. **New database file**: Complexo demais para escopo atual

---

## 2. Normalização de Texto para Agrupamento

### Decision
Aplicar normalização antes de comparação: `UPPER(TRIM(value))`, removendo espaços extras internos.

### Rationale
- Clarificação definiu: normalizar automaticamente (uppercase, remover espaços)
- Simples de implementar em TypeScript antes de inserção
- Reversível (dados originais podem ser preservados em campo separado se necessário)

### Implementation
```typescript
function normalizeText(text: string): string {
  return text.toUpperCase().trim().replace(/\s+/g, ' ');
}
```

### Alternatives Considered
1. **Collation no SQLite**: Limitado, não remove espaços
2. **Preservar variações**: Rejeitado na clarificação

---

## 3. Geração de UUID para Novas Entidades

### Decision
Usar biblioteca `uuid` v4 já presente no projeto via `react-native-get-random-values`.

### Rationale
- Padrão já utilizado em `lessonService.createLesson()`
- Import: `import { v4 as uuidv4 } from 'uuid'`
- Compatível com React Native via polyfill existente

### Alternatives Considered
1. **Auto-increment**: Não recomendado para SQLite mobile com possível sync futuro
2. **Nanoid**: Adicionaria nova dependência desnecessária

---

## 4. Ordem de Execução da Migração

### Decision
Sequência de migração em 4 passos atômicos:

1. Criar tabelas `lesson_series` e `lesson_topics`
2. Popular `lesson_series` a partir de valores únicos normalizados de `series_name`
3. Popular `lesson_topics` a partir de valores únicos normalizados de `lesson_title` por série
4. Adicionar `lesson_topic_id` em `lessons_data` e popular via JOIN

### Rationale
- Cada passo pode ser verificado independentemente
- Falha em qualquer passo não corrompe dados existentes
- Campos legados preservados permitem verificação manual

### Rollback Strategy
- Remover coluna `lesson_topic_id` de `lessons_data`
- Dropar tabelas `lesson_topics` e `lesson_series`
- Campos legados continuam funcionais

---

## 5. Tratamento de Valores Vazios na Migração

### Decision
Criar entradas padrão para valores vazios:
- Série vazia → "SEM SÉRIE" (code: "SEM-SERIE")
- Tópico vazio → "SEM TÓPICO" (vinculado à série correspondente)

### Rationale
- Clarificação: registros com campos vazios recebem "Série não informada"
- Mantém integridade referencial
- Facilita identificação e correção manual posterior

### Alternatives Considered
1. **NULL no FK**: Rejeitado (campo definido como obrigatório)
2. **Bloquear migração**: Muito restritivo para dados legados

---

## 6. Padrão de Componentes Picker

### Decision
Criar componentes `SeriesPicker` e `TopicPicker` seguindo padrão do `ProfessorPicker` existente.

### Rationale
- Consistência visual e de UX com componente existente
- Reuso de padrões de seleção com busca
- `TopicPicker` dependente de série selecionada (filtro)

### Component Interface
```typescript
// SeriesPicker
interface SeriesPickerProps {
  selectedId: string | null;
  onSelect: (series: LessonSeries | null) => void;
}

// TopicPicker
interface TopicPickerProps {
  seriesId: string; // obrigatório - filtra por série
  selectedId: string | null;
  onSelect: (topic: LessonTopic | null) => void;
}
```

---

## 7. Atualização do Fluxo de Criação de Aula

### Decision
Modificar `app/lesson/new.tsx` e `lessonService.createLesson()` para:
1. Exigir seleção de série antes de tópico
2. Preencher `lesson_topic_id` obrigatoriamente
3. Manter preenchimento de campos legados para compatibilidade

### Rationale
- Clarificação: `lesson_topic_id` obrigatório imediatamente
- User Story 1: seleção de lista pré-cadastrada
- Campos legados facilitam debug e transição

### Flow
```
Novo Registro → Selecionar Série → Selecionar Tópico → Continuar fluxo existente
```

---

## 8. Índices de Banco de Dados

### Decision
Criar índices para otimizar queries frequentes:
- `idx_lesson_series_code` em `lesson_series(code)`
- `idx_lesson_topics_series_id` em `lesson_topics(series_id)`
- `idx_lesson_topics_sequence` em `lesson_topics(series_id, sequence_order)`
- `idx_lessons_topic_id` em `lessons_data(lesson_topic_id)`

### Rationale
- Busca por código de série frequente
- Listagem de tópicos por série frequente
- JOIN de aulas com tópicos frequente

---

## Summary

Todas as decisões técnicas foram tomadas com base em:
- Padrões já existentes no projeto
- Clarificações da especificação
- Simplicidade e reversibilidade

Nenhum NEEDS CLARIFICATION pendente para Phase 1.

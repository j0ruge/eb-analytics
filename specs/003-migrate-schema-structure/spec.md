# Feature Specification: Migração do Schema para Estrutura Normalizada

**Feature Branch**: `003-migrate-schema-structure`
**Created**: 2026-01-31
**Status**: Implemented
**Input**: Ajuste do schema atual para nova estrutura normalizada com lesson_series e lesson_topics, mantendo funcionalidades existentes sem quebras.

## Clarifications

### Session 2026-01-31

- Q: Como tratar variações de texto durante migração (ex: "EB354" vs "EB 354" vs "eb354")? → A: Normalizar automaticamente (uppercase, remover espaços extras)
- Q: Comportamento ao tentar excluir série com aulas vinculadas? → A: Impedir exclusão (exibir erro informando que há aulas vinculadas)
- Q: O campo lesson_topic_id em lessons_data é obrigatório ou opcional? → A: Obrigatório imediatamente (bloqueia registro sem tópico selecionado)
- Q: Validação entre suggested_date do tópico e data real da aula? → A: Sem validação (suggested_date é apenas informativo/referência)
- Q: Interface para criar novas séries/tópicos? → A: Telas dedicadas (app/series/) com CRUD completo

## Contexto

O sistema atual possui um schema simplificado onde informações de séries de lições e títulos são armazenados diretamente na tabela `lessons_data` como campos de texto livre (`series_name`, `lesson_title`). A nova estrutura propõe normalização com tabelas dedicadas para `lesson_series` e `lesson_topics`, permitindo melhor organização e relacionamento dos dados.

### Schema Atual

- **lessons_data**: Contém campos `series_name` e `lesson_title` como texto livre
- **professors**: Tabela normalizada existente com `id`, `doc_id`, `name`

### Schema Proposto

- **lesson_series**: Nova tabela para séries de lições (ex: "EB354 - Tempo de Despertar")
- **lesson_topics**: Nova tabela para tópicos/lições individuais vinculados a uma série
- **lessons_data**: Atualizada para referenciar `lesson_topic_id` em vez de texto livre
- **professors**: Mantida sem alterações

## User Scenarios & Testing

### User Story 1 - Registro de Aula com Estrutura Normalizada (Priority: P1)

O coordenador registra uma aula selecionando a série e o tópico de uma lista pré-cadastrada, em vez de digitar manualmente os nomes.

**Why this priority**: Esta é a funcionalidade central que justifica toda a migração. Sem ela, a nova estrutura não agrega valor.

**Independent Test**: Pode ser testado criando uma série com tópicos e registrando uma aula que referencia esse tópico. O registro deve aparecer corretamente com todas as informações.

**Acceptance Scenarios**:

1. **Given** uma série "EB354" com tópico "Lição 01 - O Início" cadastrados, **When** o coordenador registra uma nova aula selecionando este tópico, **Then** o sistema cria um registro em `lessons_data` vinculado ao `lesson_topic_id` correto
2. **Given** uma aula registrada com `lesson_topic_id`, **When** o usuário visualiza os detalhes da aula, **Then** o sistema exibe o nome da série e o título do tópico corretamente
3. **Given** nenhuma série cadastrada, **When** o coordenador tenta registrar uma aula, **Then** o sistema permite criar uma nova série e tópico antes de prosseguir

---

### User Story 2 - Gerenciamento de Séries e Tópicos (Priority: P2)

O administrador pode cadastrar, editar e visualizar séries de lições e seus respectivos tópicos com ordem sequencial.

**Why this priority**: Necessário para popular os dados que serão utilizados no registro de aulas, mas pode ser feito via seed inicial ou importação.

**Independent Test**: Pode ser testado criando uma série, adicionando múltiplos tópicos com ordem sequencial, e verificando a listagem ordenada.

**Acceptance Scenarios**:

1. **Given** acesso ao sistema, **When** o administrador cria uma nova série com código "EB354", título "Tempo de Despertar" e descrição, **Then** a série é armazenada e pode ser listada
2. **Given** uma série existente, **When** o administrador adiciona um tópico com título "Lição 01 - O Início", data prevista e ordem sequencial 1, **Then** o tópico é vinculado à série corretamente
3. **Given** uma série com 5 tópicos, **When** o usuário lista os tópicos, **Then** os tópicos aparecem ordenados por `sequence_order`

---

### User Story 3 - Migração de Dados Existentes (Priority: P1)

Os registros de aulas existentes devem ser migrados para a nova estrutura sem perda de dados ou funcionalidades.

**Why this priority**: Crítico para garantir continuidade do sistema. Dados existentes não podem ser perdidos.

**Independent Test**: Pode ser testado executando a migração em cópia do banco e verificando que todos os registros existentes continuam acessíveis e funcionais.

**Acceptance Scenarios**:

1. **Given** registros existentes com `series_name` e `lesson_title` como texto, **When** a migração é executada, **Then** séries e tópicos são criados automaticamente a partir dos valores únicos existentes
2. **Given** aulas existentes migradas, **When** o usuário acessa relatórios ou listagens, **Then** todas as informações aparecem corretamente como antes da migração
3. **Given** registros com `series_name` ou `lesson_title` vazios, **When** a migração é executada, **Then** o sistema cria entradas com valores padrão identificáveis (ex: "Série não informada")

---

### User Story 4 - Compatibilidade com Funcionalidades Existentes (Priority: P1)

Todas as funcionalidades existentes do sistema devem continuar funcionando após a migração: registro de aulas, seleção de professor, controle de presença, relatórios.

**Why this priority**: Garantir que não há regressão é fundamental para adoção da mudança.

**Independent Test**: Pode ser testado executando o conjunto completo de testes de regressão após a migração.

**Acceptance Scenarios**:

1. **Given** sistema migrado, **When** o coordenador registra presença durante a aula, **Then** os contadores `attendance_start`, `attendance_mid`, `attendance_end` funcionam normalmente
2. **Given** sistema migrado, **When** o coordenador seleciona um professor para a aula, **Then** o vínculo com `professor_id` funciona corretamente
3. **Given** sistema migrado, **When** o usuário gera relatórios de aulas, **Then** os relatórios exibem dados corretos incluindo série e tópico

---

### Edge Cases

- Exclusão de série com aulas vinculadas: sistema IMPEDE a exclusão e exibe mensagem de erro informando a quantidade de aulas vinculadas
- Tópicos duplicados na mesma série durante migração: normalização automática (uppercase, remoção de espaços) agrupa variações em uma única entrada
- Data prevista vs data real: `suggested_date` é apenas informativo/referência, sem validação (assumido como padrão)
- Registros de aula sem tópico: não permitido para novos registros (campo obrigatório); registros legados migrados recebem tópico automaticamente via normalização

## Requirements

### Functional Requirements

- **FR-001**: Sistema DEVE criar tabela `lesson_series` com campos: `id` (UUID), `code` (único), `title`, `description` (opcional)
- **FR-002**: Sistema DEVE criar tabela `lesson_topics` com campos: `id` (UUID), `series_id` (FK), `title`, `suggested_date`, `sequence_order`
- **FR-003**: Sistema DEVE alterar tabela `lessons_data` para incluir campo `lesson_topic_id` (FK para `lesson_topics`, obrigatório para novos registros)
- **FR-004**: Sistema DEVE manter campos legados `series_name` e `lesson_title` em `lessons_data` durante período de transição
- **FR-005**: Sistema DEVE permitir cadastro de séries de lições com código identificador único
- **FR-006**: Sistema DEVE permitir cadastro de tópicos vinculados a uma série com ordem sequencial
- **FR-007**: Sistema DEVE migrar dados existentes criando séries e tópicos a partir de valores únicos de `series_name` e `lesson_title`, aplicando normalização automática (uppercase, remoção de espaços extras) para agrupar variações
- **FR-008**: Sistema DEVE manter funcionamento de todas as telas existentes após a migração
- **FR-009**: Sistema DEVE impedir exclusão de séries que possuem aulas registradas, exibindo mensagem de erro com a quantidade de aulas vinculadas
- **FR-010**: Sistema DEVE ordenar tópicos por `sequence_order` ao exibir listagens
- **FR-011**: Sistema DEVE fornecer telas dedicadas para gerenciamento de séries (listar, criar, editar, visualizar)
- **FR-012**: Sistema DEVE fornecer telas dedicadas para gerenciamento de tópicos dentro de cada série

### Key Entities

- **Série de Lições (lesson_series)**: Representa uma revista/material de estudo. Contém código identificador (ex: "EB354"), título e descrição opcional. Uma série contém múltiplos tópicos.

- **Tópico de Lição (lesson_topics)**: Representa uma lição individual dentro de uma série. Contém título, data prevista conforme material, e ordem sequencial. Um tópico pertence a exatamente uma série.

- **Registro de Aula (lessons_data)**: Representa uma aula ministrada em data específica. Referencia um tópico, um professor, e contém dados de presença e horários reais. Mantém campos legados para compatibilidade durante transição.

- **Professor (professors)**: Entidade existente sem alterações. Contém identificação por CPF e nome.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% dos registros de aula existentes são acessíveis e exibidos corretamente após a migração
- **SC-002**: Tempo para registrar uma nova aula não aumenta mais que 20% comparado ao fluxo atual
- **SC-003**: Todas as funcionalidades existentes passam nos testes de regressão sem falhas
- **SC-004**: Coordenadores conseguem selecionar série e tópico em menos de 10 segundos durante registro de aula
- **SC-005**: Zero perda de dados durante o processo de migração
- **SC-006**: Sistema permite rollback para estrutura anterior em caso de falha crítica

## Assumptions

- O sistema utiliza SQLite como banco de dados local
- Não há requisitos de sincronização em tempo real com outros sistemas durante a migração
- Os campos `series_name` e `lesson_title` existentes possuem dados que podem ser normalizados (não são completamente inconsistentes)
- A migração pode ser executada com o sistema em modo de manutenção (indisponibilidade temporária é aceitável)
- Não há necessidade de manter compatibilidade com versões anteriores do aplicativo após a migração ser concluída

## Dependencies

- Feature 002-professors-catalog deve estar implementada (migração de `professor_id` já realizada)
- Biblioteca de geração de UUIDs já disponível no projeto

## Out of Scope

- Importação em lote de séries e tópicos via arquivo externo
- Sincronização com sistemas externos durante a migração
- Remoção dos campos legados `series_name` e `lesson_title` (será feito em fase posterior)

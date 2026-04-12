<div align="center">

# 📊 EB Insights

![Status](https://img.shields.io/badge/Status-MVP_Funcional-green)
![Plataforma](https://img.shields.io/badge/Plataforma-Mobile_(Expo)-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![SQLite](https://img.shields.io/badge/Storage-SQLite_(Local--First)-orange)

Um aplicativo **mobile-first** para coleta de dados de frequência e engajamento da Escola Bíblica (EB), com arquitetura **local-first** (offline-first).

</div>

---

[Funcionalidades](#-funcionalidades-implementadas) · [Telas](#-telas-do-aplicativo) · [Arquitetura](#️-arquitetura) · [Modelo de Dados](#️-modelo-de-dados) · [Tecnologias](#️-tecnologias) · [Como Executar](#-como-executar) · [Roadmap](#-roadmap)

---

## 🚀 Funcionalidades Implementadas

### ✅ Coleta de Dados (Spec 001)

- Formulário em 3 momentos: Início, Meio e Fim da aula
- Contadores de frequência com steppers (+ / -)
- Captura automática de horários com um toque
- Auto-save com debounce de 500ms
- Recuperação de aulas em andamento
- Exclusão de aulas em andamento (com confirmação e validação de status)

### ✅ Cadastro de Professores (Spec 002)

- Cadastro com validação de CPF (algoritmo oficial)
- Formatação automática do CPF na digitação
- Picker para seleção de professor na aula
- Proteção contra exclusão de professor com aulas vinculadas
- Migração automática de banco de dados existente

### ✅ Schema Normalizado (Spec 003)

- Tabelas dedicadas para séries de lições (`lesson_series`) e tópicos (`lesson_topics`)
- Seleção de série e tópico via Pickers (substituindo texto livre)
- Migração automática de dados existentes com normalização de texto
- CRUD completo para gerenciamento de séries e tópicos
- Proteção contra exclusão de séries com aulas vinculadas
- Campos legados preservados para compatibilidade

### ✅ Design e Experiência do Usuário (Spec 004)

- Navegação por abas (Bottom Tabs): Aulas, Painel, Séries, Professores, Sincronizar
- Sistema de temas com suporte a modo claro, escuro e automático (segue o sistema)
- Barra de filtros horizontais com multi-select por status na listagem de aulas
- Badges de status com ícones e cores distintas (Em Andamento, Completa, Exportada, Sincronizada)
- Componentes animados (AnimatedPressable com feedback tátil via Reanimated)
- Skeleton loaders para estados de carregamento
- Empty states e telas de erro com retry
- Floating Action Button (FAB) para criação rápida
- Date Picker nativo integrado ao formulário de aulas
- Tela de configurações com seleção de tema

### ✅ Export Data Contract v2 (Spec 005)

- Exportação JSON v2 com envelope tipado (`schema_version: "2.0"`)
- Resolução XOR automática: professor_id/professor_name, topic_id/topic_title, series_id/series_code_fallback
- `device_id` persistente via AsyncStorage (UUID v4 estável entre sessões)
- `client_updated_at` com precisão em milissegundos para reconciliação futura
- Toggle "Contei o professor nestas contagens" no formulário de aula (FR-019)
- Campos `weather` e `notes` (observações livres) no formulário de aula (FR-020)
- Padrão configurável para `includes_professor` nas Configurações (FR-021)
- Guard de exportação vazia com alerta em pt-BR (FR-008)
- Migração idempotente com backfill crash-safe de `client_updated_at`
- Seed service estendido para carregar dados de exemplo com os novos campos

### ✅ Dashboard de Estatísticas (Spec 009)

- Aba "Painel" com 5 gráficos interativos (react-native-gifted-charts)
- Gráfico de pontualidade (atraso em minutos por aula)
- Curva de presença (início/meio/fim por aula)
- Tendência de participantes únicos ao longo do tempo
- Taxa de atraso por aula
- Engajamento (participantes únicos vs presença)
- Tooltip interativo com navegação direta para a aula
- Cards com loading/error/success independentes (resilência per-card)
- Empty states por gráfico quando não há dados suficientes

---

## 📱 Telas do Aplicativo

### Abas Principais (Bottom Tabs)

| Tela | Descrição |
| ------ | ----------- |
| `/(tabs)/` | Lista de aulas com filtros de status, badges com ícones e cores |
| `/(tabs)/dashboard` | Painel de estatísticas com 5 gráficos interativos |
| `/(tabs)/series` | Lista de séries de lições com contagem de tópicos |
| `/(tabs)/professors` | Lista de professores cadastrados |
| `/(tabs)/sync` | Exportar dados (JSON v2) |

### Telas de Detalhe e Criação

| Tela | Descrição |
| ------ | ----------- |
| `/lesson/new` | Criar nova aula (com seleção de série/tópico) |
| `/lesson/[id]` | Formulário de coleta (3 momentos) + includes_professor + weather/notes + Finalizar/Excluir |
| `/professors/new` | Cadastrar novo professor |
| `/professors/[id]` | Editar professor |
| `/series/new` | Cadastrar nova série |
| `/series/[id]` | Detalhes da série com tópicos |
| `/topics/new` | Cadastrar novo tópico |
| `/topics/[id]` | Detalhes/edição do tópico |
| `/settings` | Configurações: tema + padrão includes_professor + seed de dados |

---

## 🏗️ Arquitetura

```text
┌──────────────────────────────────────────────────────────────┐
│                ThemeProvider (Light / Dark / System)          │
├──────────────────────────────────────────────────────────────┤
│              Expo Router (app/) + Bottom Tabs                │
├──────────────────────────────────────────────────────────────┤
│  Screens         │  Components          │  Services          │
│  - (tabs)/       │  - CounterStepper    │  - lessonService   │
│  - (tabs)/dash   │  - TimeCaptureBtn    │  - professorSvc    │
│  - lesson/[id]   │  - ProfessorPicker   │  - seriesService   │
│  - professors/   │  - SeriesPicker      │  - topicService    │
│  - series/       │  - TopicPicker       │  - exportService   │
│  - topics/       │  - StatusFilterBar   │  - deviceIdSvc     │
│  - settings      │  - DatePickerInput   │  - dashboardSvc    │
│                  │  - AnimatedPressable │  - seedService     │
│                  │  - FAB / EmptyState  │                    │
│                  │  - SkeletonLoader    │  Hooks             │
│                  │  - Charts (8 comps)  │  - useDebounce     │
│                  │  - ChartTooltip      │  - useTheme        │
│                  │  - ChartCard         │  - useChartCard    │
│                  │                      │  - useIncludesProf │
├──────────────────────────────────────────────────────────────┤
│                     SQLite (expo-sqlite)                      │
│                    📱 Local-First Storage                     │
└──────────────────────────────────────────────────────────────┘
```

**Princípios:**

- **Local-First**: SQLite é a única fonte de verdade
- **Zero-Friction UX**: Steppers e Pickers ao invés de teclado
- **Auto-Save**: Mudanças salvas automaticamente (debounce 500ms)
- **Fail-Safe**: Estado recuperável após fechar o app
- **Theming**: Suporte nativo a modo claro/escuro com tokens de design
- **Spec-Driven**: Cada feature tem especificação formal em `specs/`

---

## 🗄️ Modelo de Dados

### Tabela `lessons_data`

| Campo | Tipo | Descrição |
| ------- | ------ | ----------- |
| `id` | TEXT (UUID) | Identificador único |
| `date` | TEXT | Data da aula (YYYY-MM-DD) |
| `lesson_topic_id` | TEXT (FK) | Referência ao tópico |
| `professor_id` | TEXT (FK) | Referência ao professor |
| `coordinator_name` | TEXT | Nome do coordenador |
| `series_name` | TEXT | (Legado) Série de lições |
| `lesson_title` | TEXT | (Legado) Título da lição |
| `time_expected_start` | TEXT | Horário previsto início (10:00) |
| `time_real_start` | TEXT | Horário real início |
| `time_expected_end` | TEXT | Horário previsto término (11:00) |
| `time_real_end` | TEXT | Horário real término |
| `attendance_start` | INTEGER | Frequência no início |
| `attendance_mid` | INTEGER | Frequência no meio |
| `attendance_end` | INTEGER | Frequência no fim |
| `unique_participants` | INTEGER | Participantes únicos |
| `status` | TEXT | IN_PROGRESS / COMPLETED / EXPORTED / SYNCED |
| `created_at` | TEXT | Data de criação (ISO 8601) |
| `client_updated_at` | TEXT | Último update pelo client (ISO 8601 ms) |
| `includes_professor` | INTEGER | Se contagens incluem o professor (0/1) |
| `weather` | TEXT | Clima (texto livre, nullable) |
| `notes` | TEXT | Observações (texto livre, nullable) |

### Tabela `lesson_series`

| Campo | Tipo | Descrição |
| ------- | ------ | ----------- |
| `id` | TEXT (UUID) | Identificador único |
| `code` | TEXT (UNIQUE) | Código da série (ex: EB354) |
| `title` | TEXT | Título da série |
| `description` | TEXT | Descrição opcional |
| `created_at` | TEXT | Data de cadastro |

### Tabela `lesson_topics`

| Campo | Tipo | Descrição |
| ------- | ------ | ----------- |
| `id` | TEXT (UUID) | Identificador único |
| `series_id` | TEXT (FK) | Referência à série |
| `title` | TEXT | Título do tópico |
| `suggested_date` | TEXT | Data sugerida na revista |
| `sequence_order` | INTEGER | Ordem sequencial (1, 2, 3...) |
| `created_at` | TEXT | Data de cadastro |

### Tabela `professors`

| Campo | Tipo | Descrição |
| ------- | ------ | ----------- |
| `id` | TEXT (UUID) | Identificador único |
| `doc_id` | TEXT (UNIQUE) | CPF validado (11 dígitos) |
| `name` | TEXT | Nome completo |
| `created_at` | TEXT | Data de cadastro |

```mermaid
erDiagram
    lesson_series {
        TEXT id PK "UUID"
        TEXT code UK "Ex: EB354"
        TEXT title "Ex: Tempo de Despertar"
        TEXT description "Opcional"
        TEXT created_at "ISO 8601"
    }

    lesson_topics {
        TEXT id PK "UUID"
        TEXT series_id FK "Ref: lesson_series.id"
        TEXT title "Ex: Licao 01 - O Inicio"
        TEXT suggested_date "Data prevista na revista"
        INTEGER sequence_order "Ex: 1, 2, 3..."
        TEXT created_at "ISO 8601"
    }

    professors {
        TEXT id PK "UUID v4"
        TEXT doc_id UK "CPF (Unico, 11 digitos)"
        TEXT name "Nome Completo"
        TEXT created_at "ISO 8601"
    }

    lessons_data {
        TEXT id PK "UUID"
        TEXT date "YYYY-MM-DD"
        TEXT lesson_topic_id FK "Ref: lesson_topics.id"
        TEXT professor_id FK "Ref: professors.id"
        TEXT coordinator_name
        TEXT series_name "Legado"
        TEXT lesson_title "Legado"
        TEXT time_expected_start
        TEXT time_real_start "Nullable"
        TEXT time_expected_end
        TEXT time_real_end "Nullable"
        INTEGER attendance_start
        INTEGER attendance_mid
        INTEGER attendance_end
        INTEGER unique_participants
        TEXT status "Enum"
        TEXT created_at "ISO 8601"
        TEXT client_updated_at "ISO 8601 ms"
        INTEGER includes_professor "0 ou 1"
        TEXT weather "Nullable"
        TEXT notes "Nullable"
    }

    lesson_series ||--|{ lesson_topics : contem
    lesson_topics ||--o{ lessons_data : ministrada_em
    professors ||--o{ lessons_data : ministra
```

---

## 🛠️ Tecnologias

- **React Native** 0.81 + **Expo SDK 54**
- **React** 19.1
- **Expo Router** 6.x (File-based routing com Bottom Tabs)
- **TypeScript** 5.9 (Strict mode)
- **SQLite** (`expo-sqlite` 16.x) — Local-first storage
- **React Native Reanimated** 4.x (Animações performáticas)
- **react-native-gifted-charts** (Gráficos do dashboard)
- **AsyncStorage** (`@react-native-async-storage`) — Preferências do usuário
- **DateTimePicker** (`@react-native-community/datetimepicker`) — Seleção de datas nativa
- **Jest** + **Testing Library** (Testes unitários)
- **Playwright** (Testes E2E via Expo Web)

---

## 🧪 Testes

```bash
# Testes unitários (9 suites, 109 tests)
npm test

# Testes E2E (requer Expo Web rodando na porta 8082)
npm run test:e2e
```

### Cobertura de Testes

| Tipo | Suites | Arquivos |
|------|--------|----------|
| Unit — Services | 5 | exportService, lessonService, professorService, dashboardService, seedService |
| Unit — Utilities | 2 | cpf, date |
| Unit — Components | 1 | DatePickerInput |
| Unit — Migrations | 1 | dbMigration (idempotência, backfill, preservação de status) |
| E2E — UI Flows | 6 | app-loads, empty-export-guard, field-persistence, includes-professor-toggle, seed-and-lesson-detail, settings-default-toggle |

---

## 🚀 Como Executar

```bash
# Instalar dependências (flag --legacy-peer-deps obrigatória, ver nota abaixo)
npm install --legacy-peer-deps

# Iniciar servidor de desenvolvimento
npm start

# Executar testes unitários
npm test

# Executar testes E2E (em outro terminal, com Expo Web rodando)
npm run test:e2e
```

> **Por que `--legacy-peer-deps`?**
> O projeto usa React 19 com Expo SDK 54, mas algumas dependências de teste ainda declaram `react@^18` como peer dependency. A flag ignora essas checagens.

**Requisitos:**

- Node.js 18+
- Expo Go no celular (Android/iOS)

---

## 📦 Gerar Build APK (Android)

### Método 1: EAS Build (Recomendado - Build na Nuvem)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

### Método 2: Build Local (Requer Android Studio)

```bash
npx expo install expo-dev-client
npx expo run:android
```

**Perfis de build** (`eas.json`): `development` · `preview` · `production`

---

## 📁 Estrutura do Projeto

```text
app/                    # Telas (Expo Router)
├── _layout.tsx         # Root layout (DB init, ThemeProvider)
├── (tabs)/             # Bottom Tab Navigator
│   ├── _layout.tsx     # Configuração das abas
│   ├── index.tsx       # Aba Aulas — Lista com filtros
│   ├── dashboard.tsx   # Aba Painel — 5 gráficos interativos
│   ├── series.tsx      # Aba Séries — Lista de séries
│   ├── professors.tsx  # Aba Professores — Lista
│   └── sync.tsx        # Aba Sincronizar — Export JSON v2
├── lesson/             # Formulário de coleta
├── professors/         # CRUD de professores
├── series/             # CRUD de séries de lições
├── topics/             # CRUD de tópicos
└── settings.tsx        # Configurações (tema + padrões)

src/
├── components/         # CounterStepper, TimeCaptureButton, Pickers,
│   │                   # StatusFilterBar, AnimatedPressable, FAB,
│   │                   # DatePickerInput, SkeletonLoader, EmptyState, ErrorRetry
│   └── charts/         # ChartCard, ChartTooltip, DashboardEmptyState,
│                       # PunctualityChart, TrendChart, AttendanceCurveRow,
│                       # LateArrivalChart, EngagementChart
├── db/                 # Schema, migrations, cliente SQLite
├── hooks/              # useDebounce, useTheme, useThemePreference,
│                       # useIncludesProfessorDefault, useChartCardState
├── services/           # lessonService, professorService, seriesService,
│                       # topicService, exportService, deviceIdService,
│                       # dashboardService, seedService
├── theme/              # Tokens de design, cores, tipografia, ThemeProvider
├── types/              # Lesson, Professor, Series, Topic, dashboard types
└── utils/              # CPF, normalização de texto, datas, cores

specs/                  # Especificações (Spec-Driven Dev)
├── 001-lesson-collection/
├── 002-professors-catalog/
├── 003-migrate-schema-structure/
├── 004-improve-app-design/
├── 005-export-contract-v2/
├── 006-auth-identity/         # Próxima
├── 007-sync-backend/
├── 008-offline-sync-client/
└── 009-statistics-dashboard/

tests/
├── unit/               # 9 suites, 109 testes
└── e2e/                # 6 specs Playwright (Expo Web)
```

---

## 📋 Roadmap

- [x] **Spec 001**: Coleta de dados (formulário 3 momentos)
- [x] **Spec 002**: Cadastro de professores com CPF
- [x] **Spec 003**: Migração para schema normalizado (lesson_series/lesson_topics)
- [x] **Spec 004**: Design e experiência do usuário (temas, tabs, animações, filtros)
- [x] **Spec 005**: Export Data Contract v2 (envelope tipado, XOR, device_id, includes_professor, weather/notes)
- [ ] **Spec 006**: Autenticação e identidade do coletor
- [ ] **Spec 007**: Backend de sincronização
- [ ] **Spec 008**: Cliente de sincronização offline
- [x] **Spec 009**: Dashboard de estatísticas (5 gráficos interativos)

---

## 📖 Histórias de Usuário

| ID | Persona | Desejo | Status |
| ---- | --------- | -------- | -------- |
| US01 | Coordenador | Preencher dados da aula em formulário mobile | ✅ |
| US02 | Coordenador | Visualizar variação de público (Início/Meio/Fim) | ✅ |
| US03 | Diretor | Contar participantes únicos (engajamento) | ✅ |
| US04 | Diretor | Cruzar presença/engajamento com professor | ✅ |
| US05 | Diretor | Comparar por Série/Título da Lição | ✅ |
| US06 | Coordenador | Registrar horários reais de início/fim | ✅ |
| US07 | Admin | Gerenciar séries e tópicos de lições | ✅ |
| US08 | Coordenador | Excluir aulas criadas por engano (apenas IN_PROGRESS) | ✅ |
| US09 | Coordenador | Filtrar aulas por status para reduzir poluição visual | ✅ |
| US10 | Coordenador | Navegar pelo app com visual moderno e suporte a modo escuro | ✅ |
| US11 | Coordenador | Exportar dados em formato estruturado para análise externa | ✅ |
| US12 | Coordenador | Indicar se contou o professor nas presenças | ✅ |
| US13 | Coordenador | Registrar clima e observações livres sobre a aula | ✅ |
| US14 | Diretor | Visualizar estatísticas de pontualidade, presença e engajamento | ✅ |

---

## 📊 Métricas Capturadas

- **Logística:** Data, Horários Previstos e Reais, Clima
- **Conteúdo:** Professor, Série de Lições, Tópico
- **Frequência:** Público no Início, Meio e Fim da aula + flag includes_professor
- **Engajamento:** Participantes únicos (pessoas distintas que falaram)
- **Observações:** Notas livres sobre a aula

---

## TROUBLESHOOTINGS

Você pode encontrar soluções para problemas comuns no arquivo [Troubleshootings.md](./Troubleshootings.md).

---

## 📄 Licença

Projeto desenvolvido para uso interno da Escola Bíblica.

# 📊 EB Insights

![Status](https://img.shields.io/badge/Status-MVP_Funcional-green)
![Plataforma](https://img.shields.io/badge/Plataforma-Mobile_(Expo)-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![SQLite](https://img.shields.io/badge/Storage-SQLite_(Local--First)-orange)

Um aplicativo **mobile-first** para coleta de dados de frequência e engajamento da Escola Bíblica (EBD), com arquitetura **local-first** (offline-first).

---

## 🚀 Funcionalidades Implementadas

### ✅ Coleta de Dados (Feature 001)

- Formulário em 3 momentos: Início, Meio e Fim da aula
- Contadores de frequência com steppers (+ / -)
- Captura automática de horários com um toque
- Auto-save com debounce de 500ms
- Recuperação de aulas em andamento

### ✅ Cadastro de Professores (Feature 002)

- Cadastro com validação de CPF (algoritmo oficial)
- Formatação automática do CPF na digitação
- Picker para seleção de professor na aula
- Proteção contra exclusão de professor com aulas vinculadas
- Migração automática de banco de dados existente

---

## 📱 Telas do Aplicativo

| Tela | Descrição |
|------|-----------|
| `/` | Lista de aulas com status e professor |
| `/lesson/new` | Criar nova aula |
| `/lesson/[id]` | Formulário de coleta (3 momentos) |
| `/professors` | Lista de professores cadastrados |
| `/professors/new` | Cadastrar novo professor |
| `/sync` | Exportar dados (JSON) |

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Expo Router (app/)                   │
├─────────────────────────────────────────────────────────┤
│  Screens        │  Components       │  Services         │
│  - index.tsx    │  - CounterStepper │  - lessonService  │
│  - lesson/[id]  │  - TimeCaptureBtn │  - professorSvc   │
│  - professors/  │  - ProfessorPicker│  - exportService  │
├─────────────────────────────────────────────────────────┤
│                    SQLite (expo-sqlite)                 │
│                   📱 Local-First Storage                │
└─────────────────────────────────────────────────────────┘
```

**Princípios:**

- **Local-First**: SQLite é a única fonte de verdade
- **Zero-Friction UX**: Steppers e Pickers ao invés de teclado
- **Auto-Save**: Mudanças salvas automaticamente (debounce 500ms)
- **Fail-Safe**: Estado recuperável após fechar o app

---

## 🗄️ Modelo de Dados

### Tabela `lessons_data`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | TEXT (UUID) | Identificador único |
| `date` | TEXT | Data da aula (YYYY-MM-DD) |
| `professor_id` | TEXT (FK) | Referência ao professor |
| `lesson_title` | TEXT | Título da lição |
| `series_name` | TEXT | Série de lições |
| `time_expected_start` | TEXT | Horário previsto início (09:00) |
| `time_real_start` | TEXT | Horário real início |
| `time_expected_end` | TEXT | Horário previsto término (10:15) |
| `time_real_end` | TEXT | Horário real término |
| `attendance_start` | INTEGER | Frequência no início |
| `attendance_mid` | INTEGER | Frequência no meio |
| `attendance_end` | INTEGER | Frequência no fim |
| `unique_participants` | INTEGER | Participantes únicos |
| `status` | TEXT | IN_PROGRESS / COMPLETED / SYNCED |

### Tabela `professors`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | TEXT (UUID) | Identificador único |
| `doc_id` | TEXT (UNIQUE) | CPF validado (11 dígitos) |
| `name` | TEXT | Nome completo |
| `created_at` | TEXT | Data de cadastro |

---

## 🛠️ Tecnologias

- **React Native** + **Expo SDK 54**
- **Expo Router** (File-based routing)
- **TypeScript** (Strict mode)
- **SQLite** (`expo-sqlite`)
- **Jest** (Testes unitários)

---

## 🚀 Como Executar

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm start

# Executar testes
npx jest
```

**Requisitos:**

- Node.js 18+
- Expo Go no celular (Android/iOS)

---

## 📁 Estrutura do Projeto

```
app/                    # Telas (Expo Router)
├── index.tsx           # Home - Lista de aulas
├── lesson/[id].tsx     # Formulário de coleta
├── professors/         # CRUD de professores
└── sync/               # Exportação de dados

src/
├── components/         # CounterStepper, TimeCaptureButton, ProfessorPicker
├── db/                 # Schema e cliente SQLite
├── services/           # Lógica de negócio (CRUD)
├── types/              # Interfaces TypeScript
├── hooks/              # useDebounce
└── utils/              # Validação de CPF

specs/                  # Especificações (Spec-Driven Dev)
tests/                  # Testes unitários
```

---

## 📋 Roadmap

- [x] **Feature 001**: Coleta de dados (formulário 3 momentos)
- [x] **Feature 002**: Cadastro de professores com CPF
- [ ] **Feature 003**: Dashboard local com métricas
- [ ] **Feature 004**: Sincronização com API na nuvem
- [ ] **Feature 005**: Relatórios PDF/Excel

---

## 📖 Histórias de Usuário

| ID | Persona | Desejo | Status |
|----|---------|--------|--------|
| US01 | Coordenador | Preencher dados da aula em formulário mobile | ✅ Implementado |
| US02 | Coordenador | Visualizar variação de público (Início/Meio/Fim) | ✅ Implementado |
| US03 | Diretor | Contar participantes únicos (engajamento) | ✅ Implementado |
| US04 | Diretor | Cruzar presença/engajamento com professor | 🔄 Parcial |
| US05 | Diretor | Comparar por Série/Título da Lição | ⏳ Pendente |
| US06 | Coordenador | Registrar horários reais de início/fim | ✅ Implementado |

---

## 📊 Métricas Capturadas

- **Logística:** Data, Horários Previstos e Reais
- **Conteúdo:** Professor, Série de Lições, Título
- **Frequência:** Público no Início, Meio e Fim da aula
- **Engajamento:** Participantes únicos (pessoas distintas que falaram)

---

## 📄 Licença

Projeto desenvolvido para uso interno da Escola Bíblica.

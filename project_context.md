# EB Insights - Project Context

Este arquivo serve como referência para o Claude em prompts futuros sobre este projeto.

## Visão Geral

**Nome:** EB Insights (anteriormente "EBD Insights")
**Propósito:** Aplicativo de coleta de dados para Escola Bíblica - registro de aulas, frequência e professores
**Tipo:** Aplicação Expo/React Native multiplataforma (Android, iOS, Web)

## Stack Tecnológica

| Componente | Tecnologia | Versão |
|------------|------------|--------|
| Runtime | Expo SDK | 54.0.33 |
| UI Framework | React | 19.1.0 |
| Mobile Framework | React Native | 0.81.5 |
| Web Support | react-native-web | 0.21.2 |
| Roteamento | Expo Router | 6.0.23 |
| Banco de Dados | SQLite (expo-sqlite) | 16.0.10 |
| Linguagem | TypeScript | 5.9.2 |
| Build Tool | Babel + Metro | - |
| Testes | Jest + jest-expo | 29.7.0 |

## Estrutura do Projeto

```
eb-analytics/
├── app/                           # Expo Router - telas (file-based routing)
│   ├── _layout.tsx               # Layout raiz com Stack navigation
│   ├── index.tsx                 # Tela inicial - lista de aulas
│   ├── lesson/
│   │   ├── new.tsx              # Criar nova aula
│   │   └── [id].tsx             # Detalhes da aula (formulário de coleta)
│   ├── professors/
│   │   ├── index.tsx            # Lista de professores
│   │   └── new.tsx              # Cadastrar novo professor
│   └── sync/
│       └── index.tsx            # Tela de sincronização/exportação
│
├── src/                          # Código fonte
│   ├── components/               # Componentes React reutilizáveis
│   │   ├── CounterStepper.tsx   # Contador incremental
│   │   ├── ProfessorPicker.tsx  # Seletor de professor
│   │   └── TimeCaptureButton.tsx # Botão de captura de horário
│   ├── db/                       # Camada de banco de dados SQLite
│   │   ├── client.ts            # Inicialização e migrações
│   │   └── schema.ts            # Definições SQL das tabelas
│   ├── services/                 # Lógica de negócio
│   │   ├── lessonService.ts     # CRUD de aulas
│   │   ├── professorService.ts  # CRUD de professores
│   │   └── exportService.ts     # Exportação de dados
│   ├── types/                    # Interfaces TypeScript
│   │   ├── lesson.ts
│   │   └── professor.ts
│   ├── hooks/                    # Custom React hooks
│   │   └── useDebounce.ts
│   ├── theme/                    # Configuração de tema UI
│   │   └── index.ts
│   └── utils/                    # Funções utilitárias
│       └── cpf.ts               # Validação de CPF
│
├── assets/                       # Ícones e splash screens
├── tests/                        # Testes unitários Jest
├── specs/                        # Especificações (spec-driven development)
├── app.json                      # Configuração Expo
├── babel.config.js              # Configuração Babel
├── metro.config.js              # Configuração Metro bundler
├── tsconfig.json                # Configuração TypeScript
└── package.json                 # Dependências
```

## Arquitetura

### Padrão: Local-First, Offline-First

```
┌─────────────────────────────────────────┐
│    Expo Router (File-based Routing)     │
├─────────────────────────────────────────┤
│  Telas (app/)                           │
│  ├── Gestão de Aulas (CRUD)            │
│  ├── Catálogo de Professores (CRUD)    │
│  └── Sincronização & Exportação        │
├─────────────────────────────────────────┤
│  Componentes (src/components/)          │
├─────────────────────────────────────────┤
│  Camada de Serviços (src/services/)     │
├─────────────────────────────────────────┤
│  SQLite Database (expo-sqlite)          │
│  ├── lessons_data                       │
│  ├── professors                         │
│  └── Migrações automáticas             │
└─────────────────────────────────────────┘
```

## Banco de Dados

### Tabela: lessons_data
- `id` (TEXT PRIMARY KEY) - UUID
- `date` (TEXT) - Data da aula
- `professor_id` (TEXT) - FK para professors
- `professor_name` (TEXT) - Nome do professor
- `series_name` (TEXT) - Nome da série/trimestre
- `lesson_title` (TEXT) - Título da lição
- `time_expected_start/end` (TEXT) - Horários previstos
- `time_real_start/end` (TEXT) - Horários reais
- `attendance_start/mid/end` (INTEGER) - Frequência em 3 momentos
- `unique_participants` (INTEGER) - Participantes únicos
- `status` (TEXT) - IN_PROGRESS, COMPLETED, SYNCED
- Índices: status, date, professor_id

### Tabela: professors
- `id` (TEXT PRIMARY KEY) - UUID
- `doc_id` (TEXT UNIQUE) - CPF
- `name` (TEXT) - Nome completo
- `created_at` (TEXT) - Data de criação
- Índices: doc_id, name

## Scripts Disponíveis

```bash
npm start          # Inicia servidor dev (escolha plataforma)
npm run android    # Desenvolvimento Android
npm run ios        # Desenvolvimento iOS
npm run web        # Desenvolvimento Web (browser)
npm test           # Executa testes Jest
```

## Funcionalidades Implementadas

- [x] Formulário de coleta de dados (captura em 3 momentos: início, meio, fim)
- [x] Gestão de professores com validação de CPF
- [x] Captura automática de horário com auto-save debounced
- [x] Rastreamento de status das aulas
- [x] Funcionalidade de exportação de dados
- [x] Migrações de banco de dados
- [x] TypeScript strict mode
- [x] Setup de testes com Jest
- [x] Suporte multiplataforma (Android, iOS, Web)

## Configurações Importantes

### Path Alias
O projeto usa `@/*` como alias para `./src/*` (configurado em tsconfig.json)

```typescript
import { lessonService } from '@/services/lessonService';
```

### Expo Router
- Typed routes habilitado em app.json
- File-based routing no diretório `app/`
- Layout Stack como navegação principal

### Web Support
- Bundler: Metro
- Output: single (SPA)
- SQLite na web usa WASM + OPFS

## Convenções do Projeto

1. **Serviços:** Toda lógica de negócio e acesso a dados fica em `src/services/`
2. **Tipos:** Interfaces TypeScript em `src/types/`
3. **Componentes:** Componentes reutilizáveis em `src/components/`
4. **Hooks:** Custom hooks em `src/hooks/`
5. **Testes:** Arquivos de teste em `tests/` com sufixo `.test.ts`

## Notas para Desenvolvimento

- O banco SQLite é inicializado automaticamente no primeiro uso
- Migrações são aplicadas automaticamente em `db/client.ts`
- O app funciona offline por padrão (local-first)
- Validação de CPF implementada em `src/utils/cpf.ts`

---

**Última atualização:** 2026-01-31

# EB Insights Constitution

## Core Principles

### I. Local-First Architecture

SQLite é a **única fonte de verdade**. Todas as operações devem funcionar offline.

- Dados persistem localmente via expo-sqlite
- Nenhuma feature pode depender de conectividade para funcionar
- Sincronização com cloud (quando implementada) é secundária e assíncrona
- Estado do app deve ser recuperável após fechar/reabrir

### II. Zero-Friction UX

Priorizar **Pickers e Steppers** sobre entrada de texto manual.

- Campos numéricos usam CounterStepper (+ / -)
- Seleções usam Picker/Modal ao invés de digitação livre
- Captura de horário com um toque (TimeCaptureButton)
- Minimizar teclado virtual sempre que possível

### III. Auto-Save & Fail-Safe

Mudanças são salvas **automaticamente** com debounce de 500ms.

- Usuário nunca precisa clicar "Salvar" explicitamente
- Aulas IN_PROGRESS são recuperáveis após crash
- Estado parcial é melhor que perda de dados
- Debounce evita escritas excessivas no banco

### IV. Backward Compatibility

Migrações de schema devem **preservar dados existentes**.

- Novos campos devem ter defaults ou valores migrados
- Campos legados podem ser mantidos durante transição
- Migrations são idempotentes (podem rodar múltiplas vezes)
- Rollback implícito via campos legados quando aplicável

### V. Separation of Concerns

Estrutura de código segue **separação clara de responsabilidades**.

```
src/
├── types/      # Interfaces TypeScript (dados puros)
├── db/         # Schema, migrations, client SQLite
├── services/   # Lógica de negócio (CRUD, validação)
├── components/ # UI reutilizável (Pickers, Steppers)
├── hooks/      # Custom hooks React
└── utils/      # Funções utilitárias puras

app/            # Telas (Expo Router, file-based)
```

- Services não conhecem UI
- Components não acessam banco diretamente
- Types não têm dependências

## Technology Stack

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Framework | React Native + Expo | SDK 54 |
| Navegação | Expo Router | 6.x |
| Linguagem | TypeScript | 5.9 (strict) |
| Banco de Dados | SQLite (expo-sqlite) | 16.x |
| Testes | Jest + jest-expo | 29.x |
| IDs | UUID v4 | 9.x |

## Quality Gates

### Pre-Implementation

- [ ] Feature specification (spec.md) aprovada
- [ ] Clarificações de escopo resolvidas
- [ ] Migrações de dados planejadas (se aplicável)

### Pre-Release

- [ ] Todas as tasks marcadas como complete
- [ ] App executa sem erros no Expo Go
- [ ] Dados existentes preservados após migração
- [ ] Campos legados populados para compatibilidade

## Governance

- Constitution supersedes preferências individuais
- Amendments require documentation and migration plan
- Use `/speckit.constitution` for updates

**Version**: 1.0.0 | **Ratified**: 2026-01-31 | **Last Amended**: 2026-01-31

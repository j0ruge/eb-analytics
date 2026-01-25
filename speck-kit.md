
---

### 1️⃣ Comando: `/speckit.constitution`

*(Este comando define as "regras do jogo", a stack e a filosofia do projeto)*

```markdown
/speckit.constitution

# Identidade do Projeto
Nome: EB Insights (App Mobile)
Propósito: Aplicativo de coleta de dados locais (offline-first) para gestão e BI da Escola Bíblica.

# Stack Tecnológica Principal
- Linguagem: TypeScript (Strict mode).
- Framework Mobile: React Native com Expo (foco em rodar no Expo Go).
- Navegação: Expo Router (File-based routing).
- Banco de Dados Local: SQLite (`expo-sqlite/next`).
- Estilização: StyleSheet nativo do React Native (minimalista, sem bibliotecas pesadas de UI).

# Princípios de Arquitetura e Engenharia
1. Local-First: Toda entrada de dados é salva imediatamente no SQLite local. A rede (internet) não é um bloqueador para o uso do app.
2. Minimalismo: Uso mínimo de bibliotecas externas. Priorizar APIs nativas do Expo.
3. Fail-Safe UX: O formulário é dividido em 3 momentos temporais. O estado atual da aula "em andamento" deve ser recuperado do SQLite automaticamente caso o app seja fechado e reaberto.
4. Exportação Desacoplada: Os dados coletados localmente serão exportados (JSON/Sync API) posteriormente, desacoplando o app mobile da ferramenta de BI.

# Princípios de UX/UI
1. Zero Digitação (Sempre que possível): Preferir Steppers (+ e -) e Selects nativos em vez de inputs de texto livre.
2. Captura Automática: Horários devem ser capturados do relógio do sistema com um toque.

```

---

### 2️⃣ Comando: `/speckit.specify`

*(Este comando detalha os schemas, o banco SQLite e o comportamento das telas baseados nas suas User Stories)*

```markdown
/speckit.specify

# Domínio: Coleta de Dados (EB Insights)

## 1. Schema do Banco de Dados Local (SQLite)
Tabela principal: `lessons_data`
- `id` (TEXT, UUID, PK)
- `date` (TEXT, ISO8601)
- `coordinator_name` (TEXT)
- `professor_name` (TEXT)
- `series_name` (TEXT)
- `lesson_title` (TEXT)
- `time_expected_start` (TEXT, HH:MM)
- `time_real_start` (TEXT, HH:MM)
- `time_expected_end` (TEXT, HH:MM)
- `time_real_end` (TEXT, HH:MM)
- `attendance_start` (INTEGER)
- `attendance_mid` (INTEGER)
- `attendance_end` (INTEGER)
- `unique_participants` (INTEGER)
- `status` (TEXT) - Enum: 'IN_PROGRESS', 'COMPLETED', 'SYNCED'
- `created_at` (TEXT, timestamp)

## 2. Fluxo de Navegação (Expo Router)
- `/`: Tela inicial com lista de aulas recentes e botão "Nova Aula".
- `/lesson/new`: Inicia uma nova aula (Cria registro no SQLite com status 'IN_PROGRESS').
- `/lesson/[id]`: Tela do Formulário (Onde ocorre a mágica).

## 3. Especificação da Tela de Coleta (Wireframe V2.0)
A tela `/lesson/[id]` deve ser renderizada baseada nos 3 momentos:

**Componentes Principais:**
- `CounterStepper`: Componente customizado com botões [ - ] e [ + ] que atualiza o valor no banco a cada toque (debounce de 500ms).
- `TimeCaptureButton`: Botão que captura `Date.now()`, formata para 'HH:MM' e salva no campo correspondente (time_real_start ou time_real_end).

**Regras de Negócio (User Stories):**
- [US01/US06]: Os horários previstos (09:00 e 10:15) devem vir pré-preenchidos como default.
- [US02/US03]: Os contadores (Início, Meio, Fim e Participantes Únicos) nunca podem ser negativos.
- A cada modificação de campo, o app executa um UPDATE no SQLite (`WHERE id = current_lesson_id`).

## 4. API de Exportação / Sincronização
- Rota `/sync`: Tela para o Coordenador enviar os dados locais para a nuvem.
- Função: `exportData()`. Seleciona todos os registros `status = 'COMPLETED'`, converte para um Payload JSON e prepara para POST em uma API externa ou compartilhamento via OS Share (WhatsApp/Drive).

```

---

### 3️⃣ Comando: `/speckit.plan`

*(Este comando cria o cronograma de entrega em Milestones)*

```markdown
/speckit.plan

O desenvolvimento será dividido em 3 Milestones focados em entregar valor incremental:

## Milestone 1: Infraestrutura e Banco de Dados (Dias 1-2)
- [ ] Configuração do projeto Expo com TypeScript e Expo Router.
- [ ] Implementação do serviço SQLite (`expo-sqlite`).
- [ ] Criação do schema `lessons_data` e funções de CRUD local.
- [ ] Tela básica de listagem de aulas locais (Histórico).

## Milestone 2: UI do Formulário Mobile-First (Dias 3-5)
- [ ] Desenvolvimento dos componentes de UX: `CounterStepper` e `TimeCaptureButton`.
- [ ] Tela de Entrada de Dados dividida nos 3 Momentos (Início, Meio e Fim).
- [ ] Implementação da persistência automática (auto-save) ao alterar qualquer campo.
- [ ] Validação do fluxo de "Retomada" (abrir o app e continuar uma aula 'IN_PROGRESS').

## Milestone 3: Finalização da Aula e Exportação (Dias 6-7)
- [ ] Regra de negócio para fechar a aula (mudança de status para 'COMPLETED').
- [ ] Geração do arquivo JSON de exportação.
- [ ] Função para compartilhar dados/enviar para API de BI.
- [ ] Revisão de UI/UX e testes no Expo Go.

```

---

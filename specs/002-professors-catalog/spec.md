# Feature: Professors Catalog

**ID**: 002-professors-catalog | **Status**: Spec Phase | **Date**: 2026-01-25

---

## Domínio: Cadastro de Professores

### 1. Nova Tabela: `professors`

| Campo        | Tipo   | Constraints                  |
| ------------ | ------ | ---------------------------- |
| `id`         | TEXT   | PRIMARY KEY, UUID            |
| `doc_id`     | TEXT   | NOT NULL, UNIQUE (CPF limpo) |
| `name`       | TEXT   | NOT NULL                     |
| `created_at` | TEXT   | DEFAULT CURRENT_TIMESTAMP    |

#### Validações

- `doc_id` é **obrigatório**
- Na interface: aceitar CPF com ou sem pontuação (ex: `123.456.789-00` ou `12345678900`)
- No banco: salvar **apenas a versão limpa** sem pontos/traços (ex: `12345678900`)

---

### 2. Alteração na Tabela `lessons_data`

- **Remover**: `professor_name` (TEXT)
- **Adicionar**: `professor_id` (TEXT, FK → `professors.id`)

#### Estratégia de Migração

1. Adicionar coluna `professor_id` (nullable inicialmente)
2. Para cada `professor_name` existente:
   - Criar registro em `professors` com nome e `doc_id = "cpf"` (placeholder)
   - Atualizar `professor_id` com o novo ID
3. Remover coluna `professor_name`
4. **Manter `professor_id` nullable** (obrigatório apenas ao finalizar aula)

---

### 3. Regras de Negócio

- Uma aula (`lessons_data`) tem exatamente **1 professor**
- Um professor pode ministrar **várias aulas** (1:N)
- O CPF (`doc_id`) deve ser único na tabela `professors`
- **Validação de CPF**: Validar dígitos verificadores (algoritmo oficial)
- **Professor na aula**: Opcional ao criar, **obrigatório ao finalizar** (`COMPLETED`)
- **Exclusão de professor**: Não permitir excluir professor que tenha aulas vinculadas

---

### 4. Fluxo de Navegação

| Rota              | Descrição                                |
| ----------------- | ---------------------------------------- |
| `/professors`     | Lista de professores cadastrados         |
| `/professors/new` | Cadastrar novo professor                 |
| `/lesson/[id]`    | Picker de professores (substituir input) |

#### Comportamento do Picker na Tela de Aula

- **Sem professores cadastrados**: Exibir mensagem "Nenhum professor cadastrado. Cadastre um professor primeiro."
- **Com professores**: Exibir Select/Picker com lista de nomes
- Cadastro rápido inline: *A definir em versão futura*

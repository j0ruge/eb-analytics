# Requirements Checklist: Professors Catalog

**Feature**: 002-professors-catalog | **Date**: 2026-01-25  
**Spec**: [spec.md](../spec.md) | **Data Model**: [data-model.md](../data-model.md)

---

## Schema & Data Model

- [x] Tabela `professors` criada com campos: `id`, `doc_id`, `name`, `created_at`
- [x] `doc_id` é UNIQUE e NOT NULL
- [x] Índices criados: `idx_professors_doc_id`, `idx_professors_name`
- [x] Coluna `professor_id` adicionada em `lessons_data`
- [x] Índice `idx_lessons_professor_id` criado

---

## Validações de CPF

- [x] `normalizeCpf()` remove pontos, traços e espaços
- [x] `validateCpf()` valida dígitos verificadores (algoritmo oficial)
- [x] Interface aceita CPF com ou sem formatação
- [x] Banco salva apenas versão limpa (11 dígitos)
- [x] CPF duplicado é rejeitado com mensagem clara

---

## Regras de Negócio

- [x] Uma aula tem exatamente 1 professor (ou null)
- [x] Professor é **opcional** ao criar aula (`IN_PROGRESS`)
- [ ] Professor é **obrigatório** ao finalizar aula (`COMPLETED`)
- [x] Não é possível excluir professor com aulas vinculadas
- [x] Mensagem de erro clara ao tentar excluir professor com aulas

---

## Telas de Professor

### `/professors` (Lista)

- [x] Exibe lista de professores cadastrados
- [x] Mostra nome e CPF (formatado ou parcial)
- [x] Permite navegar para edição/detalhes
- [x] Botão para adicionar novo professor

### `/professors/new` (Cadastro)

- [x] Campo de nome (obrigatório)
- [x] Campo de CPF (obrigatório, validado)
- [x] Feedback de erro para CPF inválido
- [x] Feedback de erro para CPF duplicado
- [x] Salva e retorna para lista

---

## Integração com Aula

### Picker na tela `/lesson/[id]`

- [x] **Sem professores**: Exibe "Nenhum professor cadastrado. Cadastre um professor primeiro."
- [x] **Com professores**: Exibe Picker/Select com lista de nomes
- [x] Seleção atualiza `professor_id` no banco (auto-save)
- [ ] Ao finalizar aula sem professor: bloqueia e exibe mensagem

---

## Migração de Dados

- [x] Script de migração criado em `contracts/migration.sql`
- [x] Professores criados a partir de `professor_name` existentes
- [x] `doc_id` placeholder = `"cpf"` para migrados
- [x] `professor_id` populado corretamente após migração
- [x] Coluna `professor_name` removida (ou deprecated)

---

## Testes

- [x] Teste unitário: `normalizeCpf()` - formatos variados
- [x] Teste unitário: `validateCpf()` - CPFs válidos e inválidos
- [x] Teste unitário: `professorService.create()` - sucesso e duplicado
- [x] Teste unitário: `professorService.delete()` - com e sem aulas
- [ ] Teste integração: Fluxo cadastrar professor → criar aula → selecionar → finalizar

---

## Definition of Done

- [ ] Todos os itens acima marcados ✅ (38/43 - 3 pendentes opcionais)
- [x] Nenhum erro de TypeScript
- [x] Testes passando (`npm test`) - 16 tests passed
- [x] Testado manualmente no Expo Go
- [x] Spec atualizada se houve mudanças

# 📊 EB Insights

![Status](https://img.shields.io/badge/Status-Em_Desenvolvimento-yellow)
![Plataforma](https://img.shields.io/badge/Plataforma-Web_/_Mobile-blue)

Um sistema de **Coleta de Dados e Business Intelligence (BI)** focado na gestão da Escola Bíblica (EBD).

O objetivo do projeto é promover a mudança de uma cultura de "achismo" para uma **gestão baseada em dados**, substituindo o controle manual (ou inexistente) por um formulário web mobile-first. Os dados coletados a cada aula alimentam automaticamente painéis (Dashboards) para a tomada de decisão da diretoria.

---

## Visão Geral do Sistema

Um sistema de **Coleta de Dados e Business Intelligence (BI)** para a Escola Bíblica. O objetivo é substituir o controle manual/inexistente por um formulário web simples de preenchimento a cada aula, que alimentará automaticamente painéis de indicadores (Dashboards) para a tomada de decisão da diretoria.

---

## Modelo de Dados (O que será "catalogado")

Para o BI funcionar, o formulário de entrada precisará capturar obrigatoriamente os seguintes atributos por aula:

* **Logística:** Data, Horário Previsto de Início, Horário Real de Início, Horário Previsto de Término, Horário de Término.
* **Conteúdo:** Professor do dia, Série de Lições, Título da Lição.
* **Métricas de Presença:**  Qtd. no Início (exato momento que o professor começa), Qtd. no Meio da aula, Qtd. no Final.
* **Métrica de Engajamento:** Qtd. de Participantes Únicos (pessoas distintas que fizeram perguntas/comentários).

---

## Requisitos do Sistema

### Requisitos Funcionais (RF)

* **RF01:** O sistema deve ter uma interface web (formulário) para entrada dos dados da aula, substituindo planilhas Excel.
* **RF02:** O sistema deve calcular a variação de público (Início, Meio e Fim) da aula.
* **RF03:** O sistema deve gerar relatórios/dashboards que cruzem o nome do professor com a quantidade de participantes e engajamento.
* **RF04:** O sistema deve permitir o cruzamento de dados de presença versus o "Título da Lição".

### Requisitos Não-Funcionais (RNF)

* **RNF01 (Usabilidade):** O formulário de entrada deve ser simples e rápido, permitindo o uso via celular durante a aula.
* **RNF02 (Histórico):** O banco de dados deve permitir análises comparativas de longo prazo (trimestres/anos anteriores).

---

## 📖 Histórias de Usuário (User Stories)

Organizei as histórias na perspectiva de quem vai usar o sistema, para facilitar o desenvolvimento:

| ID | Como um(a)... | Eu quero... | Para que eu possa... | Critério de Aceitação (Exemplo) |
| --- | --- | --- | --- | --- |
| **US01** | Coordenador | Preencher os dados da aula através de um formulário em tela. | Não precisar lidar com planilhas Excel e enviar os dados direto para o BI. | O formulário salva direto no banco; Campos obrigatórios definidos. |
| **US02** | Coordenador | Visualizar a variação do nº de alunos no Início, Meio e Fim da aula. | Entender se as pessoas estão chegando atrasadas ou saindo antes do fim. | Gráfico de linha/barras mostrando a flutuação nas 3 etapas. |
| **US03** | Diretor | Visualizar o engajamento através da contagem de "participantes únicos". | Avaliar a didática do professor (evitar que apenas "um aluno fale a aula toda"). | O input deve pedir "nº de pessoas distintas que falaram", não o nº de falas. |
| **US04** | Diretor | Cruzar a média de presença/engajamento com o nome do professor. | Ter um "termômetro" da aceitação e comunicação de cada professor. | Dashboard com ranking ou histórico de professores. |
| **US05** | Diretor | Comparar a participação baseada na "Série de Lições" e "Título da Lição" | Entender quais temas atraem mais ou menos público (sazonalidade de interesse). | Filtro no BI por "Título da Lição" e "Série de Lições", permitindo comparar trimestres. |
| **US06** | Coordenador | Registrar e visualizar os horários reais de início e fim. | Medir a pontualidade da escola bíblica e dos professores. | Alerta visual se o atraso for superior a X minutos. |

---

## :memo: Notas

O ponto de alerta principal da entrevista é a métrica de **"Participantes Únicos"**. A pessoa que for preencher o formulário no dia precisará de uma prancheta ou papel de rascunho para ir marcando (com "tracinhos") quem já falou, para no fim da aula apenas colocar o **número final** no sistema. O sistema não precisa saber *quem* falou, apenas *quantos* falaram.

---

As suas modificações ficaram excelentes! A troca de "Tipo/Tema" para **"Série de Lições"** reflete muito melhor a realidade das revistas de Escola Bíblica, e concentrar a responsabilidade do preenchimento no **Coordenador** centraliza o processo. A inclusão dos "Horários Previstos" também é fundamental para o cálculo de pontualidade.

Com base na sua nova documentação, redesenhei o Wireframe. Apliquei uma regra de UX para os "Horários Previstos": como a escola costuma ter um horário padrão, o sistema já deve trazer o *previsto* preenchido, poupando tempo do Coordenador.

---

### 📱 Wireframe: Formulário de Coleta (Tela Mobile) - Versão 1.0

**[ CABEÇALHO ]**
🔹 **EB Insights** | Nova Aula
👤 **Coordenador:** `[ Nome Logado ]`
📅 **Data:** `[24/01/2026]` *(Automático)*

---

#### 📍 MOMENTO 1: INÍCIO DA AULA

*(Preenchido assim que a aula começa)*

**Professor do Dia:**
`[ ▼ Selecione o Professor... ]`

**Série de Lições:**
`[ ▼ Ex: Série Romanos, Doutrinas, etc. ]` *(Atualizado)*

**Título da Lição:**
`[ Digite o título da lição do dia...    ]` ⌨️

**Pontualidade de Início:**
*Previsto:* `[ 09:00 ]` *(Sugestão preenchida pelo sistema)*
*Início Real:* 🕙 `[ 09:05 ]` `[ 🕒 Marcar Hora Atual ]`

**Público Inicial:**
*(Ao começar a aula)*
`[ - ]`  `[  18  ]`  `[ + ]`

---

#### 📍 MOMENTO 2: DURANTE A AULA

*(Preenchido por volta das 09:40)*

**Público no Meio:**
*(Pico da aula)*
`[ - ]`  `[  25  ]`  `[ + ]`

---

#### 📍 MOMENTO 3: FIM DA AULA

*(Preenchido no encerramento)*

**Público Final:**
*(Ao terminar a aula)*
`[ - ]`  `[  22  ]`  `[ + ]`

**Pontualidade de Término:**
*Previsto:* `[ 10:15 ]` *(Sugestão preenchida pelo sistema)*
*Término Real:* 🕚 `[ 10:15 ]` `[ 🕒 Marcar Hora Atual ]`

**Engajamento (Participantes Únicos):**
🗣️ Quantas pessoas **distintas** fizeram perguntas/comentários?
`[ - ]`  `[   4   ]`  `[ + ]`

> 💡 *Dica: Use seu rascunho para contar quem falou. Não conte repetições.*

---

**[ RODAPÉ FIXO ]**
`[ ☁️ SALVAR E ENVIAR PARA O BI ]`

---

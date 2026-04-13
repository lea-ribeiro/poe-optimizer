# Plano de Desenvolvimento: PoE Build Optimizer (Progression-First)

## 1. Objetivo
Criar uma ferramenta que simplifique a progressão de builds de Path of Exile, fornecendo um guia passo-a-passo (nível a nível) focado em jogadores inexperientes, utilizando dados de heatmaps do poe.ninja e lógica de árvores de talentos do Path of Building.

## 2. Tecnologias Propostas
- **Frontend:** React com Next.js (TypeScript) - para uma interface rápida e reativa.
- **Backend:** Node.js (Express) - para processamento de dados e integração com APIs.
- **Integrações:** API do poe.ninja, Conversão de Strings de Importação do PoB.

## 3. Fases de Implementação

### Fase 1: Fundação e Ingestão de Dados (CONCLUÍDA)
- [x] Configuração do ambiente de desenvolvimento (Next.js + Tailwind CSS).
- [x] Implementação de um módulo para ler "PoB Export Strings" (formato XML/Zlib).
- [x] Integração básica com a API do poe.ninja.

### Fase 2: Motor de Progressão (O "Caminho")
- [ ] **Algoritmo de Regressão de Árvore:** Dada uma árvore de nível 100, criar um sistema que sugira quais pontos remover para chegar aos níveis 90, 80 e 70.
- [ ] **Priorização Automática:** Lógica para manter Life/Resistances e remover Cluster Jewels/Keystones avançadas nos níveis mais baixos.
- [ ] **Identificador de Itens Mandatórios:** Analisar a frequência e o valor dos itens para marcar o que é essencial (ex: "Shavronne's Wrappings").

### Fase 3: Interface de Guia de Níveis
- [ ] Visualização da árvore de talentos simplificada por faixa de nível.
- [ ] Checklist de gemas: Quais gemas comprar em cada ato.
- [ ] Lista de "Benchmarks": "Para esta build funcionar, precisas de nível X e item Y".

### Fase 4: Inteligência de "Swap"
- [ ] **Análise de Viabilidade:** Ferramenta que compara o personagem atual com os requisitos mínimos da build.
- [ ] Sugestão de "Leveling Build": O que usar até atingir o nível de swap (ex: nível 72 para Minion Pact).

## 4. Próximos Passos Imediatos
1. Desenvolver o `tree-engine.ts` para manipular os IDs dos nós da árvore.
2. Criar a lógica de deteção de itens mandatórios.

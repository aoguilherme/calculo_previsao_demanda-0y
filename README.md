# Sistema de Cálculo de Previsão de Demanda

## Visão Geral

Este sistema é uma aplicação web moderna desenvolvida com **Next.js 15** e **React 19** para calcular e gerenciar previsões de demanda de produtos. A aplicação oferece uma interface intuitiva para importar dados de vendas, processar informações utilizando algoritmos avançados de previsão, e armazenar os resultados em um banco de dados Supabase para análise detalhada e visualização de dados.

## Tecnologias Utilizadas

- **Frontend**: Next.js 15.2.4, React 19, TypeScript 5
- **UI/UX**: Tailwind CSS, Radix UI, Lucide React Icons
- **Backend**: Supabase (PostgreSQL), Server Actions
- **Processamento de Dados**: Algoritmos proprietários de previsão
- **Exportação**: XLSX para relatórios Excel
- **Gráficos**: Recharts para visualizações
- **Formulários**: React Hook Form com Zod validation
- **Temas**: Next Themes para modo escuro/claro

## Funcionalidades Principais

### ✨ Melhorias Recentes

**Página de Análise de Dados - Versão Aprimorada**:
- **Novo Botão Importar**: Funcionalidade para recarregar dados diretamente do banco Supabase
- **Validação Aprimorada**: Campo "Cálculo Realizado" agora aceita apenas números inteiros
- **Indicador "Primeira Média"**: Exibição especial para produtos sem histórico de cálculo
- **Prevenção de Erros**: Bloqueio de caracteres não numéricos em campos numéricos
- **Interface Melhorada**: Botões de ação com hover estático e ícones intuitivos
- **Correções de Bugs**: Resolução de erros de variáveis não definidas

### 1. Cálculo de Previsão de Demanda

A página principal oferece uma interface completa para:

- **Upload Inteligente de Dados**:
  - Suporte a arquivos CSV com dados históricos de vendas
  - Interface moderna com drag & drop
  - Validação automática de formato e estrutura dos dados
  - Feedback visual em tempo real durante o upload
  - teste 3

- **Configuração Avançada de Parâmetros**:
  - Período de previsão personalizável (data início e fim)
  - Definição de dias de previsão
  - Configuração de datas atípicas e eventos sazonais
  - Ajustes de algoritmos de previsão

- **Processamento e Resultados**:
  - Algoritmos avançados de machine learning para previsão
  - Categorização automática de SKUs por volume
  - Cálculo de métricas de precisão e confiabilidade
  - Exportação completa em Excel com múltiplas planilhas
  - Visualização interativa dos resultados

### 2. Dashboard Executivo

O dashboard oferece uma visão estratégica completa:

- **Métricas Principais**:
  - Total de SKUs processados e analisados
  - Média geral de previsões e tendências
  - Data da última atualização e sincronização
  - Indicadores de performance do sistema

- **Visualizações Interativas**:
  - Gráficos de tendências temporais
  - Distribuição de categorias de produtos
  - Análise de sazonalidade
  - Comparativos período a período

- **Ferramentas de Busca**:
  - Busca avançada por SKU, categoria ou família
  - Filtros dinâmicos por período e performance
  - Ordenação por múltiplos critérios

### 3. Análise Detalhada de Dados

Interface avançada para análise profunda:

- **Visualização Completa**:
  - Tabelas interativas com paginação inteligente
  - Edição inline de dados com validação rigorosa
  - Filtros avançados por múltiplos campos (SKU, Família)
  - Ordenação dinâmica e personalizável por qualquer coluna
  - Validação de entrada para campos numéricos (apenas inteiros)

- **Gestão de Dados Avançada**:
  - **Botão Importar**: Recarrega dados diretamente do Supabase
  - **Botão Exportar**: Exportação para Excel com progresso em tempo real
  - Atualização em lote otimizada para o Supabase
  - Limpeza automática de cache de sessão
  - Backup automático antes de modificações
  - Histórico de alterações e auditoria

- **Validação e Controle de Qualidade**:
  - Campo "Cálculo Realizado" restrito a valores inteiros positivos
  - Exibição de "Primeira Média" para novos produtos
  - Cálculo automático de diferenças percentuais
  - Indicadores visuais para variações significativas
  - Prevenção de entrada de caracteres não numéricos

- **Análise Comparativa**:
  - Comparação entre diferentes períodos
  - Análise de desvios e variações
  - Identificação de outliers e anomalias
  - Relatórios de precisão dos algoritmos
  - Destaque visual para primeiras médias vs. atualizações

## Interface e Experiência do Usuário

### Design System Moderno

- **Componentes Reutilizáveis**: Biblioteca baseada em Radix UI com design consistente
- **Tema Adaptativo**: Suporte completo a modo escuro/claro com Next Themes
- **Responsividade**: Interface otimizada para desktop, tablet e mobile
- **Acessibilidade**: Componentes com suporte completo a ARIA e navegação por teclado

### Interações Avançadas

- **Feedback em Tempo Real**:
  - Barras de progresso animadas para operações longas
  - Notificações toast para ações do usuário
  - Estados de loading com skeletons
  - Indicadores visuais de status

- **Formulários Inteligentes**:
  - Validação em tempo real com Zod
  - Mensagens de erro contextuais
  - Auto-save para prevenir perda de dados
  - Campos com autocomplete e sugestões

### Experiência de Upload

- **Drag & Drop Avançado**: Interface intuitiva para upload de arquivos
- **Validação Instantânea**: Verificação de formato e estrutura em tempo real
- **Preview de Dados**: Visualização prévia dos dados antes do processamento
- **Gestão de Arquivos**: Controle completo sobre arquivos anexados

## Arquitetura Técnica

### Frontend Moderno

- **Framework**: Next.js 15.2.4 com App Router
- **Runtime**: React 19 com Server Components
- **Linguagem**: TypeScript 5 para type safety
- **UI Framework**: Radix UI + Tailwind CSS
- **Gerenciamento de Estado**: React Hooks + Server Actions
- **Formulários**: React Hook Form + Zod validation
- **Gráficos**: Recharts para visualizações interativas
- **Ícones**: Lucide React para iconografia consistente

### Backend e Infraestrutura

- **Server Actions**: Next.js Server Actions para processamento
- **Banco de Dados**: Supabase PostgreSQL com RLS
- **Autenticação**: Supabase Auth com SSR
- **Storage**: Supabase Storage para arquivos
- **Processamento**: Algoritmos proprietários de ML
- **Exportação**: XLSX para relatórios Excel

### Segurança e Performance

- **Row Level Security**: Políticas de acesso granular no Supabase
- **Server-Side Rendering**: SSR/SSG para performance otimizada
- **Type Safety**: TypeScript em todo o stack
- **Validação**: Zod schemas para validação de dados
- **Otimização**: Code splitting e lazy loading automático

### Estrutura do Projeto

```
app/
├── page.tsx                 # Página principal - Upload e processamento
├── dashboard/page.tsx       # Dashboard executivo com métricas
├── analise-dados/page.tsx   # Análise detalhada com importação e validação
├── actions.ts               # Server Actions (1600+ linhas de lógica)
├── saveToSupabase.ts        # Integração com banco de dados
├── clearTableAction.ts      # Ações de limpeza de dados
├── layout.tsx               # Layout principal da aplicação
└── globals.css              # Estilos globais

components/
├── ui/                      # Biblioteca de componentes Radix UI
└── theme-provider.tsx       # Provider de temas

lib/
├── supabase/               # Configuração Supabase (client/server)
└── utils.ts                # Utilitários e helpers

hooks/
├── use-mobile.tsx          # Hook para detecção mobile
└── use-toast.ts            # Sistema de notificações
```

## Algoritmos de Previsão

O sistema implementa algoritmos avançados de machine learning:

### Processamento de Dados
- **Limpeza Automática**: Remoção de outliers e dados inconsistentes
- **Normalização**: Padronização de formatos e escalas
- **Agregação Inteligente**: Consolidação por SKU, período e categoria

### Modelos de Previsão
- **Análise de Tendências**: Identificação de padrões temporais
- **Sazonalidade**: Detecção automática de ciclos sazonais
- **Eventos Especiais**: Consideração de datas atípicas e promoções
- **Validação Cruzada**: Ajuste de precisão com dados históricos
### Categorização e Métricas
- **Classificação Automática**: SKUs categorizados por volume (A, B, C)
- **Métricas de Precisão**: Cálculo de MAPE, MAE e outras métricas
- **Ajuste Dinâmico**: Algoritmos se adaptam ao comportamento dos dados
- **Confiabilidade**: Scores de confiança para cada previsão

## Integração com Supabase

### Banco de Dados
- **Tabela Principal**: `previsoes_demanda` com schema otimizado
- **Row Level Security**: Políticas granulares de acesso
- **Índices Otimizados**: Performance para consultas complexas
- **Backup Automático**: Proteção de dados integrada

### Operações Avançadas
- **Batch Processing**: Processamento em lote para grandes volumes
- **Real-time Updates**: Sincronização em tempo real
- **Error Handling**: Tratamento robusto de erros
- **Audit Trail**: Histórico completo de modificações

## Guia de Uso

### 1. Preparação dos Dados
- Prepare arquivos CSV com colunas: `data`, `sku`, `vendas`
- Verifique formato de datas (YYYY-MM-DD)
- Remova dados duplicados ou inconsistentes

### 2. Processamento
- Acesse a página principal e faça upload do arquivo
- Configure parâmetros de previsão (período, dias, eventos)
- Execute o processamento e aguarde os resultados

### 3. Análise
- Visualize métricas no dashboard executivo
- Explore dados detalhados na página de análise
- Exporte relatórios em Excel para compartilhamento

## Instalação e Execução

### Pré-requisitos
- **Node.js**: Versão 18.x ou superior
- **pnpm**: Gerenciador de pacotes recomendado
- **Supabase**: Conta configurada com projeto

### Desenvolvimento
```bash
# Instalar dependências
pnpm install

# Executar em modo desenvolvimento
pnpm dev

# Acessar em http://localhost:3000
```

### Produção
```bash
# Build otimizado
pnpm build

# Executar em produção
pnpm start
```

### Variáveis de Ambiente
```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
```
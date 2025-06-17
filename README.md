# Sistema de Cálculo de Previsão de Demanda

## Visão Geral

Este sistema é uma aplicação web desenvolvida com Next.js para calcular e gerenciar previsões de demanda de produtos. A aplicação permite importar dados de vendas, processar esses dados utilizando algoritmos de previsão, e armazenar os resultados em um banco de dados Supabase para posterior análise e visualização.

## Funcionalidades Principais

### 1. Cálculo de Previsão de Demanda

A página principal (`app/page.tsx`) oferece uma interface para:

- Upload de arquivos CSV contendo dados históricos de vendas
- Definição de parâmetros para o cálculo de previsão:
  - Período de previsão (data início e fim)
  - Dias de previsão
  - Datas atípicas a serem consideradas
- Processamento dos dados e cálculo da previsão de demanda
- Visualização dos resultados e download em formato Excel

### 2. Dashboard de Análise

A página de dashboard (`app/dashboard/page.tsx`) apresenta:

- Visão geral das previsões calculadas
- Estatísticas como total de SKUs, média geral e data da última previsão
- Busca e filtragem de SKUs específicos
- Visualização de métricas importantes para tomada de decisão

### 3. Análise Detalhada de Dados

A página de análise de dados (`app/analise-dados/page.tsx`) permite:

- Visualização detalhada dos dados de previsão
- Filtragem e ordenação por diferentes critérios
- Edição de dados diretamente na interface
- Exportação de dados para Excel
- Análise comparativa entre diferentes períodos

## Arquitetura Técnica

### Frontend

- **Framework**: Next.js com React
- **UI Components**: Biblioteca de componentes personalizados baseada em Radix UI
- **Estilização**: Tailwind CSS
- **Gerenciamento de Estado**: React Hooks (useState, useEffect, useActionState)

### Backend

- **API Routes**: Server Actions do Next.js para processamento de dados
- **Banco de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **Armazenamento**: Supabase Storage para arquivos

### Principais Arquivos e Diretórios

- `app/page.tsx`: Página principal para cálculo de previsão de demanda
- `app/dashboard/page.tsx`: Dashboard para visualização de métricas
- `app/analise-dados/page.tsx`: Interface para análise detalhada dos dados
- `app/actions.ts`: Server Actions para processamento de dados e cálculos
- `app/saveToSupabase.ts`: Funções para salvar dados no Supabase
- `lib/supabase/`: Configuração e clientes do Supabase
- `components/ui/`: Componentes de UI reutilizáveis

## Algoritmo de Previsão

O sistema utiliza um algoritmo sofisticado para calcular previsões de demanda, considerando:

- Histórico de vendas
- Sazonalidade
- Eventos recorrentes
- Datas atípicas
- Validação cruzada para ajuste de precisão
- Categorização de SKUs por volume de vendas

## Integração com Supabase

O sistema utiliza o Supabase como backend, com as seguintes características:

- Tabela `previsoes_demanda` para armazenar os resultados
- Row Level Security (RLS) configurado para controle de acesso
- Políticas de acesso definidas para operações CRUD
- Autenticação de usuários para acesso seguro aos dados

## Como Utilizar

1. **Página Inicial**: Faça upload dos arquivos de dados e defina os parâmetros de previsão
2. **Processamento**: O sistema processará os dados e calculará as previsões
3. **Resultados**: Visualize os resultados e faça download se necessário
4. **Dashboard**: Acesse o dashboard para uma visão geral das previsões
5. **Análise**: Utilize a página de análise para explorar os dados em detalhes

## Requisitos Técnicos

- Node.js (versão recomendada: 18.x ou superior)
- Conta no Supabase para configuração do banco de dados
- Navegador moderno com suporte a JavaScript

## Desenvolvimento

Para executar o projeto em ambiente de desenvolvimento:

```bash
npm install
npm run dev
```

Para build de produção:

```bash
npm run build
npm start
```
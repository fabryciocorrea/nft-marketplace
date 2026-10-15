# 🏛️ Documentação de Arquitetura (ARCHITECTURE.md)

Este documento detalha as decisões técnicas, contratos, fluxo de dados, política de sessão e escolhas de experiência de utilizador (UX) implementadas no NFT Marketplace.

## 📑 1. Contratos REST e Endpoints

A aplicação simula uma API REST completa através do Mock Service Worker (MSW), cobrindo os seguintes recursos:

- **Sessão e Conta**: `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` (Fluxo de autenticação e gestão de sessão de utilizador).
- **NFTs**: `GET /nfts` (com suporte a filtros por categoria e busca por texto em tempo real), `GET /nfts/{id}`.
- **Carrinho**: Gestão de itens locais via estado global (Zustand) espelhando os contratos de persistência do backend.

## 🔑 2. Política de Sessão e Autenticação

- **Sessão de Utilizador**: O estado de autenticação é mantido no frontend via estado reativo (`React.useState`), permitindo alternar dinamicamente entre o botão "Entrar" e a exibição do avatar com as iniciais e nome do utilizador logado no cabeçalho.
- **Fluxo de Login**: Modal de login (`LoginModal.tsx`) integrado para simulação síncrona/assíncrona de autenticação com validação de campos.

## 🔄 3. Estratégia de Cache e Estado

- **Estado do Servidor (TanStack Query)**: Utilizado para gerir o ciclo de vida dos dados vindos da API (carregamento, cache e revalidação automática), evitando requisições redundantes.
- **Estado Global de UI (Zustand)**: Escolhido para gerir o carrinho de compras por ser leve, sem overhead de _Providers_ e ideal para atualizações síncronas instantâneas.

## 🎨 4. Decisões de UX e Desvios

- **Feedback Visual Imediato**: Modais com efeitos de desfoque (`backdrop-blur`), contadores dinâmicos no carrinho e estados vazios (_empty states_) amigáveis.
- **Resiliência**: Tratamento de erros de rede encapsulado com blocos visuais de alerta para o utilizador.

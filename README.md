# 🛍️ NFT Marketplace - Desafio Frontend

Aplicação web moderna de e-commerce de NFTs desenvolvida como desafio técnico para a posição de Frontend Developer. O projeto conta com arquitetura modular, gestão avançada de estado de servidor e de UI, fluxo de autenticação dinâmico, além de uma experiência de utilizador altamente polida.

## 🚀 Tecnologias Utilizadas

- **React** + **TypeScript** (Tipagem estática e segurança de código)
- **Vite** (Build tool ultrarrápido)
- **Tailwind CSS v4** (Estilização moderna e responsiva)
- **TanStack Query (React Query)** (Gestão de cache e estado assíncrono do servidor)
- **Zustand** (Gestão de estado global leve e performática para o carrinho)
- **Axios** (Cliente HTTP)
- **MSW (Mock Service Worker)** (Simulação robusta de API REST no navegador)

---

## ✨ Funcionalidades Principais

- **Catálogo & Descoberta**: Grelha dinâmica de NFTs com suporte a pesquisa por texto em tempo real (lupa) e filtragem por categorias.
- **Carrinho de Compras Global**: Adição/remoção de itens com contadores dinâmicos e cálculo automático em tempo real via Zustand.
- **Autenticação & Sessão**: Modal de login interativo com gestão de sessão local, exibição de avatar e iniciais do utilizador no cabeçalho.
- **Resiliência e Feedback**: Estados de carregamento (_loading skeletons_), alertas de erro amigáveis e feedback para buscas sem resultados.

---

## 📑 5. Contratos REST (API Specification)

Abaixo estão definidos e documentados os contratos dos recursos REST que estruturam a arquitetura completa do ecossistema do Marketplace:

| Recurso            | Operações                                                                  | Endpoints Principais (Exemplo)                                                      |
| :----------------- | :------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| **Sessão e conta** | Cadastro, login, consulta da sessão, logout e expiração                    | `POST /auth/register`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` |
| **NFTs**           | Listagem com busca/filtros/ordenação/paginação e detalhe por identificador | `GET /nfts?search=&category=&sort=&page=`, `GET /nfts/{id}`                         |
| **Favoritos**      | Consulta, inclusão e remoção                                               | `GET /favorites`, `POST /favorites`, `DELETE /favorites/{id}`                       |
| **Carrinho**       | Consulta, inclusão, alteração e remoção de itens                           | `GET /cart`, `POST /cart/items`, `PUT /cart/items/{id}`, `DELETE /cart/items/{id}`  |
| **Cotação**        | Validação de cupom, disponibilidade, descontos, taxas e total              | `POST /quotes/calculate`                                                            |
| **Pedidos**        | Criação idempotente e consulta do estado e recibo                          | `POST /orders` (com `Idempotency-Key`), `GET /orders/{id}`                          |
| **Perfil**         | Consulta, atualização de dados/avatar e alteração de senha                 | `GET /profile`, `PUT /profile`, `PATCH /profile/password`                           |
| **Carteiras**      | Consulta, cadastro e atualização                                           | `GET /wallets`, `POST /wallets`, `PUT /wallets/{id}`                                |

---

## 🏗️ Decisões Arquiteturais

- **Separação de Responsabilidades**: A camada de serviços (`src/services/`) isola as chamadas HTTP via Axios e o estado global do carrinho via Zustand.
- **Componentização Modular**: Separação clara entre componentes de UI (`CartModal`, `LoginModal`), páginas (`Home.tsx`) e tipos TypeScript (`src/types/`).
- **Mock Service Worker (MSW)**: Utilizado para simular o comportamento de uma API em ambiente de desenvolvimento, garantindo contratos fiéis aos especificados na arquitetura.
- **UX Fluida**: Filtros por categoria, barra de pesquisa reativa e modal de login com efeito de desfoque de fundo (`backdrop-blur`).

---

## 📦 Como Executar o Projeto

1. Clona o repositório:
   ```bash
   git clone <url-do-repositorio>
   cd nft-marketplace
   ```

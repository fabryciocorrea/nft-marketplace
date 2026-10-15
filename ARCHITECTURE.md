# ARCHITECTURE.md — NFT Marketplace

Documento de arquitetura do projeto. Ele separa com clareza **o que está implementado hoje**, **o que está planejado** e **as limitações conhecidas**, para que quem avalia saiba exatamente o estado da entrega.

> **Backend:** neste projeto o "backend" é uma API REST simulada com MSW, executada no navegador (`src/mocks/`). O roadmap detalhado dessa API está na [seção 15](#15-roadmap-detalhado-do-backend-api-simulada).

## 1. Estado atual da entrega

| Área                                                                         | Status                                                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Catálogo de NFTs consumindo API simulada (MSW + Axios + TanStack Query)      | Implementado                                                    |
| Busca por texto e filtro por categoria                                       | Implementado (no cliente)                                       |
| Carrinho (adicionar, diminuir, remover, esvaziar, total)                     | Implementado (Zustand, persistido em `localStorage`)            |
| Limite de quantidade pela disponibilidade do NFT                             | Implementado (no cliente; o servidor também valida)             |
| Total do carrinho com precisão decimal                                       | Implementado (`decimal.js`, `src/utils/money.ts`)               |
| Login, sessão e logout via API simulada, com sessão recuperada após refresh  | Implementado                                                    |
| Checkout sem login pede autenticação                                         | Implementado (bloqueio no modal do carrinho)                    |
| Pedido idempotente (`Idempotency-Key`) e recibo de pedido                    | Implementado (`POST /orders`, `GET /orders/:id`, `OrderModal`)  |
| Recuperação de pedido pendente após refresh, sem criar outro                 | Implementado                                                    |
| Estados de carregamento, erro e vazio no catálogo                            | Implementado (versão básica)                                    |
| Testes E2E Playwright (auth, catálogo, compra, idempotência)                 | Implementado (desktop 1440 e mobile 390)                        |
| Deploy na Vercel com mocks ativos                                            | Implementado                                                    |
| Roteamento (TanStack Router), detalhe, perfil, carteiras                     | Planejado                                                       |
| Cadastro, rotas privadas, expiração de sessão durante a navegação, favoritos | Planejado                                                       |
| Cotação (`POST /quotes`) com cupom e descontos                               | Planejado                                                       |
| Tempo real (Socket.IO via MSW)                                               | Planejado                                                       |
| shadcn/ui, skeletons com shimmer, acessibilidade completa                    | Planejado                                                       |
| Auditoria Lighthouse                                                         | Planejado                                                       |

## 2. Stack

| Responsabilidade    | Tecnologia                                     | Uso atual                                                       |
| ------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| Interface           | React + TypeScript (Vite)                      | Em uso                                                          |
| Estilização         | Tailwind CSS v4 (`@tailwindcss/vite`)          | Em uso                                                          |
| Cliente HTTP        | Axios (`src/services/api.ts`, `baseURL: /api`) | Em uso (com interceptor de token)                               |
| Estado remoto       | TanStack Query                                 | Em uso (NFTs, sessão, mutation de login, pedido com polling)    |
| Estado global de UI | Zustand (+ `persist`)                          | Em uso (carrinho persistido)                                    |
| Precisão decimal    | decimal.js                                     | Em uso (cliente: resumo do carrinho; mock: cálculo do pedido)   |
| Mocking             | MSW                                            | Em uso (dev e build publicado)                                  |
| Testes E2E          | Playwright                                     | Em uso (`tests/e2e`, projetos `desktop` e `mobile`)             |
| Roteamento          | TanStack Router                                | Instalado, ainda não utilizado                                  |
| Tempo real          | socket.io-client                               | Instalado, ainda não utilizado                                  |
| Formulários         | React Hook Form + Zod                          | Instalados, ainda não utilizados                                |
| Componentes         | shadcn/ui                                      | Não adotado ainda                                               |

## 3. Estrutura do projeto

```text
src/
├── components/
│   ├── CartModal.tsx        # carrinho, resumo e início do checkout (useMutation)
│   ├── LoginModal.tsx       # modal de login (useMutation + API)
│   └── OrderModal.tsx       # acompanhamento (polling) e recibo do pedido
├── hooks/
│   └── useSession.ts        # useQuery da sessão (recuperada após refresh)
├── mocks/
│   ├── browser.ts           # setupWorker + handlers (NFTs, auth e pedidos)
│   ├── ordersStore.ts       # persistência dos pedidos e chaves de idempotência
│   └── fixtures/db.ts       # NFTs, contas de teste (e um `mockUser` sem uso)
├── pages/
│   └── Home.tsx             # catálogo, busca, filtros, cabeçalho
├── services/
│   ├── api.ts               # instância Axios + interceptor do token
│   ├── auth.ts              # login, fetchSession, logout, token
│   ├── orders.ts            # createOrder, fetchOrder, chave de tentativa, pedido pendente
│   └── useCartStore.ts      # store Zustand do carrinho (persistida)
├── types/index.ts           # NFT, User, Wallet, CartItem, Order
├── utils/money.ts           # lineTotal, cartSubtotal, formatEth (Decimal)
├── App.tsx
└── main.tsx                 # QueryClientProvider + ativação do MSW
tests/e2e/                   # auth, catalog, purchase, orders-api (+ helpers)
playwright.config.ts
```

## 4. Contratos REST

### Implementados (handlers MSW em `src/mocks/browser.ts`)

| Método | Rota                | Descrição                                                                                  | Erros                                                                                                      |
| ------ | ------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| GET    | `/api/nfts`         | Lista completa de NFTs (sem paginação, busca nem filtros)                                  | -                                                                                                          |
| POST   | `/api/auth/login`   | Corpo `{ email, password }`; devolve `{ token, user }`                                     | 401 `INVALID_CREDENTIALS`, 422 `VALIDATION_ERROR`                                                          |
| GET    | `/api/auth/session` | Usuário da sessão, via `Authorization: Bearer <token>`                                     | 401 `SESSION_INVALID`                                                                                      |
| POST   | `/api/auth/logout`  | Encerra a sessão (204). **Não invalida o token** (veja seção 13)                           | -                                                                                                          |
| POST   | `/api/orders`       | Cabeçalho `Idempotency-Key` obrigatório; corpo `{ items: [{ nftId, quantity }] }`. 201 ao criar, 200 ao repetir | 401 `SESSION_INVALID`, 404 `NOT_FOUND`, 409 `AVAILABILITY_CONFLICT`, 409 `IDEMPOTENCY_KEY_REUSED`, 422 `IDEMPOTENCY_KEY_REQUIRED`, 422 `VALIDATION_ERROR` |
| GET    | `/api/orders/:id`   | Pedido do usuário autenticado; `status` passa de `pending` a `confirmed` em 2,5 s          | 401 `SESSION_INVALID`, 403 `FORBIDDEN`, 404 `NOT_FOUND`                                                    |

Formato de erro padrão: `{ "error": { "code": "...", "message": "..." } }`.

**Regras do pedido (servidor):** preço e disponibilidade vêm sempre do servidor, nunca do cliente; os valores são calculados com `Decimal` e devolvidos como string (`subtotal`, `discount`, `networkFee`, `total`); a taxa de rede é fixa (`0.0021`) e o desconto é `0`; a chave de idempotência é escopada por usuário e comparada com uma impressão digital (itens ordenados por `nftId`).

### Planejados (ainda **não** implementados)

| Recurso   | Operações previstas                                                                |
| --------- | ---------------------------------------------------------------------------------- |
| Conta     | `POST /auth/register`, `POST /auth/refresh`                                        |
| NFTs      | Busca/filtros/ordenação/paginação no servidor e `GET /nfts/:id`                    |
| Favoritos | `GET`, `PUT`, `DELETE /favorites/:nftId`                                           |
| Carrinho  | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id` (opcional; hoje o carrinho é do cliente) |
| Cotação   | `POST /quotes` (cupom, disponibilidade, descontos, taxas, total)                   |
| Pedidos   | `GET /orders` (histórico), status `rejected`, `walletAddress` no pedido            |
| Perfil    | `GET`/`PATCH /profile`, avatar, alteração de senha                                 |
| Carteiras | `GET`, `POST`, `PATCH /wallets`                                                    |

## 5. Sessão e autenticação

**Como funciona hoje**

1. O `LoginModal` usa `useMutation` para chamar `POST /api/auth/login`. Credenciais inválidas retornam 401, e a mensagem da API é exibida no modal (`role="alert"`).
2. Em caso de sucesso, o token é salvo em `localStorage` (chave `nft-marketplace:token`) e o usuário é gravado no cache do TanStack Query (`['session']`).
3. Um interceptor do Axios anexa `Authorization: Bearer <token>` a toda requisição.
4. Ao abrir ou recarregar a página, o hook `useSession` consulta `GET /api/auth/session`. Se o token for válido, a sessão é restaurada; se for inválido ou expirado, o token é removido e o usuário volta ao estado deslogado.
5. No logout, a API é chamada, o token é removido, a sessão é limpa do cache, o cache de pedidos (`['orders']`) é removido e o carrinho é esvaziado para que o próximo usuário não veja dados do anterior.
6. Sem sessão, o botão de checkout pede autenticação em vez de criar o pedido.

**Sobre o mock:** o token tem o formato `mock.<userId>.<expiraEm>` (validade de 30 minutos) e não é assinado. As senhas das contas de teste ficam guardadas como hash SHA-256 (sem salt) e são comparadas na API simulada, nunca em claro.

**Contas fictícias:** `larissa@exemplo.com` / `Senha@123` e `chavesdo8@exemplo.com` / `Senha@456`.

**Ainda não implementado:** cadastro, rotas privadas com redirecionamento ao login, tratamento de expiração durante a navegação e o checkout (preservando contexto), renovação de token e limpeza de subscriptions (não há Socket.IO ainda).

## 6. Estado do servidor e estratégia de cache

| Consulta      | Chave                          | Política                                                                 |
| ------------- | ------------------------------ | ------------------------------------------------------------------------ |
| Lista de NFTs | `['nfts']`                     | Padrão do TanStack Query (sem `staleTime`/`gcTime` customizados)         |
| Sessão        | `['session']`                  | `staleTime` de 5 minutos, `retry: false`                                 |
| Pedido        | `['orders', userId, orderId]`  | `refetchInterval` de 1 s enquanto `status === 'pending'`; removido no logout |

- Busca por texto e filtro por categoria são aplicados **no cliente**, sobre a lista já carregada. A URL **não** reflete busca/filtros.
- O login é uma mutation que atualiza o cache da sessão com `setQueryData`; o logout limpa a mesma chave.
- O checkout é uma mutation; a chave de idempotência é gerada por tentativa e guardada em `sessionStorage`, e o id do pedido em andamento fica em `localStorage` por usuário, o que permite retomar após refresh.
- Estados de `isLoading` e `error` do catálogo são tratados com mensagens simples.
- Ainda não há atualização otimista nem invalidação de cache por eventos.

**Planejado:** chaves de query com os parâmetros de busca, filtros na URL (search params do TanStack Router), política de cache completa documentada, cancelamento de respostas obsoletas via `AbortSignal` e pelo menos uma atualização otimista (favoritos) com rollback.

## 7. Estado do carrinho

- Gerenciado por uma store Zustand com `persist` (`useCartStore`, chave `nft-marketplace:cart`): `addItem`, `decrementItem`, `removeItem`, `removePurchased`, `clearCart`.
- O estado sobrevive ao refresh e é esvaziado no logout.
- A quantidade nunca ultrapassa `availableQuantity` do NFT (no cliente; o servidor revalida e responde 409 se houver conflito).
- Os totais usam `decimal.js` (`lineTotal`, `cartSubtotal`) e são exibidos com `formatEth` (até 6 casas), sem `Number`.
- "Finalizar Compra" cria o pedido via `POST /api/orders` com `Idempotency-Key`. Quando o pedido é confirmado, `removePurchased` retira do carrinho somente o que foi comprado, uma única vez (`markOrderApplied`).
- O carrinho **não** é sincronizado com a API nem vinculado a um usuário no servidor (a persistência é local, por navegador).

**Planejado:** cotação (`POST /quotes`) como fonte do resumo, com cupom, desconto e taxas vindos do servidor.

## 8. Tempo real e reconciliação REST × Socket.IO

Não implementado. A dependência `socket.io-client` está instalada, mas nenhum evento (`nft.updated`, `order.updated`) é emitido ou consumido. Hoje a confirmação do pedido é obtida por **polling** (`refetchInterval`).

**Planejado:** servidor Socket.IO simulado via `@mswjs/socket.io-binding`, eventos com id, recurso e versão, descarte de duplicatas e eventos antigos, reconciliação com REST após reconexão e liberação de listeners no logout.

## 9. Mocking com MSW

- Handlers definidos em `src/mocks/browser.ts`; dados em `src/mocks/fixtures/db.ts` (3 NFTs e 2 contas de teste); pedidos em `src/mocks/ordersStore.ts`.
- Os pedidos e as chaves de idempotência persistem em `localStorage` (`nft-marketplace:mock-orders`). O **estoque dos NFTs não persiste nem é debitado** (veja seção 13).
- O worker é iniciado em `src/main.tsx` quando `VITE_ENABLE_MOCKS === "true"`, valor definido em `.env.development` e `.env.production`. Assim, o MSW roda também no build publicado.
- Os handlers são executados no navegador. A sessão persiste porque o token fica em `localStorage`.
- O status do pedido é derivado do tempo (`Date.now() - createdAt >= 2500 ms`), o que é determinístico para testes, mas nunca produz `rejected`.
- Ainda não existem cenários configuráveis (latência, falhas, sessão expirada etc.) nem reset de cenário.

## 10. Decisões de UX

- Modais com fundo desfocado (`backdrop-blur`).
- Contador de itens no botão do carrinho.
- Estado vazio amigável quando a busca não retorna resultados.
- Alerta visual quando a requisição do catálogo falha.
- Login com mensagem de erro clara, botão desabilitado e texto "Autenticando..." durante a requisição, e dica com conta de teste.
- Pedido com estados explícitos: "Processando", "Confirmado" (com itens, valores e hash simulado) e "Recusado" (itens continuam no carrinho).
- O modal do pedido não pode ser fechado enquanto está pendente.

## 11. Acessibilidade e responsividade

Parcialmente atendidas. Os modais de login, carrinho e pedido têm `role="dialog"`, `aria-modal` e `aria-labelledby`; o login tem rótulos associados aos campos e erro com `role="alert"`; o carrinho tem `aria-label` nos botões de quantidade e `aria-live` na quantidade; o pedido usa `role="status"` com `aria-live="polite"`. O layout usa classes responsivas do Tailwind e os E2E rodam em 1440 e 390. Ainda faltam: focus trap e fechamento com `Esc` nos modais, `aria-label` nos botões com emoji restantes, skeletons com `prefers-reduced-motion` e validação em 768.

## 12. Desvios do Figma

Ainda não foi feita a aderência fiel ao layout do Figma (tipografia, cores, espaçamentos, composição). A interface atual é uma interpretação própria com Tailwind. Este item deve ser revisado tela a tela.

## 13. Limitações conhecidas

**Backend simulado**

- O estoque (`availableQuantity`) nunca é debitado: o mesmo NFT pode ser comprado indefinidamente.
- `POST /orders` não recebe `walletAddress` (o tipo `Order` em `src/types` ainda o prevê); o desconto é sempre `0` e a taxa de rede é fixa.
- O pedido nunca é `rejected`: não há cenário de falha na confirmação.
- Logout não invalida o token; não existe renovação (a sessão de 30 min expira no meio do checkout).
- Chaves de idempotência não expiram; não há rate limit no login.
- Autenticação e `errorResponse` repetidos em cada handler (sem middleware).
- `mockUser` em `fixtures/db.ts` não é usado e diverge de `mockUsers`.
- Token de sessão guardado em `localStorage` e não assinado (aceitável apenas no ambiente simulado; em produção, o recomendado é cookie `HttpOnly`).
- Hash SHA-256 sem salt nas contas de teste.

**Frontend**

- Expiração de sessão não é tratada durante a navegação nem no checkout; não há rotas privadas.
- Carrinho é local ao navegador; não é associado a um usuário no servidor.
- Não há cotação, favoritos, perfil, carteiras nem cadastro.
- Não há rotas: a aplicação é uma única página.
- Não há Socket.IO nem auditoria Lighthouse.
- O `package.json` tem as chaves `test:e2e` e `test:e2e:report` **fora** de `scripts` (os testes só rodam via `npx playwright test`).
- Imagens dos NFTs vêm de URLs externas (Unsplash), dependendo de rede em tempo de execução.

## 14. Roadmap de implementação (ordem sugerida)

Itens concluídos: ~~checkout com pedido idempotente e tela de confirmação~~, ~~carrinho persistente e valores em string decimal~~, ~~teste Playwright dos fluxos principais~~.

1. Cotação (`POST /quotes`) alimentando o resumo do checkout.
2. TanStack Router, com busca e filtros na URL, página de detalhe do NFT e rotas privadas.
3. Socket.IO simulado com `nft.updated` e `order.updated` (substitui o polling).
4. Cadastro, favoritos (com atualização otimista), perfil e carteiras.
5. Tratamento de expiração de sessão com retomada de contexto.
6. Auditoria Lighthouse, acessibilidade e fidelidade ao Figma.

O backend segue o roadmap detalhado da seção 15, que dita a ordem das dependências entre API e interface.

## 15. Roadmap detalhado do backend (API simulada)

### 15.1 Princípios

- **Servidor é a fonte da verdade** para preço, estoque, descontos, taxas e totais; o cliente apenas exibe.
- **Valores monetários sempre como string decimal**, calculados com `Decimal`.
- **Mutações seguras para repetição:** toda operação que cria ou muda estado crítico aceita repetição sem efeito duplicado.
- **Erros previsíveis:** formato `{ error: { code, message } }` com códigos estáveis.
- **Determinismo para testes:** qualquer comportamento aleatório ou temporal pode ser forçado por cenário.

### 15.2 Visão geral das fases

| Fase | Tema                          | Objetivo                                                         | Depende de |
| ---- | ----------------------------- | ---------------------------------------------------------------- | ---------- |
| 0    | Fundação                      | Base única de dados, auth e erros; corrigir lacunas do que já existe | -          |
| 1    | Catálogo                      | Busca, filtros, ordenação, paginação e detalhe no servidor       | 0          |
| 2    | Compra completa               | Cotação, carteira no pedido, estoque real, recusa e histórico    | 0, 1       |
| 3    | Conta e usuário               | Cadastro, perfil, carteiras, favoritos                           | 0          |
| 4    | Tempo real                    | Socket.IO simulado, versionamento e reconciliação                | 2          |
| 5    | Cenários e qualidade          | Cenários configuráveis, testes de contrato e segurança           | 0–4        |

### Fase 0 — Fundação

Corrige o que existe antes de crescer. Nenhuma funcionalidade nova visível ao usuário.

| #   | Tarefa                                                                                                                                                                         | Critério de aceite                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 0.1 | Dividir `browser.ts` em módulos: `src/mocks/handlers/{auth,nfts,orders}.ts`, `src/mocks/http.ts` (`errorResponse`, `requireAuth`) e `src/mocks/index.ts` (export dos handlers e `worker`) | Nenhum handler repete a leitura do token; `browser.ts` fica só com `setupWorker`                             |
| 0.2 | Banco único persistente (`src/mocks/db.ts`) com coleções `users`, `nfts`, `orders`, `idempotencyKeys`, `sessions`, versionado (`schemaVersion`) e migração/limpeza se divergir | Recarregar a página mantém usuários, estoque e pedidos; um `resetDb()` volta ao seed                       |
| 0.3 | Catálogo de erros (`src/mocks/errors.ts`) com os códigos já usados e os novos                                                                                                   | Todos os handlers usam constantes; nenhuma string literal de código fora do catálogo                        |
| 0.4 | Sessões do lado do servidor: `login` cria registro em `sessions`; `logout` revoga; `requireAuth` valida existência, revogação e expiração                                       | Após logout, o mesmo token passa a retornar 401 `SESSION_INVALID` (teste E2E)                               |
| 0.5 | `POST /auth/refresh` (renova a janela de 30 min) e interceptor de resposta que, em 401 com sessão ativa, tenta uma vez e repete a requisição original                          | Sessão não cai durante um checkout longo; falha do refresh leva ao estado deslogado                         |
| 0.6 | Remover `mockUser` morto; mover contas para `users` do banco; senha com salt por usuário (SHA-256 + salt) como simulação                                                         | `fixtures/db.ts` sem exports sem uso; hash difere entre contas com a mesma senha                            |
| 0.7 | Corrigir `package.json`: mover `test:e2e` e `test:e2e:report` para `scripts`                                                                                                    | `npm run test:e2e` executa o Playwright                                                                     |

### Fase 1 — Catálogo no servidor

| #   | Tarefa                                                                                                                                                                                  | Critério de aceite                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1.1 | `GET /nfts` com query: `q`, `category`, `sort` (`price_asc`, `price_desc`, `likes_desc`, `recent`), `page`, `limit` (padrão 12, máx. 50). Resposta `{ items, total, page, pageSize, totalPages }` | Parâmetros inválidos → 422 `VALIDATION_ERROR`; busca ignora acentos e caixa                              |
| 1.2 | `GET /nfts/:id` com 404 `NOT_FOUND`                                                                                                                                                     | Retorna o NFT com estoque atual                                                                          |
| 1.3 | `GET /categories` (lista distinta com contagem)                                                                                                                                          | Filtros do cliente deixam de ser derivados da lista carregada                                            |
| 1.4 | Ampliar o seed: ≥ 24 NFTs, ≥ 5 categorias, um NFT esgotado (`availableQuantity: 0`) e um com preço de muitas casas decimais (ex.: `0.000123`)                                           | Paginação e casos limite de precisão ficam exercitáveis                                                  |
| 1.5 | Suporte a `AbortSignal` no cliente e resposta rápida para consultas canceladas (nenhum efeito colateral em GET)                                                                          | Digitar na busca não exibe resultado de consulta antiga (teste E2E)                                      |

Impacto no frontend: `['nfts', { q, category, sort, page }]` como chave de query; filtros na URL (TanStack Router).

### Fase 2 — Compra completa

| #   | Tarefa                                                                                                                                                                                                                                             | Critério de aceite                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | `POST /quotes`: corpo `{ items, couponCode?, walletId? }`. Resposta com linhas, `subtotal`, `discount`, `networkFee`, `total`, `expiresAt` (validade da cotação, 60 s) e `warnings` por item (estoque insuficiente, preço mudou)                | Mesmo cálculo do pedido (função única `computeTotals`); cupom inválido → 422 `COUPON_INVALID`; cotação expirada na criação do pedido → 409 `QUOTE_EXPIRED` |
| 2.2 | Cupons no banco: `PROMO10` (10%), `FRETE0` (taxa zero), um expirado e um com limite de uso                                                                                                                                                         | Cada cupom tem um teste de contrato                                                                                              |
| 2.3 | Taxa de rede variável (por quantidade de itens) em vez de constante                                                                                                                                                                                | `networkFee` depende da composição do pedido; cobertura de teste com 1 e 5 itens                                                 |
| 2.4 | `POST /orders` passa a aceitar `quoteId?`, `couponCode?` e `walletId` (obrigatório); valida que a carteira pertence ao usuário                                                                                                                       | Carteira alheia → 403 `FORBIDDEN`; sem carteira → 422 `VALIDATION_ERROR`                                                         |
| 2.5 | **Débito de estoque** ao criar o pedido (reserva) e devolução se o pedido for `rejected`                                                                                                                                                           | Duas compras que somam mais que o estoque: a segunda recebe 409 `AVAILABILITY_CONFLICT`; estoque persiste após refresh          |
| 2.6 | Concorrência: a reserva e o registro da chave de idempotência ocorrem na mesma operação síncrona (sem `await` entre a checagem e a gravação, hoje há `delay(600)` antes)                                                                             | Duas requisições simultâneas com a mesma chave criam **um** pedido                                                               |
| 2.7 | Ciclo de vida completo: `pending → confirmed \| rejected`; motivo em `rejectionReason` (`PAYMENT_FAILED`, `OUT_OF_STOCK`)                                                                                                                          | Cenário `?scenario=reject` ou carteira de teste específica produz `rejected`; cliente exibe o estado "Recusado" já existente     |
| 2.8 | `GET /orders` (histórico) com `page`, `limit` e `status`                                                                                                                                                                                           | Ordenado por `createdAt` desc; só pedidos do usuário autenticado                                                                 |
| 2.9 | Expiração de chaves de idempotência (24 h) e limpeza no `resetDb()`                                                                                                                                                                                | Chave expirada deixa de ser reaproveitada                                                                                        |
| 2.10 | Campo `version` em NFT e Pedido (incrementa a cada mudança)                                                                                                                                                                                       | Pré-requisito da fase 4                                                                                                          |

### Fase 3 — Conta e usuário

| #   | Tarefa                                                                                                                                                | Critério de aceite                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 3.1 | `POST /auth/register`: nome, e-mail, senha (mín. 8, maiúscula, número e símbolo); retorna `{ token, user }`                                           | E-mail duplicado → 409 `EMAIL_TAKEN`; senha fraca → 422 com `fields`                                   |
| 3.2 | Padronizar erros de validação: `{ error: { code, message, fields: { campo: mensagem } } }`                                                            | RHF + Zod mapeiam `fields` para os campos do formulário                                               |
| 3.3 | `GET /profile`, `PATCH /profile` (nome, avatar por URL/data URL ≤ 200 KB), `POST /profile/password` (senha atual obrigatória)                          | Senha atual errada → 403 `INVALID_CREDENTIALS`; senha nova revoga demais sessões                      |
| 3.4 | `GET /wallets`, `POST /wallets` (validação de endereço `0x` + 40 hex e rede), `PATCH /wallets/:id` (apelido, `isPrimary`), `DELETE /wallets/:id`        | Sempre exatamente uma carteira primária; não remove a última carteira; endereço duplicado → 409       |
| 3.5 | `GET /favorites`, `PUT /favorites/:nftId`, `DELETE /favorites/:nftId` **idempotentes**; `likes` e `isLiked` coerentes em `GET /nfts` e `GET /nfts/:id` | Repetir `PUT` não incrementa `likes` duas vezes; `isLiked` só aparece autenticado                     |
| 3.6 | Falha injetável nos favoritos (cenário) para exercitar atualização otimista com rollback                                                              | Teste E2E: o coração volta ao estado anterior quando a API falha                                      |
| 3.7 | (Opcional) `GET/PUT /cart` por usuário no servidor, com merge ao logar                                                                                 | Só entra se o carrinho local deixar de bastar; decisão registrada neste documento                     |

### Fase 4 — Tempo real

| #   | Tarefa                                                                                                                                                              | Critério de aceite                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 4.1 | Servidor Socket.IO simulado com `@mswjs/socket.io-binding`; autenticação no handshake com o mesmo token                                                              | Conexão sem token válido é recusada                                                                  |
| 4.2 | Eventos `nft.updated` (estoque/preço/likes) e `order.updated` (mudança de status), com envelope `{ id, resource, resourceId, version, occurredAt, data }`            | Todo evento carrega `version` igual ao da entidade                                                   |
| 4.3 | `order.updated` apenas para o dono do pedido (sala por usuário)                                                                                                     | Outro usuário nunca recebe o evento                                                                  |
| 4.4 | Endpoint de reconciliação: `GET /events?since=<cursor>` ou reler `GET /nfts` e `GET /orders/:id` após reconexão                                                      | Cliente desconectado por 10 s volta ao estado correto                                                |
| 4.5 | Simulação de duplicata, fora de ordem e queda de conexão (via cenário)                                                                                              | Cliente descarta evento com `version` ≤ a conhecida                                                  |
| 4.6 | Substituir o polling do `OrderModal` por evento, mantendo polling como contingência                                                                                  | Logout fecha o socket e remove todos os listeners                                                    |

### Fase 5 — Cenários e qualidade

| #   | Tarefa                                                                                                                                                                                             | Critério de aceite                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 5.1 | Motor de cenários (`src/mocks/scenarios.ts`) lido de `?scenario=` ou `localStorage`: `slow` (latência), `flaky` (falha 30%), `server-error` (500), `session-expired`, `reject-orders`, `out-of-stock`, `socket-drop` | Cada cenário é ativável por URL e por teste Playwright                                                  |
| 5.2 | `POST /__reset` (somente mocks): restaura seed e cenário                                                                                                                                            | `beforeEach` dos E2E usa o reset em vez de limpar `localStorage` manualmente                            |
| 5.3 | Rate limit de login: 5 falhas em 5 min → 429 `TOO_MANY_ATTEMPTS` com `Retry-After`                                                                                                                  | Cliente exibe o tempo de espera                                                                         |
| 5.4 | Contrato único (schemas Zod em `src/contracts/`) usado pelos handlers **e** pelo cliente para validar respostas                                                                                     | Resposta fora do contrato falha no teste, não em produção                                               |
| 5.5 | Testes de API (Playwright `request` ou Vitest) cobrindo cada rota: sucesso, validação, 401, 403, 404, 409                                                                                           | Matriz rota × erro preenchida                                                                           |
| 5.6 | Cabeçalhos realistas na simulação: `ETag`/`If-None-Match` em `GET /nfts` (304) e `Retry-After` nos 429/503                                                                                          | Cache do navegador e do TanStack Query se comportam como com API real                                   |
| 5.7 | Documentar o caminho de produção: troca de token em `localStorage` por cookie `HttpOnly` + CSRF, hash com Argon2/bcrypt, estoque em banco transacional                                               | Seção "Do mock à produção" neste documento                                                              |

### 15.3 Matriz de contratos finais (alvo)

| Método | Rota                       | Auth | Fase | Observações                                          |
| ------ | -------------------------- | ---- | ---- | ---------------------------------------------------- |
| POST   | `/auth/register`           | Não  | 3    | 409 `EMAIL_TAKEN`                                    |
| POST   | `/auth/login`              | Não  | feito | 429 na fase 5                                        |
| POST   | `/auth/refresh`            | Sim  | 0    |                                                      |
| GET    | `/auth/session`            | Sim  | feito |                                                      |
| POST   | `/auth/logout`             | Sim  | 0    | passa a revogar a sessão                             |
| GET    | `/nfts`                    | Não  | 1    | paginado; `isLiked` se autenticado                   |
| GET    | `/nfts/:id`                | Não  | 1    |                                                      |
| GET    | `/categories`              | Não  | 1    |                                                      |
| GET    | `/favorites`               | Sim  | 3    |                                                      |
| PUT    | `/favorites/:nftId`        | Sim  | 3    | idempotente                                          |
| DELETE | `/favorites/:nftId`        | Sim  | 3    | idempotente                                          |
| POST   | `/quotes`                  | Sim  | 2    | expira em 60 s                                       |
| POST   | `/orders`                  | Sim  | feito | + `walletId`, `quoteId`, débito de estoque na fase 2 |
| GET    | `/orders`                  | Sim  | 2    | histórico                                            |
| GET    | `/orders/:id`              | Sim  | feito | + `rejectionReason`, `version`                       |
| GET    | `/profile`                 | Sim  | 3    |                                                      |
| PATCH  | `/profile`                 | Sim  | 3    |                                                      |
| POST   | `/profile/password`        | Sim  | 3    |                                                      |
| GET    | `/wallets`                 | Sim  | 3    |                                                      |
| POST   | `/wallets`                 | Sim  | 3    |                                                      |
| PATCH  | `/wallets/:id`             | Sim  | 3    |                                                      |
| DELETE | `/wallets/:id`             | Sim  | 3    |                                                      |

### 15.4 Catálogo de erros (alvo)

| Código                      | HTTP | Quando                                              |
| --------------------------- | ---- | --------------------------------------------------- |
| `VALIDATION_ERROR`          | 422  | Corpo/consulta inválidos (com `fields`)             |
| `INVALID_CREDENTIALS`       | 401/403 | Login ou senha atual incorretos                  |
| `SESSION_INVALID`           | 401  | Token ausente, expirado ou revogado                 |
| `FORBIDDEN`                 | 403  | Recurso de outro usuário                            |
| `NOT_FOUND`                 | 404  | Recurso inexistente                                 |
| `EMAIL_TAKEN`               | 409  | Cadastro com e-mail existente                       |
| `AVAILABILITY_CONFLICT`     | 409  | Quantidade acima do estoque                         |
| `IDEMPOTENCY_KEY_REUSED`    | 409  | Mesma chave com conteúdo diferente                  |
| `IDEMPOTENCY_KEY_REQUIRED`  | 422  | Cabeçalho ausente                                   |
| `QUOTE_EXPIRED`             | 409  | Cotação vencida ao criar o pedido                   |
| `COUPON_INVALID`            | 422  | Cupom inexistente, vencido ou esgotado              |
| `WALLET_DUPLICATED`         | 409  | Endereço já cadastrado                              |
| `TOO_MANY_ATTEMPTS`         | 429  | Limite de tentativas de login                       |
| `INTERNAL_ERROR`            | 500  | Falha simulada                                      |

### 15.5 Sequência recomendada e riscos

**Caminho crítico:** 0.1 → 0.2 → 0.4 → 2.5 → 2.6 → 2.10 → 4.2.

Em ordem de execução prática: **Fase 0 completa → 1.1/1.2 (destrava o Router e a página de detalhe) → 2.1–2.5 (destrava o checkout real) → 3.1 e 3.4 (cadastro e carteiras, exigidos pelo pedido) → 3.5 → fase 4 → fase 5**.

| Risco                                                                    | Mitigação                                                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `localStorage` como banco: limite de ~5 MB e corrupção por outra aba      | Banco com `schemaVersion`, `try/catch` já adotado em `ordersStore.ts` e evento `storage` para sincronizar abas |
| Débito de estoque quebra os E2E atuais (compra repetida)                  | `POST /__reset` no `beforeEach` (5.2) antes de ativar 2.5                                        |
| MSW não suporta Socket.IO nativamente                                     | `@mswjs/socket.io-binding`; fallback em polling mantido (4.6)                                    |
| Divergência entre tipos do cliente e respostas do mock                    | Contratos Zod compartilhados (5.4) e remoção dos tipos duplicados (`Order` em `types` e `services/orders.ts`) |
| Mock confundido com segurança real                                         | Seção 13 e item 5.7 mantêm explícito que auth/hash são simulações                                 |

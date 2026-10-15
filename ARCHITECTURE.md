# ARCHITECTURE.md — NFT Marketplace

Documento de arquitetura do projeto. Ele separa com clareza **o que está implementado hoje**, **o que está planejado** e **as limitações conhecidas**, para que quem avalia saiba exatamente o estado da entrega.

## 1. Estado atual da entrega

| Área                                                                         | Status                             |
| ---------------------------------------------------------------------------- | ---------------------------------- |
| Catálogo de NFTs consumindo API simulada (MSW + Axios + TanStack Query)      | Implementado                       |
| Busca por texto e filtro por categoria                                       | Implementado (no cliente)          |
| Carrinho (adicionar, remover, esvaziar, total)                               | Implementado (Zustand, em memória) |
| Login, sessão e logout via API simulada, com sessão recuperada após refresh  | Implementado                       |
| Estados de carregamento, erro e vazio no catálogo                            | Implementado (versão básica)       |
| Deploy na Vercel com mocks ativos                                            | Implementado                       |
| Roteamento (TanStack Router), detalhe, checkout, perfil, carteiras           | Planejado                          |
| Cadastro, rotas privadas, expiração de sessão durante a navegação, favoritos | Planejado                          |
| Cotação, pedidos idempotentes, recibo                                        | Planejado                          |
| Tempo real (Socket.IO via MSW)                                               | Planejado                          |
| shadcn/ui, skeletons com shimmer, acessibilidade completa                    | Planejado                          |
| Testes Playwright, auditoria Lighthouse                                      | Planejado                          |

## 2. Stack

| Responsabilidade    | Tecnologia                                     | Uso atual                                 |
| ------------------- | ---------------------------------------------- | ----------------------------------------- |
| Interface           | React + TypeScript (Vite)                      | Em uso                                    |
| Estilização         | Tailwind CSS v4 (`@tailwindcss/vite`)          | Em uso                                    |
| Cliente HTTP        | Axios (`src/services/api.ts`, `baseURL: /api`) | Em uso (com interceptor de token)         |
| Estado remoto       | TanStack Query                                 | Em uso (NFTs, sessão e mutation de login) |
| Estado global de UI | Zustand                                        | Em uso (carrinho)                         |
| Mocking             | MSW                                            | Em uso (dev e build publicado)            |
| Roteamento          | TanStack Router                                | Instalado, ainda não utilizado            |
| Tempo real          | socket.io-client                               | Instalado, ainda não utilizado            |
| Formulários         | React Hook Form + Zod                          | Instalados, ainda não utilizados          |
| Componentes         | shadcn/ui                                      | Não adotado ainda                         |
| Testes E2E          | Playwright                                     | Não configurado ainda                     |

## 3. Estrutura do projeto

```text
src/
├── components/
│   ├── CartModal.tsx        # modal do carrinho
│   └── LoginModal.tsx       # modal de login (useMutation + API)
├── hooks/
│   └── useSession.ts        # useQuery da sessão (recuperada após refresh)
├── mocks/
│   ├── browser.ts           # setupWorker + handlers (NFTs e autenticação)
│   └── fixtures/db.ts       # NFTs, usuário de exemplo e contas de teste
├── pages/
│   └── Home.tsx             # catálogo, busca, filtros, cabeçalho
├── services/
│   ├── api.ts               # instância Axios + interceptor do token
│   ├── auth.ts              # login, fetchSession, logout, token
│   └── useCartStore.ts      # store Zustand do carrinho
├── types/index.ts           # NFT, User, Wallet, CartItem, Order
├── App.tsx
└── main.tsx                 # QueryClientProvider + ativação do MSW
```

## 4. Contratos REST

### Implementados (handlers MSW em `src/mocks/browser.ts`)

| Método | Rota                | Descrição                                              | Erros                                             |
| ------ | ------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| GET    | `/api/nfts`         | Lista completa de NFTs (sem paginação)                 | -                                                 |
| POST   | `/api/auth/login`   | Corpo `{ email, password }`; devolve `{ token, user }` | 401 `INVALID_CREDENTIALS`, 422 `VALIDATION_ERROR` |
| GET    | `/api/auth/session` | Usuário da sessão, via `Authorization: Bearer <token>` | 401 `SESSION_INVALID`                             |
| POST   | `/api/auth/logout`  | Encerra a sessão (resposta 204)                        | -                                                 |

Formato de erro padrão: `{ "error": { "code": "...", "message": "..." } }`.

### Planejados (ainda **não** implementados)

| Recurso   | Operações previstas                                                                |
| --------- | ---------------------------------------------------------------------------------- |
| Conta     | `POST /auth/register`                                                              |
| NFTs      | Busca/filtros/ordenação/paginação no servidor e `GET /nfts/:id`                    |
| Favoritos | `GET`, `PUT`, `DELETE /favorites/:nftId`                                           |
| Carrinho  | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id` |
| Cotação   | `POST /quotes` (cupom, disponibilidade, descontos, taxas, total)                   |
| Pedidos   | `POST /orders` (com `Idempotency-Key`), `GET /orders/:id`                          |
| Perfil    | `GET`/`PATCH /profile`, avatar, alteração de senha                                 |
| Carteiras | `GET`, `POST`, `PATCH /wallets`                                                    |

## 5. Sessão e autenticação

**Como funciona hoje**

1. O `LoginModal` usa `useMutation` para chamar `POST /api/auth/login`. Credenciais inválidas retornam 401, e a mensagem da API é exibida no modal (`role="alert"`).
2. Em caso de sucesso, o token é salvo em `localStorage` (chave `nft-marketplace:token`) e o usuário é gravado no cache do TanStack Query (`['session']`).
3. Um interceptor do Axios anexa `Authorization: Bearer <token>` a toda requisição.
4. Ao abrir ou recarregar a página, o hook `useSession` consulta `GET /api/auth/session`. Se o token for válido, a sessão é restaurada; se for inválido ou expirado, o token é removido e o usuário volta ao estado deslogado.
5. No logout, a API é chamada, o token é removido, a sessão é limpa do cache e o carrinho é esvaziado para que o próximo usuário não veja os itens do anterior.

**Sobre o mock:** o token tem o formato `mock.<userId>.<expiraEm>` (validade de 30 minutos) e não é assinado. As senhas das contas de teste ficam guardadas como hash SHA-256 (sem salt) e são comparadas na API simulada, nunca em claro.

**Contas fictícias:** `larissa@exemplo.com` / `Senha@123` e `chavesdo8@exemplo.com` / `Senha@456`.

**Ainda não implementado:** cadastro, rotas privadas com redirecionamento ao login, tratamento de expiração durante a navegação e o checkout (preservando contexto), e limpeza de subscriptions (não há Socket.IO ainda).

## 6. Estado do servidor e estratégia de cache

| Consulta      | Chave         | Política                                                         |
| ------------- | ------------- | ---------------------------------------------------------------- |
| Lista de NFTs | `['nfts']`    | Padrão do TanStack Query (sem `staleTime`/`gcTime` customizados) |
| Sessão        | `['session']` | `staleTime` de 5 minutos, `retry: false`                         |

- Busca por texto e filtro por categoria são aplicados **no cliente**, sobre a lista já carregada. A URL **não** reflete busca/filtros.
- O login é uma mutation que atualiza o cache da sessão com `setQueryData`; o logout limpa a mesma chave.
- Estados de `isLoading` e `error` do catálogo são tratados com mensagens simples.
- Ainda não há atualização otimista nem invalidação de cache por eventos.

**Planejado:** chaves de query com os parâmetros de busca, filtros na URL (search params do TanStack Router), política de cache completa documentada, cancelamento de respostas obsoletas via `AbortSignal` e pelo menos uma atualização otimista (favoritos) com rollback.

## 7. Estado do carrinho

- Gerenciado por uma store Zustand (`useCartStore`): `addItem`, `removeItem`, `clearCart`.
- O estado vive **em memória**: some ao recarregar a página. É esvaziado no logout.
- O carrinho **não** consulta nem sincroniza com a API, não respeita disponibilidade por edição e não é vinculado a um usuário.
- O total é calculado no cliente com `Number(priceEth) * quantity` e exibido com `toFixed(2)`. Isso **não** atende ao requisito de precisão decimal para ETH.
- O botão "Finalizar Compra" apenas exibe um `alert` e esvazia o carrinho. **Não existe fluxo de checkout, cotação nem pedido.**

**Planejado:** carrinho persistido, valores em string decimal com biblioteca de precisão, cotação como fonte do resumo e fluxo de checkout com pedido idempotente.

## 8. Tempo real e reconciliação REST × Socket.IO

Não implementado. A dependência `socket.io-client` está instalada, mas nenhum evento (`nft.updated`, `order.updated`) é emitido ou consumido.

**Planejado:** servidor Socket.IO simulado via `@mswjs/socket.io-binding`, eventos com id, recurso e versão, descarte de duplicatas e eventos antigos, reconciliação com REST após reconexão e liberação de listeners no logout.

## 9. Mocking com MSW

- Handlers definidos em `src/mocks/browser.ts` e dados em `src/mocks/fixtures/db.ts` (3 NFTs e 2 contas de teste).
- O worker é iniciado em `src/main.tsx` quando `VITE_ENABLE_MOCKS === "true"`, valor definido em `.env.development` e `.env.production`. Assim, o MSW roda também no build publicado.
- Os handlers são executados no navegador. A sessão persiste porque o token fica em `localStorage`.
- Ainda não existem cenários configuráveis (latência, falhas, sessão expirada etc.) nem reset de cenário.

## 10. Decisões de UX

- Modais com fundo desfocado (`backdrop-blur`).
- Contador de itens no botão do carrinho.
- Estado vazio amigável quando a busca não retorna resultados.
- Alerta visual quando a requisição do catálogo falha.
- Login com mensagem de erro clara, botão desabilitado e texto "Autenticando..." durante a requisição, e dica com conta de teste.

## 11. Acessibilidade e responsividade

Parcialmente atendidas. O modal de login tem `role="dialog"`, `aria-modal`, rótulos associados aos campos (`htmlFor`/`id`) e mensagem de erro com `role="alert"`. O layout usa classes responsivas do Tailwind (grid de 1 coluna no mobile, 3 no desktop). Ainda faltam: focus trap e fechamento com `Esc` nos modais (inclusive o do carrinho), `aria-label` nos botões com emoji, feedback `aria-live` para o carrinho, skeletons com `prefers-reduced-motion` e validação nas larguras 390/768/1440.

## 12. Desvios do Figma

Ainda não foi feita a aderência fiel ao layout do Figma (tipografia, cores, espaçamentos, composição). A interface atual é uma interpretação própria com Tailwind. Este item deve ser revisado tela a tela.

## 13. Limitações conhecidas

- Token de sessão guardado em `localStorage` e não assinado (aceitável apenas no ambiente simulado; em produção, o recomendado é cookie `HttpOnly`).
- Hash SHA-256 sem salt nas contas de teste.
- Expiração de sessão não é tratada durante a navegação nem no checkout; não há rotas privadas.
- Carrinho não persiste após refresh e não é associado a um usuário.
- Valores em ETH usam `Number`, sem precisão decimal.
- Não há checkout, cotação, pedidos, favoritos, perfil, carteiras nem cadastro.
- Não há rotas: a aplicação é uma única página.
- Não há Socket.IO, testes E2E nem auditoria Lighthouse.
- Imagens dos NFTs vêm de URLs externas (Unsplash), dependendo de rede em tempo de execução.

## 14. Roadmap de implementação (ordem sugerida)

1. Checkout com pedido idempotente e tela de confirmação.
2. Carrinho persistente e valores em string decimal.
3. TanStack Router, com busca e filtros na URL, página de detalhe do NFT e rotas privadas.
4. Teste Playwright dos fluxos principais.
5. Socket.IO simulado com `nft.updated` e `order.updated`.
6. Cadastro, favoritos (com atualização otimista), perfil e carteiras.
7. Tratamento de expiração de sessão com retomada de contexto.
8. Auditoria Lighthouse, acessibilidade e fidelidade ao Figma.

# ARCHITECTURE.md — KURIO · Marketplace de NFTs

Documento de arquitetura. Separa **o que está implementado e verificado**, **o que é parcial** e **as limitações conhecidas**.
O plano detalhado e a rastreabilidade de requisitos estão em [ROADMAP.md](./ROADMAP.md).

> **Backend:** neste projeto o "backend" é uma **API REST + Socket.IO simulada com MSW**, executada no navegador (`src/mocks/`). O contrato é o mesmo que um servidor real teria; a persistência é o `localStorage`.

## 1. Estado da entrega

| Área | Status |
| --- | --- |
| Rotas reais (TanStack Router), busca/filtros/ordenação/página **na URL** | Implementado |
| Catálogo no servidor: busca, facetas com contagem, faixa de preço, ordenação, paginação | Implementado |
| Detalhe do NFT (avaliações, relacionados, esgotado, 404) | Implementado |
| Carrinho: visitante (local) e logado (servidor), mescla no login | Implementado |
| Cotação (`/quotes`): rede, cupom, expiração, avisos de estoque | Implementado |
| Pedido idempotente, estoque debitado, falha com devolução, histórico, recibo | Implementado |
| Pagamento com carteira (principal/secundária) | Implementado |
| Login, cadastro, esqueci a senha, login social (simulado), sessão, refresh, logout revogando o token | Implementado |
| Rotas privadas com retorno ao contexto; expiração durante a navegação e o checkout | Implementado |
| Perfil (dados, avatar, senha) e Carteiras (CRUD, principal única) | Implementado |
| Favoritos idempotentes com atualização otimista e rollback | Implementado |
| Tempo real: `nft.updated` / `order.updated` por Socket.IO simulado, com descarte e reconciliação | Implementado |
| Design system claro (DESIGN-SYSTEM.md): tokens, Inter, cards 20 px, hero, filtro dropdown composto, skeletons, estados vazio/erro | Implementado |
| Acessibilidade: foco, teclado, `aria-live`, diálogos com foco preso e `Esc`, contraste dos tokens | Implementado (testado) |
| Responsivo em 390 / 768 / 1440 sem rolagem horizontal | Implementado (testado) |
| Testes E2E Playwright (desktop e mobile) cobrindo API e interface | Implementado — 107 testes × 2 projetos |
| Auditoria Lighthouse automatizada (`npm run lighthouse`) | Implementado |
| Deploy na Vercel com mocks ativos | Configurado (veja seção 13) |
| Fidelidade pixel a pixel às referências visuais | **Parcial** (tokens, tipografia e componentes do DS; sem comparação quadro a quadro) |
| `shadcn/ui` via CLI (`components.json`, preset Vega/Radix) | Implementado |
| `cart.updated` (Socket.IO, opcional) e blog/CMS reais | Não implementado |

## 2. Stack

| Responsabilidade | Tecnologia | Uso |
| --- | --- | --- |
| Interface | React 19 + TypeScript + Vite | Em uso |
| Estilo | Tailwind CSS v4 (`@theme inline` + variáveis do shadcn) | Em uso |
| Componentes | shadcn/ui via CLI: button, input, label, dialog, sheet, tabs, popover, checkbox, badge, avatar, card, alert, skeleton, sonner (Radix) | Em uso (`src/components/ui`, `components.json`) |
| Fonte | Inter Variable (`@fontsource-variable/inter`, sem rede externa) | Em uso |
| Ícones | lucide-react | Em uso |
| Roteamento | TanStack Router (código, rotas lazy, `validateSearch` com Zod) | Em uso |
| Estado remoto | TanStack Query | Em uso |
| Estado de UI | Zustand (`persist` no carrinho anônimo; toasts) | Em uso |
| Formulários | React Hook Form + Zod (`@hookform/resolvers`) | Em uso (login, cadastro, perfil, carteiras, newsletter) |
| HTTP | Axios (interceptors de token e de renovação) | Em uso |
| Tempo real | socket.io-client (carregado sob demanda) | Em uso |
| Precisão decimal | decimal.js | Em uso (cliente e API simulada) |
| API simulada | MSW 3 (`http`, `ws`) + `@mswjs/socket.io-binding` | Em uso |
| Testes | Playwright | Em uso |
| Qualidade | oxlint, Lighthouse | Em uso |

## 3. Estrutura

```text
src/
├── components/        Layout (Header, Sheet móvel, Footer), NftCard, FavoriteButton
│   ├── FilterDropdown, Field, states (EmptyState, ErrorState, PageTitle)
│   └── ui/            componentes gerados pela CLI do shadcn
├── hooks/             useSession (sessão, merge do carrinho, limpeza), useCart (visitante x servidor)
├── pages/             Home, NftDetail, Cart, Checkout, Order, Orders, Favorites, Auth, Profile, Wallets
├── services/          api.ts (Axios + refresh), endpoints.ts (contratos), socket.ts, toast.ts, attempt.ts, useCartStore.ts
├── mocks/             API simulada (seção 5)
├── types/index.ts     Contratos tipados
├── utils/money.ts     Decimal
├── router.tsx         Rotas, guardas e serialização limpa da URL
└── main.tsx           QueryClient, RouterProvider, ativação do MSW
tests/e2e/             api-*.spec.ts (contrato) e ui-*.spec.ts (interface)
scripts/lighthouse.mjs Auditoria do build de produção
```

## 4. Rotas da aplicação

| Rota | Acesso | Observações |
| --- | --- | --- |
| `/` | público | `?q&collection&network&minPrice&maxPrice&tab&sort&page` |
| `/nfts/$id` | público | detalhe, avaliações, relacionados |
| `/cart` | público | visitante usa o carrinho local |
| `/login?redirect=` | público | `redirect` só aceita caminhos internos |
| `/register`, `/forgot-password` | público | |
| `/checkout`, `/order/$id`, `/orders`, `/favorites`, `/profile`, `/wallets` | **privado** | sem sessão → `/login?redirect=<url original>` |

## 5. API simulada (backend)

```text
src/mocks/
├── index.ts          setupWorker, startMocks(), window.__kurioMocks (ferramentas de teste)
├── db.ts             "banco" em localStorage (schemaVersion), estoque, preços, pedidos, resolução
├── http.ts           route(): latência/falhas, sessão, JSON, validações
├── errors.ts         catálogo único de códigos de erro
├── scenarios.ts      cenários configuráveis
├── bus.ts            eventos de domínio → socket
├── socket.ts         servidor Socket.IO simulado
├── fixtures/seed.ts  27 NFTs, 6 coleções, 3 redes, usuários, carteiras, cupons
└── handlers/         auth, catalog, favorites, cart, commerce, account, content, admin
```

### 5.1 Contratos REST

Convenções: base `/api`; `Authorization: Bearer <token>`; erro `{ "error": { "code", "message", "details?" } }`; validação com `details.fields`; valores monetários em **string decimal**.

| Método | Rota | Auth | Resumo |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | 201 `{token,user}`; 409 `EMAIL_TAKEN`; 422 com campos |
| POST | `/auth/login` | — | 200; 401 `INVALID_CREDENTIALS`; 422; **429** após 5 falhas/5 min (`Retry-After`) |
| GET | `/auth/session` | ✔ | `{user, expiresAt}` |
| POST | `/auth/refresh` | ✔ | renova a janela de 30 min |
| POST | `/auth/logout` | — | 204 e **revoga** o token no servidor |
| POST | `/auth/forgot-password` | — | 202 (não revela se o e-mail existe) |
| POST | `/auth/social/:provider` | — | login social simulado (`google`, `github`) |
| GET | `/nfts` | opc. | `q, collection, network, minPrice, maxPrice, tab, sort, page, pageSize` → `{items,page,pageSize,total,totalPages}` |
| GET | `/nfts/:id`, `/nfts/:id/related`, `/nfts/:id/reviews` | opc. | 404 `NOT_FOUND` |
| GET | `/facets`, `/collections` | — | contagens por faceta |
| GET/PUT/DELETE | `/favorites[/:nftId]` | ✔ | PUT/DELETE idempotentes (204) |
| GET/DELETE | `/cart` | ✔ | `{items, version, subtotal}` |
| POST/PATCH/DELETE | `/cart/items[/:id]` | ✔ | 409 `AVAILABILITY_CONFLICT` com `details.available` |
| POST | `/cart/merge` | ✔ | mescla carrinho anônimo respeitando o estoque (`adjusted[]`) |
| POST | `/quotes` | ✔ | `{id,lines,subtotal,discount,networkFee,total,expiresAt(60 s),warnings[]}`; 422 `COUPON_INVALID` |
| POST | `/orders` | ✔ | `Idempotency-Key` obrigatório; 201 novo / 200 repetido; 409 `IDEMPOTENCY_KEY_REUSED`, `AVAILABILITY_CONFLICT`, `QUOTE_EXPIRED`, `QUOTE_MISMATCH` |
| GET | `/orders`, `/orders/:id`, `/orders/:id/receipt` | ✔ | 403 para pedido alheio; recibo com `explorerUrl` |
| GET/PATCH | `/profile` | ✔ | nome e preferências |
| PUT | `/profile/avatar`, POST `/profile/password` | ✔ | 403 `WRONG_PASSWORD`; troca encerra as outras sessões |
| GET/POST/PATCH/DELETE | `/wallets[/:id]` | ✔ | 409 `WALLET_DUPLICATED`, `LAST_WALLET`; 422 `WALLET_PRIMARY_REQUIRED` |
| GET | `/posts` | — | novidades |
| POST | `/newsletter` | — | idempotente (201 / 200) |
| POST/GET/PUT | `/__reset`, `/__scenario` | — | **somente mock** |

### 5.2 Regras de negócio

- **Servidor é a fonte da verdade** para preço, estoque, desconto, taxa e total (`computeTotals`, uma função usada por cotação e pedido).
- **Taxa de rede** = `(0,0021 + 0,0004 × (unidades − 1)) × multiplicador da rede` (Ethereum 1, Polygon 0,2, Arbitrum 0,4). Exemplo verificado: 1 unidade de 0,85 ETH na Ethereum → `0,85 + 0,0021 = 0,8521`.
- **Cupons:** `PROMO10` (10%), `FRETE0` (taxa zero), `UNICO` (uso único), `VENCIDO` (expirado).
- **Estoque:** debitado ao criar o pedido; **devolvido** se o pagamento falhar; nunca negativo.
- **Pedido:** `pending → confirmed | failed` em 2,5 s. Falha ocorre com a carteira `0x…dEaD` ou com o cenário `reject-orders`. Ao confirmar, os itens saem do carrinho do servidor.
- **Idempotência:** chave escopada por usuário, validade de 24 h, comparada com a "impressão digital" (itens + carteira + cupom). As reservas e o registro da chave são síncronos: três requisições simultâneas criam **um** pedido.
- **Sessão:** servidor guarda sessões (30 min); logout e troca de senha revogam; `refresh` renova.
- **Segurança simulada:** senha com **sal por usuário + SHA-256**; token opaco (`tok_…`). Em produção: Argon2/bcrypt e cookie `HttpOnly`.
- **Isolamento:** carrinho, favoritos, carteiras e pedidos nunca aparecem para outro usuário (403/404).

### 5.3 Cenários de mock

Ativáveis por URL (`/?scenario=slow,flaky`) ou em teste (`__kurioMocks.setScenario({...})`).

| Cenário | Efeito |
| --- | --- |
| `slow` (`latencyMs`) | 1,5 s em toda requisição |
| `flaky` (`failRate`) | 30% de falha (500) nas rotas de dados |
| `server-error` | 500 em todas as rotas de dados |
| `session-expired` | revoga a sessão na próxima requisição autenticada |
| `session-blip` | 401 único; a sessão continua válida (testa renovação silenciosa) |
| `reject-orders` | pedidos terminam em `failed` |
| `favorites-fail` | PUT/DELETE de favoritos falham (testa rollback) |

`window.__kurioMocks` expõe `reset()`, `expireQuotes()`, `expireSessions()` e `socket.{count, dropAll, replayLast, emitStale}`.

## 6. Tempo real (Socket.IO simulado)

- Servidor em `src/mocks/socket.ts` via `ws.link` do MSW + `@mswjs/socket.io-binding`. **O cliente nunca emite eventos de domínio**: eles nascem de mudanças no banco (`bus.ts`).
- Envelope: `{ eventId, resource, id, version, occurredAt, payload }`. Eventos: `nft.updated` (todos) e `order.updated` (só o dono).
- Cliente (`services/socket.ts`): descarta `eventId` repetido e `version` ≤ a conhecida; ao (re)conectar, invalida os dados e reconcilia via REST; reconecta quando o usuário muda; `removeAllListeners()` + `disconnect()` no logout/expiração.
- Pedidos: o evento atualiza a tela; o polling (5 s com socket, 1 s sem) é só contingência.
- **Armadilhas encontradas (documentadas para o próximo mantenedor):**
  1. O MSW 3 remove o prefixo `/socket.io/` da URL antes de casar; por isso o link usa `ws.link("*")` e ignora conexões sem `EIO` (HMR do Vite segue ao servidor real).
  2. `engine.io-client` guarda o `WebSocket` global ao ser carregado; `socket.io-client` é importado **sob demanda**, depois do MSW assumir o WebSocket.
  3. O servidor envia `ping` ("2") a cada 20 s; sem isso o cliente reconecta a cada 30 s.

## 7. Sessão e autenticação (cliente)

1. Login/cadastro gravam o token (`nft-marketplace:token`) e o usuário no cache (`['session']`), e **mesclam** o carrinho anônimo (`POST /cart/merge`).
2. Interceptor Axios: em `401 SESSION_INVALID`, tenta **uma** renovação compartilhada e repete a requisição; se falhar, limpa a sessão e emite `session-expired`.
3. `Layout` trata a expiração: limpa dados privados, mostra aviso e, em rota privada, leva a `/login?redirect=<url>`. Após o login, o usuário volta ao checkout com o carrinho do servidor preservado.
4. `useSession` renova uma vez antes de considerar a sessão perdida; falha de rede/servidor **não** apaga o token.

## 8. Cache (TanStack Query)

| Chave | Política |
| --- | --- |
| `['nfts', params]` / `['facets', params]` | `placeholderData` mantém a lista anterior; `AbortSignal` cancela respostas obsoletas |
| `['nft', id]` | atualizado por `nft.updated` |
| `['session']` | `staleTime` 5 min, `retry: false` |
| `['cart', userId]` | invalidado por eventos e após confirmação |
| `['quote', userId, fingerprint]` | renovada ~5 s antes de expirar |
| `['orders', userId, id]` | atualizado por `order.updated`; contingência por polling |
| Padrão | `staleTime` 30 s, `retry: 1`, `gcTime` 5 min |

Favoritos usam `onMutate` (otimista) + snapshot e `onError` (rollback). O logout remove os dados privados do cache.

## 9. Design system e interface

Fonte: `DESIGN-SYSTEM.md` (tema claro, azul de ação, Inter, cards arredondados).

| Item | Implementação |
| --- | --- |
| Tokens | `src/index.css`: variáveis do shadcn (`--primary #246AFB`, `--foreground #111320`, `--border #E4E7EC`…), raios 8/12/20/28, sombras `card` e `float` |
| Header | logo, navegação, busca com ícone, Entrar (outline) e Cadastrar (dark); menu móvel em `Sheet` |
| Hero | título display com palavra em azul, dois cards rotacionados com os NFTs mais curtidos (**dados reais da API**) e `StatBlock` com totais reais (NFTs, coleções, redes). Nenhum número é inventado |
| NftCard | imagem 4:3 com raio 16, favorito, criador com avatar, preço em ETH (Decimal), rede, **Comprar agora** e botão de carrinho; `data-testid="nft-card-${id}"` mantido |
| **Filtro** | um **dropdown composto** (Popover no desktop, folha inferior no mobile) com categoria, ordenação, coleções, redes e faixa de preço; filtros ativos viram chips removíveis; tudo na URL |
| Diálogos | `Dialog`/`Sheet` do shadcn: foco preso, `Esc`, foco devolvido ao gatilho |
| Feedback | `sonner` (região `aria-live`), `Alert` para erros, `Skeleton` no carregamento |

**Desvios deliberados do DS (acessibilidade):**

| Token | DS | Usado | Motivo |
| --- | --- | --- | --- |
| `--input` (borda de campos/botões) | `#E4E7EC` | `#7B7F92` | 1,2:1 não atende WCAG 1.4.11; o novo valor tem 4,0:1. `--border` continua decorativo |
| `--success` | `#16A34A` | `#15803D` | 3,3:1 no branco; o novo valor tem 5,0:1 |
| `--warning` | `#D97706` | `#B45309` | contraste de texto |
| Marca | "NFT Marketplace" | KURIO | mantida a marca do desafio |

## 10. Acessibilidade e responsividade

- Landmarks (`banner`, `navigation`, `main`, `contentinfo`), um `h1` por página, link "ir para o conteúdo", título do documento por rota.
- Todos os campos têm rótulo; erros com `role="alert"` e `aria-invalid`; quantidade do carrinho com `aria-live`.
- Diálogos Radix: foco preso, `Esc` fecha, foco volta ao gatilho.
- Foco visível (2 px); `prefers-reduced-motion` desliga o shimmer.
- Contraste (testado): textos ≥ 4,5:1; bordas de campos e botões ≥ 3:1 (`--input`).
- Filtros recolhíveis no mobile; grade 1 / 2 / 3 colunas; sem rolagem horizontal em 390, 768 e 1440.

## 11. Testes e qualidade

| Arquivo | Testes | Foco |
| --- | --- | --- |
| `api-auth` | 10 | cadastro, login, 429, sessão, refresh, logout, senha, 401 em rotas privadas |
| `api-catalog` | 9 | paginação, busca, filtros, ordenação, 422, facetas, detalhe |
| `api-commerce` | 15 | cotação, cupons, idempotência, concorrência, estoque, falha, isolamento, histórico |
| `api-account` | 14 | carrinho, favoritos, perfil, carteiras, cenários |
| `ui-catalog` | 11 | URL, facetas, preço, paginação, skeleton, erro, detalhe |
| `ui-purchase` | 18 | carrinho, rotas privadas, checkout, recusa, conflito, expiração |
| `ui-account` | 9 | cadastro, perfil, carteiras, favoritos, newsletter |
| `ui-realtime` | 7 | evento, duplicata, versão antiga, queda e reconciliação |
| `ui-a11y` | 13 | responsividade, contraste, teclado, estrutura |
| `ui-smoke` | 1 | app sobe e conecta |

```bash
npm run test:e2e            # desktop (1440) e mobile (390)
E2E_PREVIEW=1 npm run test:e2e   # contra o build de produção
npm run build && npm run lighthouse
```

**Última execução completa contra o build de produção (`E2E_PREVIEW=1`): 214 de 214 testes passaram** (107 × desktop e mobile). Na execução anterior no servidor de desenvolvimento houve uma falha de temporização em um teste de teclado, corrigida (o teste passou a esperar a renderização).

**Lighthouse (mobile, throttling padrão, build de produção):**

| Rota | Performance | Acessibilidade | Boas práticas | SEO |
| --- | --- | --- | --- | --- |
| `/` | 50–67 (medido antes do redesign) | 100 | 100 | 100 |
| `/nfts/1` | 52–68 | 100 | 100 | 100 |
| `/cart` | 63–74 | 100 | 100 | 100 |
| `/login` | 64–78 | 100 | 100 | 100 |

A performance varia entre execuções (throttling simulado). O principal custo é o MSW + pacote da API simulada (~440 kB) carregado antes da primeira renderização, o que não existiria com uma API real.

## 12. Decisões de design e inconsistências do Figma

- **Facetas:** no Figma as coleções somam 239 e as redes 284 para o mesmo catálogo. Aqui cada NFT pertence a **uma** coleção e **uma** rede; as contagens de cada faceta consideram os demais filtros e as somas coincidem (testado). Se um NFT puder existir em várias redes, o modelo precisa mudar.
- **Bordas:** ver os desvios na seção 9.
- **Telas sem frame mobile no Figma** (Perfil, Carteiras, Confirmação): layout responsivo próprio.

## 13. Deploy

- `vercel.json` reescreve todas as rotas para `index.html` (SPA).
- `.npmrc` com `legacy-peer-deps=true`: `@mswjs/socket.io-binding@0.2` declara `peer msw@^2` e o projeto usa MSW 3 (funciona; ver seção 6).
- `VITE_ENABLE_MOCKS=true` em `.env.production`: o MSW roda também no build publicado.

## 14. Limitações conhecidas

- Token em `localStorage` e senhas com SHA-256 salgado só valem para a simulação. Produção: cookie `HttpOnly` + CSRF e Argon2/bcrypt.
- O "banco" está no `localStorage`: vale por navegador, ~5 MB; abas compartilham os dados mas **não os eventos** (o barramento é por aba).
- O servidor simulado roda no cliente: não há concorrência real entre usuários.
- Fidelidade visual às referências é parcial: tokens e componentes seguem o DS, mas não houve comparação quadro a quadro.
- Performance móvel no Lighthouse abaixo de 80 em algumas rotas (custo do MSW).
- A CLI do shadcn gerou `src/lib/utils.ts` e imports apontando para um pacote `cn` inexistente; foi corrigido à mão (`@/lib/utils`). Ao rodar `shadcn add` de novo, confira os imports.
- `@mswjs/socket.io-binding` ainda não declara suporte ao MSW 3; pode quebrar em atualizações.

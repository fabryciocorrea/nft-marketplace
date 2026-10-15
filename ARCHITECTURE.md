# ARCHITECTURE.md — NFT Marketplace

Documento de arquitetura do projeto. Ele separa com clareza **o que está implementado hoje**, **o que está planejado** e **as limitações conhecidas**, para que quem avalia saiba exatamente o estado da entrega.

## 1. Estado atual da entrega

| Área                                                                    | Status                                  |
| ----------------------------------------------------------------------- | --------------------------------------- |
| Catálogo de NFTs consumindo API simulada (MSW + Axios + TanStack Query) | Implementado                            |
| Busca por texto e filtro por categoria                                  | Implementado (no cliente)               |
| Carrinho (adicionar, remover, esvaziar, total)                          | Implementado (Zustand, em memória)      |
| Login simulado e cabeçalho com iniciais do usuário                      | Implementado (simulação local, sem API) |
| Estados de carregamento, erro e vazio no catálogo                       | Implementado (versão básica)            |
| Roteamento (TanStack Router), detalhe, checkout, perfil, carteiras      | Planejado                               |
| Cadastro, sessão persistente, favoritos                                 | Planejado                               |
| Cotação, pedidos idempotentes, recibo                                   | Planejado                               |
| Tempo real (Socket.IO via MSW)                                          | Planejado                               |
| shadcn/ui, skeletons com shimmer, acessibilidade completa               | Planejado                               |
| Testes Playwright, auditoria Lighthouse                                 | Planejado                               |
| Deploy na Vercel                                                        | Implementado                            |

## 2. Stack

| Responsabilidade    | Tecnologia                                     | Uso atual                        |
| ------------------- | ---------------------------------------------- | -------------------------------- |
| Interface           | React + TypeScript (Vite)                      | Em uso                           |
| Estilização         | Tailwind CSS v4 (`@tailwindcss/vite`)          | Em uso                           |
| Cliente HTTP        | Axios (`src/services/api.ts`, `baseURL: /api`) | Em uso                           |
| Estado remoto       | TanStack Query                                 | Em uso (lista de NFTs)           |
| Estado global de UI | Zustand                                        | Em uso (carrinho)                |
| Mocking             | MSW                                            | Em uso (dev e build publicado)   |
| Roteamento          | TanStack Router                                | Instalado, ainda não utilizado   |
| Tempo real          | socket.io-client                               | Instalado, ainda não utilizado   |
| Formulários         | React Hook Form + Zod                          | Instalados, ainda não utilizados |
| Componentes         | shadcn/ui                                      | Não adotado ainda                |
| Testes E2E          | Playwright                                     | Não configurado ainda            |

## 3. Estrutura do projeto

```text
src/
├── components/
│   ├── CartModal.tsx        # modal do carrinho
│   └── LoginModal.tsx       # modal de login (simulado)
├── mocks/
│   ├── browser.ts           # setupWorker + handlers
│   └── fixtures/db.ts       # NFTs e usuário de exemplo
├── pages/
│   └── Home.tsx             # catálogo, busca, filtros, cabeçalho
├── services/
│   ├── api.ts               # instância Axios
│   └── useCartStore.ts      # store Zustand do carrinho
├── types/index.ts           # NFT, User, Wallet, CartItem, Order
├── App.tsx
└── main.tsx                 # QueryClientProvider + ativação do MSW
```

## 4. Contratos REST

### Implementados (handlers MSW em `src/mocks/browser.ts`)

| Método | Rota           | Resposta                                               |
| ------ | -------------- | ------------------------------------------------------ |
| GET    | `/api/nfts`    | Lista completa de NFTs (sem paginação)                 |
| GET    | `/api/auth/me` | Usuário de exemplo (não utilizado pela interface hoje) |

### Planejados (ainda **não** implementados)

| Recurso        | Operações previstas                                                                 |
| -------------- | ----------------------------------------------------------------------------------- |
| Sessão e conta | `POST /auth/register`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` |
| NFTs           | Busca/filtros/ordenação/paginação no servidor e `GET /nfts/:id`                     |
| Favoritos      | `GET`, `PUT`, `DELETE /favorites/:nftId`                                            |
| Carrinho       | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`  |
| Cotação        | `POST /quotes` (cupom, disponibilidade, descontos, taxas, total)                    |
| Pedidos        | `POST /orders` (com `Idempotency-Key`), `GET /orders/:id`                           |
| Perfil         | `GET`/`PATCH /profile`, avatar, alteração de senha                                  |
| Carteiras      | `GET`, `POST`, `PATCH /wallets`                                                     |

## 5. Sessão e autenticação

**Hoje:** o estado de login fica em `useState` no componente `Home`. O `LoginModal` valida apenas o formato do e-mail e a presença da senha e, após um atraso simulado de 800 ms, marca o usuário como autenticado. **Não há chamada à API simulada**, qualquer e-mail/senha é aceito e a sessão **não sobrevive a refresh**.

**Planejado:** `POST /auth/login` e `GET /auth/session` no MSW, token persistido para recuperar a sessão após refresh, rotas privadas, tratamento de expiração e limpeza de cache no logout.

## 6. Estado do servidor e estratégia de cache

- A lista de NFTs usa `useQuery` com a chave `['nfts']` e a configuração padrão do TanStack Query (sem `staleTime`, `gcTime` ou política de retry customizados).
- Busca por texto e filtro por categoria são aplicados **no cliente**, sobre a lista já carregada. A URL **não** reflete busca/filtros.
- Estados de `isLoading` e `error` são tratados com mensagens simples.
- Ainda não há mutations, atualização otimista nem invalidação de cache.

**Planejado:** chaves de query com os parâmetros de busca, filtros na URL (search params do TanStack Router), política de cache documentada, cancelamento de respostas obsoletas via `AbortSignal` e pelo menos uma atualização otimista (favoritos) com rollback.

## 7. Estado do carrinho

- Gerenciado por uma store Zustand (`useCartStore`): `addItem`, `removeItem`, `clearCart`.
- O estado vive **em memória**: some ao recarregar a página.
- O carrinho **não** consulta nem sincroniza com a API, não respeita disponibilidade por edição e não é isolado por usuário.
- O total é calculado no cliente com `Number(priceEth) * quantity` e exibido com `toFixed(2)`. Isso **não** atende ao requisito de precisão decimal para ETH.
- O botão "Finalizar Compra" apenas exibe um `alert` e esvazia o carrinho. **Não existe fluxo de checkout, cotação nem pedido.**

**Planejado:** carrinho persistido, valores em string decimal com biblioteca de precisão, cotação como fonte do resumo e fluxo de checkout com pedido idempotente.

## 8. Tempo real e reconciliação REST × Socket.IO

Não implementado. A dependência `socket.io-client` está instalada, mas nenhum evento (`nft.updated`, `order.updated`) é emitido ou consumido.

**Planejado:** servidor Socket.IO simulado via `@mswjs/socket.io-binding`, eventos com id, recurso e versão, descarte de duplicatas e eventos antigos, reconciliação com REST após reconexão e liberação de listeners no logout.

## 9. Mocking com MSW

- Handlers definidos em `src/mocks/browser.ts` e dados em `src/mocks/fixtures/db.ts` (3 NFTs e 1 usuário).
- O worker é iniciado em `src/main.tsx` quando `VITE_ENABLE_MOCKS === "true"`, valor definido em `.env.development` e `.env.production`. Assim, o MSW roda também no build publicado.
- Ainda não existem cenários configuráveis (latência, falhas, sessão expirada etc.), segundo usuário, persistência nem reset.

## 10. Decisões de UX

- Modais com fundo desfocado (`backdrop-blur`).
- Contador de itens no botão do carrinho.
- Estado vazio amigável quando a busca não retorna resultados.
- Alerta visual quando a requisição do catálogo falha.

## 11. Acessibilidade e responsividade

Parcialmente atendidas pelo uso de elementos semânticos básicos e classes responsivas do Tailwind (grid de 1 coluna no mobile, 3 no desktop). Ainda faltam: foco gerenciado nos modais (focus trap, `Esc`), `aria-label` nos botões com ícone/emoji, associação de labels aos inputs, feedback `aria-live`, skeletons com `prefers-reduced-motion` e validação nas larguras 390/768/1440.

## 12. Desvios do Figma

Ainda não foi feita a aderência fiel ao layout do Figma (tipografia, cores, espaçamentos, composição). A interface atual é uma interpretação própria com Tailwind. Este item deve ser revisado tela a tela.

## 13. Limitações conhecidas

- Autenticação é simulada no cliente e não passa pela API.
- Carrinho e sessão não persistem após refresh.
- Valores em ETH usam `Number`, sem precisão decimal.
- Não há checkout, cotação, pedidos, favoritos, perfil, carteiras nem cadastro.
- Não há rotas: a aplicação é uma única página.
- Não há Socket.IO, testes E2E nem auditoria Lighthouse.
- Imagens dos NFTs vêm de URLs externas (Unsplash), dependendo de rede em tempo de execução.

## 14. Roadmap de implementação (ordem sugerida)

1. Mover o login para a API simulada (`POST /auth/login`) e persistir a sessão.
2. Checkout com pedido idempotente e tela de confirmação.
3. Carrinho persistente e valores em string decimal.
4. TanStack Router, com busca e filtros na URL e página de detalhe do NFT.
5. Teste Playwright dos fluxos principais.
6. Socket.IO simulado com `nft.updated` e `order.updated`.
7. Cadastro, favoritos (com atualização otimista), perfil e carteiras.
8. Auditoria Lighthouse, acessibilidade e fidelidade ao Figma.

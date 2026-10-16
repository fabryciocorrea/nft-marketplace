# ROADMAP.md — KURIO · Marketplace de NFTs

Plano de implementação com **rastreabilidade**: cada requisito aponta a origem (Figma/desafio), o estado e o **teste E2E que o comprova**.

Fontes: `FRONTEND-KURIO.md` (requisitos do Figma), `GAPS.md` (lacunas do projeto × desafio) e [ARCHITECTURE.md](./ARCHITECTURE.md) (estado técnico).

Legenda: ✅ feito e testado · 🟡 parcial · ❌ não feito · ⛔ era eliminatório

---

## 1. Resumo executivo

| Eixo | Antes (GAPS.md) | Agora |
| --- | --- | --- |
| Stack "usada de forma efetiva" ⛔ | Router, Socket.IO, shadcn, RHF/Zod sem uso | Router, Socket.IO, RHF + Zod e componentes shadcn-style **em uso** e testados |
| Páginas e rotas | 1 página + modais | 12 rotas (6 públicas e 6 privadas, com guarda e retorno ao contexto) |
| Backend simulado | 4 rotas | ~40 rotas, 18 códigos de erro, 7 cenários, Socket.IO simulado |
| E2E | 12 testes (não confirmados) | **107 testes × 2 viewports**, API + interface, também contra o build de produção |
| Tema Kurio | claro/azul | tokens do Figma, Roboto Mono, bordas com contraste corrigido |
| Lighthouse | inexistente | script + relatório (A11y/Boas práticas/SEO 100) |

Fora do que foi entregue de forma completa: **fidelidade pixel a pixel ao Figma**, **shadcn via CLI** e **performance móvel ≥ 80 em todas as rotas** (veja a seção 6).

---

## 2. Matriz de rastreabilidade — backend (API simulada)

Origem: `FRONTEND-KURIO.md` §5 e §6.

| ID | Requisito | Estado | Evidência (E2E) |
| --- | --- | --- | --- |
| B-01 | `POST /auth/register` (201, 409, 422 com campos) | ✅ | `api-auth` · cadastro |
| B-02 | `POST /auth/login` (200/401/422) e limite de tentativas (429 + `Retry-After`) | ✅ | `api-auth` · login, 5 falhas |
| B-03 | `GET /auth/session` e 401 sem token/token falso | ✅ | `api-auth` · sessão |
| B-04 | `POST /auth/logout` **revoga** o token | ✅ | `api-auth` · logout revoga |
| B-05 | `POST /auth/refresh` (renova; sessão vencida não renova) | ✅ | `api-auth` · refresh |
| B-06 | `POST /auth/forgot-password` (202 sem enumerar usuários) | ✅ | `api-auth` · esqueci a senha |
| B-07 | `POST /auth/social/:provider` (opcional) | ✅ | `api-auth` · login social |
| B-08 | `GET /nfts`: `q, collection, network, minPrice, maxPrice, tab, sort, page, pageSize` | ✅ | `api-catalog` · paginação, busca, filtros, ordenação |
| B-09 | Validação 422 com `details.fields` | ✅ | `api-catalog` · parâmetros inválidos |
| B-10 | `GET /nfts/:id` (+`availableQuantity`, `version`) e 404 | ✅ | `api-catalog` · detalhe |
| B-11 | `GET /nfts/:id/related` e `/reviews` | ✅ | `api-catalog` · detalhe |
| B-12 | `GET /facets` com contagens e `priceRange`; `GET /collections` | ✅ | `api-catalog` · facetas |
| B-13 | Favoritos `GET/PUT/DELETE` idempotentes, `likes`/`isLiked` coerentes | ✅ | `api-account` · favoritos |
| B-14 | Carrinho por usuário: `GET/POST/PATCH/DELETE /cart…`, 409 `AVAILABILITY_CONFLICT` | ✅ | `api-account` · carrinho |
| B-15 | `POST /cart/merge` (mescla anônimo, respeita estoque) | ✅ | `api-account` · merge |
| B-16 | `POST /quotes`: subtotal, desconto, taxa, total, `expiresAt`, `warnings[]` | ✅ | `api-commerce` · cotação |
| B-17 | Cupons: percentual, taxa zero, vencido, uso único | ✅ | `api-commerce` · cupons; cupom único |
| B-18 | Taxa de rede variável por rede e quantidade | ✅ | `api-commerce` · totais com precisão |
| B-19 | `POST /orders` com `Idempotency-Key` (201/200/409) | ✅ | `api-commerce` · idempotência |
| B-20 | Chave repetida **simultânea** cria um só pedido | ✅ | `api-commerce` · corrida |
| B-21 | Chave escopada por usuário | ✅ | `api-commerce` · outro usuário |
| B-22 | **Estoque debitado** na criação; 409 ao exceder | ✅ | `api-commerce` · estoque |
| B-23 | Pedido `pending → confirmed \| failed`; falha **devolve** o estoque | ✅ | `api-commerce` · confirmado, recusado |
| B-24 | `quoteId`: expirada (409), divergente (409), de outro usuário (404) | ✅ | `api-commerce` · cotação: usar quoteId |
| B-25 | `walletId` obrigatório e de propriedade do usuário (403) | ✅ | `api-commerce` · valida o corpo |
| B-26 | `GET /orders` (paginação, filtro de status), `GET /orders/:id`, 403 para alheio | ✅ | `api-commerce` · isolamento, histórico |
| B-27 | `GET /orders/:id/receipt` com `explorerUrl` por rede | ✅ | `api-commerce` · recibo |
| B-28 | Perfil: `GET/PATCH`, avatar (limite 200 KB), troca de senha (403 / revoga outras sessões) | ✅ | `api-account` · perfil; `api-auth` · senha |
| B-29 | Carteiras: CRUD, principal única, duplicada 409, última 409 | ✅ | `api-account` · carteiras |
| B-30 | `GET /posts`, `POST /newsletter` (idempotente) | ✅ | `api-catalog` · conteúdo |
| B-31 | Rotas privadas respondem 401 sem sessão | ✅ | `api-auth` · rotas privadas |
| B-32 | Dados isolados por usuário (carrinho, favoritos, carteiras, pedidos) | ✅ | `api-account`, `api-commerce` |
| B-33 | Senhas nunca em claro; sal por usuário | ✅ | `api-auth` (hash não é exposto) |
| B-34 | Socket.IO: `nft.updated`, `order.updated` com `{eventId, resource, id, version, occurredAt, payload}` | ✅ | `ui-realtime` |
| B-35 | Eventos só emitidos pelo servidor; `order.updated` só ao dono | ✅ | `socket.ts` (sem emissão no cliente) |
| B-36 | `cart.updated` (opcional) | ❌ | — (o carrinho é recarregado por `nft.updated`/`order.updated`) |
| B-37 | Cenários: latência, falha intermitente, 500, sessão expirada, rejeição, favoritos | ✅ | `api-account` · cenários |
| B-38 | Reset do banco e do cenário (`/__reset`) | ✅ | `api-account` · `__reset` |

## 3. Matriz de rastreabilidade — frontend

Origem: `FRONTEND-KURIO.md` §2 e `GAPS.md` §3.

| ID | Requisito | Estado | Evidência (E2E) |
| --- | --- | --- | --- |
| F-01 | TanStack Router com rotas reais ⛔ | ✅ | `ui-catalog`, `ui-purchase` |
| F-02 | Busca e filtros **na URL**, preservados no refresh | ✅ | `ui-catalog` · URL |
| F-03 | Facetas com contagem (coleções, redes, abas), faixa de preço, ordenação | ✅ | `ui-catalog` · facetas, preço |
| F-04 | Paginação preservando filtros | ✅ | `ui-catalog` · paginação |
| F-05 | Skeleton, vazio e erro com "tentar de novo" | ✅ | `ui-catalog` · skeleton, erro, vazio |
| F-06 | Cancelamento de respostas obsoletas (`AbortSignal`) | ✅ | `FilterPanel`/`Home` (`signal`) — sem teste dedicado |
| F-07 | Detalhe: preço, edições, avaliações, relacionados, esgotado, 404 | ✅ | `ui-catalog` · detalhe |
| F-08 | Carrinho com + / −, remover, respeita estoque, persiste | ✅ | `ui-purchase` · carrinho |
| F-09 | Soma decimal exata (`decimal.js`) | ✅ | `ui-purchase` · soma decimal |
| F-10 | Carrinho do visitante mesclado no login; sair limpa o estado privado | ✅ | `ui-purchase` · mescla, sair |
| F-11 | Pagamento: seleção de carteira, cotação do servidor, cupom | ✅ | `ui-purchase` · compra completa |
| F-12 | Compra só confirma após resposta da API; estado "processando" | ✅ | `ui-purchase`, `ui-realtime` |
| F-13 | Recibo: itens, taxa, carteira, status, data, hash, explorador | ✅ | `ui-purchase` · compra completa |
| F-14 | Estado de recusa mantém itens no carrinho | ✅ | `ui-purchase` · pagamento recusado |
| F-15 | Recarregar durante o processamento não cria outro pedido | ✅ | `ui-purchase` · recarregar |
| F-16 | Conflito de disponibilidade com mensagem do servidor | ✅ | `ui-purchase` · conflito |
| F-17 | Login com erro 401 e validação (RHF + Zod) | ✅ | `ui-purchase` · credenciais, validação |
| F-18 | Cadastro com validação (nome, e-mail, senha forte, confirmação, termos) e erro de e-mail duplicado | ✅ | `ui-account` · cadastro |
| F-19 | Esqueci a senha; login social | ✅ | `ui-account` |
| F-20 | Rotas privadas com retorno ao contexto; `redirect` externo ignorado | ✅ | `ui-purchase` · rotas privadas |
| F-21 | Expiração durante o checkout: aviso, login e retomada | ✅ | `ui-purchase` · sessão expirada |
| F-22 | Renovação silenciosa em 401 momentâneo | ✅ | `ui-purchase` · falha momentânea |
| F-23 | Perfil: nome, preferências, avatar, senha | ✅ | `ui-account` · perfil |
| F-24 | Carteiras: adicionar, validar, principal, remover com diálogo | ✅ | `ui-account` · carteiras |
| F-25 | Favoritos otimistas com rollback; exigem login | ✅ | `ui-account` · favoritos |
| F-26 | Newsletter com validação | ✅ | `ui-account` · newsletter |
| F-27 | Socket.IO: atualização ao vivo, duplicata, versão antiga, queda e reconciliação | ✅ | `ui-realtime` |
| F-28 | Listeners removidos no logout | ✅ | `ui-realtime` · logout |
| F-29 | Acessibilidade: foco, teclado, `aria-live`, diálogos, rótulos, `alert` | ✅ | `ui-a11y` |
| F-30 | Responsivo 390 / 768 / 1440 sem rolagem horizontal | ✅ | `ui-a11y` |
| F-31 | Contraste dos tokens (bordas ≥ 3:1) | ✅ | `ui-a11y` · tokens |
| F-32 | Tema KURIO (cores, Roboto Mono, escala) | ✅ | tokens em `index.css` |
| F-33 | `prefers-reduced-motion` | ✅ | `ui-a11y` |
| F-34 | shadcn/ui ⛔ | 🟡 | componentes no padrão (Radix + cva), sem a CLI |
| F-35 | Fidelidade ao layout do Figma | 🟡 | tokens e estrutura; espaçamentos/composição são interpretação |
| F-36 | Layout mobile específico (Perfil/Carteiras/Confirmação sem frame) | 🟡 | responsivo próprio |
| F-37 | Lighthouse | 🟡 | script e relatório; performance móvel 50–78 |

---

## 4. Roadmap por fases (executado)

| Fase | Entrega | Estado |
| --- | --- | --- |
| 0 · Fundação | Módulos do mock, banco persistente com `schemaVersion`, catálogo de erros, sessões revogáveis, refresh, `package.json` corrigido | ✅ |
| 1 · Catálogo | `/nfts` com filtros/ordenação/paginação, facetas, detalhe, relacionados, avaliações, 27 NFTs (esgotado e preço de 6 casas) | ✅ |
| 2 · Compra | Cotação, cupons, taxa por rede, carteira no pedido, estoque real, falha com devolução, histórico, recibo | ✅ |
| 3 · Conta | Cadastro, perfil, senha, carteiras, favoritos idempotentes, carrinho no servidor com merge | ✅ |
| 4 · Tempo real | Socket.IO simulado, envelope versionado, descarte, reconciliação, listeners limpos | ✅ |
| 5 · Qualidade | Cenários, `__reset`, rate limit, 107 testes E2E, a11y, Lighthouse | ✅ |
| 6 · Interface | Router, páginas, tema, shadcn-style, RHF + Zod, skeletons, rotas privadas | ✅ |

## 5. Próximos passos (o que ainda falta)

Ordenados por impacto na avaliação:

1. **Fidelidade ao Figma (F-35)** — comparar tela a tela com o design (espaçamentos, grid do hero, cards, carrinho em duas colunas) e ajustar. Requer acesso aos frames; fiz a interpretação a partir do `FRONTEND-KURIO.md`.
2. **shadcn via CLI (F-34)** — rodar `npx shadcn init`, gerar `components.json` e substituir `Button`, `Input`, `Dialog`, `Skeleton`, `Badge` pelos gerados, mantendo os tokens.
3. **Performance móvel (F-37)** — carregar a API simulada em paralelo ao app (hoje bloqueia a primeira renderização), `manualChunks` para vendor e `fetchpriority` na primeira imagem. Meta: ≥ 80.
4. **`cart.updated` (B-36)** — evento opcional para sincronizar abas.
5. **Teste do cancelamento de resposta obsoleta (F-06)** — interceptar duas buscas encadeadas e garantir que a antiga não sobrescreve a nova.
6. **Migração para API real** — o contrato e os testes de API já servem de especificação; trocar cookie `HttpOnly`, hash Argon2 e estoque transacional (ver ARCHITECTURE §13).

## 6. Riscos e decisões registradas

| Risco / decisão | Tratamento |
| --- | --- |
| `@mswjs/socket.io-binding` exige `msw@^2`; o projeto usa MSW 3 | `.npmrc` com `legacy-peer-deps`; funciona (testado), mas é um ponto frágil em atualizações |
| MSW 3 remove o prefixo `/socket.io/` ao casar URLs | `ws.link("*")` + recusa de conexões sem `EIO` (HMR do Vite segue ao servidor real) |
| `engine.io-client` captura o `WebSocket` global ao carregar | `socket.io-client` importado sob demanda, depois do MSW |
| "Banco" em `localStorage` | `schemaVersion`; relê a cada requisição (abas); `__reset` nos testes |
| Eventos de socket não cruzam abas (barramento por aba) | Documentado; reconciliação por REST cobre o caso |
| 239 × 284 nas facetas do Figma | Cada NFT tem 1 coleção e 1 rede; somas coincidem (testado) |
| Bordas do Figma com contraste < 3:1 | `#8A5A3C` para componentes; originais só como decoração |

## 7. Evidências

Comandos:

```bash
npm run test:e2e                 # dev server (desktop + mobile)
E2E_PREVIEW=1 npm run test:e2e   # build de produção
npm run build && npm run lighthouse
```

Falhas encontradas **pela própria suíte** e corrigidas durante a iteração (todas com teste de regressão):

| Falha | Causa | Correção |
| --- | --- | --- |
| Socket.IO nunca conectava via MSW | `engine.io-client` capturava o `WebSocket` antes do MSW; MSW 3 remove `/socket.io/` da URL | import sob demanda + `ws.link("*")` |
| Carrinho continuava com o item depois da confirmação | evento de pedido não invalidava `['cart']` | invalidação no `order.updated` |
| Filtro de preço aparecia como `%221%22` na URL | serialização JSON do router | `parseSearch`/`stringifySearch` próprios |
| 422 de `/nfts` omitia `page`, `pageSize` e `sort` quando havia erro de filtro | validação em duas etapas | erros agregados |
| `priceRange.max` devolvia `"5"` em vez de `"5.00"` | `Decimal.toFixed` | preserva o texto original |
| Falha de rede/401 momentâneo deslogava ao recarregar | `useSession` apagava o token em qualquer erro | renova uma vez; só apaga em 401 persistente |
| Diálogo não devolvia o foco ao gatilho | abertura por estado (sem `Trigger`) | `onCloseAutoFocus` com o último gatilho |
| Páginas vazias sem `h1` (`/cart`, 404) | `EmptyState` era `<p>` | `level={1}` nas páginas inteiras |
| `/nfts/:id` com CLS 0,77 | listas sem altura reservada | skeletons com altura fixa |
| `robots.txt` inválido (SEO 92) | ausente | `public/robots.txt` |

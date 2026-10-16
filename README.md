# KURIO · Marketplace de NFTs

Desafio técnico de Frontend: marketplace de NFTs em **React + TypeScript**, com **API REST e Socket.IO simulados por MSW**.

- **Repositório:** https://github.com/fabryciocorrea/nft-marketplace
- **Aplicação publicada (produção):** https://nft-marketplace-murex-eight.vercel.app/
- **Documentos:** [ARCHITECTURE.md](./ARCHITECTURE.md) (arquitetura e contratos) · [ROADMAP.md](./ROADMAP.md) (requisitos, rastreabilidade e próximos passos)

## O que está implementado

- Catálogo com busca, facetas (coleções, redes, categorias), faixa de preço, ordenação e paginação — **tudo na URL**.
- Detalhe do NFT, favoritos (otimista com rollback), carrinho (visitante local / logado no servidor, mesclado no login).
- Pagamento com **carteira**, cotação com taxa de rede e cupom, **pedido idempotente**, recibo e histórico.
- Cadastro, login, sessão com renovação, logout que revoga o token, rotas privadas com retorno ao contexto, expiração durante o checkout.
- Perfil (dados, avatar, senha) e carteiras (principal única).
- **Tempo real** por Socket.IO simulado (`nft.updated`, `order.updated`) com descarte de duplicatas/versões antigas e reconciliação após queda.
- Visual do `DESIGN-SYSTEM.md` (tema claro, azul, Inter, shadcn/ui via CLI), **filtro único em dropdown composto**, skeletons, estados vazio/erro, acessibilidade e responsividade (390 / 768 / 1440) testadas.

O que **não** está completo (detalhes em [ROADMAP.md](./ROADMAP.md)): fidelidade pixel a pixel às referências visuais e performance móvel ≥ 80 em todas as rotas.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, **shadcn/ui** (Radix), TanStack Router, TanStack Query, React Hook Form + Zod, Zustand, Axios, Socket.IO client, decimal.js, MSW 3 (`http` + `ws`), Playwright e Lighthouse.

## Setup

Requisitos: Node.js 20 ou superior.

```bash
git clone https://github.com/fabryciocorrea/nft-marketplace.git
cd nft-marketplace
npm install        # o .npmrc já ativa legacy-peer-deps (peer do socket.io-binding)
npm run dev
```

A aplicação abre em `http://localhost:5173`.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks |
| `npm run build` | Tipos + build de produção |
| `npm run preview` | Serve o build (`http://localhost:4173`) |
| `npm run lint` | Lint (oxlint) |
| `npm run test:e2e` | Playwright: desktop (1440) e mobile (390) |
| `E2E_PREVIEW=1 npm run test:e2e` | Mesma suíte contra o **build de produção** |
| `npm run test:e2e:report` | Abre o relatório HTML |
| `npm run lighthouse` | Lighthouse no build (rode `npm run build` antes) |

## Variáveis de ambiente

| Variável | Descrição | Valor |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | Ativa o MSW (API simulada) | `true` em `.env.development` e `.env.production` |

O MSW fica ativo também no build publicado, para a demonstração funcionar sem backend.

## Credenciais fictícias

| Usuário | E-mail | Senha | Carteiras |
| --- | --- | --- | --- |
| Larissa Rosa | `larissa@exemplo.com` | `Senha@123` | Ethereum (principal) e Polygon |
| Chaves do 8 | `chavesdo8@exemplo.com` | `Senha@456` | Ethereum |

Cupons: `PROMO10` (10%), `FRETE0` (sem taxa de rede), `UNICO` (uso único), `VENCIDO` (expirado).
Carteira que **recusa** pagamento: `0x000000000000000000000000000000000000dEaD` (cadastre em *Carteiras*).

## Como reproduzir os fluxos

1. **Compra:** entre → abra um NFT → *Adicionar ao carrinho* → *Carrinho* → *Ir para o pagamento* → escolha a carteira, aplique `PROMO10` → *Confirmar compra*. O recibo aparece "Processando…" e vira "Confirmado" por evento (≈ 2,5 s).
2. **Idempotência:** recarregue a página do pedido durante o processamento; nenhum pedido novo é criado (`Idempotency-Key`).
3. **Falha de pagamento:** cadastre a carteira `…dEaD` e pague com ela; o estoque volta e o carrinho é mantido.
4. **Sessão expirada:** na tela de pagamento, rode no console `__kurioMocks.setScenario({ sessionExpired: true })` e clique em *Confirmar compra*; o app avisa, leva ao login e volta ao checkout com o carrinho preservado.
5. **Tempo real:** logado, abra `/nfts/3` e rode no console o trecho abaixo; o estoque muda sem recarregar.

```js
fetch("/api/orders", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
    Authorization: "Bearer " + localStorage.getItem("nft-marketplace:token"),
  },
  body: JSON.stringify({ items: [{ nftId: "3", quantity: 1 }], walletId: "w-1" }),
});
```

## Cenários de mock

Via URL, por exemplo `/?scenario=slow,flaky`:

| Cenário | Efeito |
| --- | --- |
| `slow` | 1,5 s de latência |
| `flaky` | 30% de falhas intermitentes |
| `server-error` | 500 nas rotas de dados |
| `session-expired` | revoga a sessão na próxima requisição |
| `session-blip` | 401 único (testa renovação silenciosa) |
| `reject-orders` | pedidos terminam em `failed` |
| `favorites-fail` | favoritos falham (testa rollback) |
| `none` | limpa os cenários |

No console: `__kurioMocks.reset()` restaura o banco simulado (estoque, usuários, pedidos).

## Contratos e limitações

Ver [ARCHITECTURE.md](./ARCHITECTURE.md): tabela completa de rotas, regras de negócio, tempo real, cache e limitações conhecidas.

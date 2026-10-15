# NFT Marketplace

Desafio técnico de Frontend: marketplace de NFTs em React + TypeScript, com API simulada por MSW.

- **Aplicação publicada:** https://nft-marketplace-murex-eight.vercel.app/
- **Repositório:** https://github.com/fabryciocorrea/nft-marketplace

> **Estado da entrega:** esta é uma entrega parcial. A seção [O que está implementado](#o-que-está-implementado) lista com precisão o que funciona hoje, e o [ARCHITECTURE.md](./ARCHITECTURE.md) detalha decisões, limitações e o roadmap.

## Stack

React, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Axios, Zustand e MSW.

Instaladas, mas ainda não utilizadas: TanStack Router, socket.io-client, React Hook Form e Zod.

## O que está implementado

- Catálogo de NFTs consumindo uma API REST simulada (`GET /api/nfts`) via Axios + TanStack Query.
- Busca por texto e filtro por categoria (aplicados no cliente).
- Carrinho com adicionar, remover, esvaziar e total.
- Login simulado no cliente, com cabeçalho mostrando as iniciais do usuário.
- Estados de carregamento, erro e resultado vazio no catálogo.

## O que ainda não está implementado

Roteamento e página de detalhe, cadastro, sessão persistente, favoritos, cotação, checkout e pedidos, perfil, carteiras, Socket.IO, testes Playwright e auditoria Lighthouse. Os motivos e o plano estão no [ARCHITECTURE.md](./ARCHITECTURE.md).

## Setup

Requisitos: Node.js 20 ou superior.

```bash
git clone https://github.com/fabryciocorrea/nft-marketplace.git
cd nft-marketplace
npm install
npm run dev
```

A aplicação abre em `http://localhost:5173`.

## Variáveis de ambiente

| Variável            | Descrição                  | Valor usado                                      |
| ------------------- | -------------------------- | ------------------------------------------------ |
| `VITE_ENABLE_MOCKS` | Ativa o MSW (API simulada) | `true` em `.env.development` e `.env.production` |

O MSW fica ativo também no build publicado, para que a demonstração funcione sem backend.

## Comandos

| Comando           | Finalidade                                          |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Desenvolvimento com mocks                           |
| `npm run build`   | Verificação de tipos e build de produção            |
| `npm run preview` | Servir o build localmente (`http://localhost:4173`) |
| `npm run lint`    | Lint                                                |

Comandos para testes Playwright e auditoria Lighthouse ainda não existem.

## Credenciais fictícias

O login atual é uma simulação local: qualquer e-mail válido e qualquer senha são aceitos. Não há credenciais fixas nem dados reais armazenados.

## Cenários de mock

Ainda não há cenários configuráveis (latência, falhas, sessão expirada etc.). Os dados simulados são os três NFTs e o usuário de exemplo em `src/mocks/fixtures/db.ts`. Para restaurar o estado inicial, basta recarregar a página: o carrinho e o login não são persistidos.

## Contratos REST

### Implementados

| Método | Rota           | Descrição                                              |
| ------ | -------------- | ------------------------------------------------------ |
| GET    | `/api/nfts`    | Lista de NFTs                                          |
| GET    | `/api/auth/me` | Usuário de exemplo (não consumido pela interface hoje) |

### Planejados

Sessão (`/auth/register`, `/auth/login`, `/auth/session`, `/auth/logout`), detalhe de NFT, favoritos, carrinho, cotação, pedidos com `Idempotency-Key`, perfil e carteiras. Detalhes no [ARCHITECTURE.md](./ARCHITECTURE.md).

## Limitações conhecidas

Consulte a seção de limitações no [ARCHITECTURE.md](./ARCHITECTURE.md).

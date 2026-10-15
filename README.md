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
- **Login, sessão e logout integrados à API simulada**, com sessão recuperada após refresh e mensagem de erro para credenciais inválidas.
- Estados de carregamento, erro e resultado vazio no catálogo.

## O que ainda não está implementado

Roteamento e página de detalhe, cadastro, rotas privadas, favoritos, cotação, checkout e pedidos, perfil, carteiras, Socket.IO, testes Playwright e auditoria Lighthouse. Os motivos e o plano estão no [ARCHITECTURE.md](./ARCHITECTURE.md).

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

| Usuário      | E-mail                  | Senha       |
| ------------ | ----------------------- | ----------- |
| Larissa Rosa | `larissa@exemplo.com`   | `Senha@123` |
| Chaves do 8  | `chavesdo8@exemplo.com` | `Senha@456` |

São dados fictícios. No banco simulado as senhas ficam como hash SHA-256, nunca em claro.

## Como reproduzir o fluxo de login

1. Clique em **Entrar** e informe `larissa@exemplo.com` com `Senha@123`. O nome aparece no cabeçalho.
2. Atualize a página (`F5`): a sessão continua ativa.
3. Clique em **Sair**: a sessão é encerrada e o carrinho é limpo.

**Falha de credenciais:** informe uma senha errada. A API simulada responde `401` e o modal exibe "E-mail ou senha inválidos."

## Cenários de mock

Ainda não há cenários configuráveis (latência, falhas, sessão expirada etc.). Os dados simulados ficam em `src/mocks/fixtures/db.ts`: três NFTs e dois usuários. A sessão é guardada no navegador (`localStorage`); para restaurar o estado inicial, basta sair da conta ou limpar os dados do site. O carrinho não é persistido e volta vazio ao recarregar a página.

## Contratos REST

### Implementados

| Método | Rota                | Descrição                                                    | Erros                                          |
| ------ | ------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| GET    | `/api/nfts`         | Lista de NFTs                                                | -                                              |
| POST   | `/api/auth/login`   | Autentica e devolve `{ token, user }`                        | 401 credenciais inválidas, 422 campos ausentes |
| GET    | `/api/auth/session` | Devolve o usuário da sessão (header `Authorization: Bearer`) | 401 sessão inválida ou expirada                |
| POST   | `/api/auth/logout`  | Encerra a sessão                                             | -                                              |

Formato de erro: `{ "error": { "code": "INVALID_CREDENTIALS", "message": "..." } }`.

### Planejados

Cadastro (`/auth/register`), detalhe de NFT, favoritos, carrinho, cotação, pedidos com `Idempotency-Key`, perfil e carteiras. Detalhes no [ARCHITECTURE.md](./ARCHITECTURE.md).

## Limitações conhecidas

Consulte a seção de limitações no [ARCHITECTURE.md](./ARCHITECTURE.md).

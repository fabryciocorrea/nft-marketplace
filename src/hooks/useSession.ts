import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { clearToken, getToken, parseError, tryRefresh } from "../services/api";
import { fetchSession, mergeCart } from "../services/endpoints";
import { useAnonCart } from "../services/useCartStore";
import type { User } from "../types";

export const SESSION_KEY = ["session"] as const;

// Itens adicionados como visitante (inclusive enquanto a sessão ainda carrega)
// passam para o carrinho do servidor assim que há usuário.
async function mergeAnonCart() {
  const anon = useAnonCart.getState().items;
  if (anon.length === 0) return;
  try {
    await mergeCart(
      anon.map((i) => ({ nftId: i.nft.id, quantity: i.quantity })),
    );
    useAnonCart.getState().clear();
  } catch {
    // o carrinho anônimo é mantido para uma nova tentativa
  }
}

export const sessionQuery = {
  queryKey: SESSION_KEY,
  queryFn: async (): Promise<User | null> => {
    if (!getToken()) return null;
    try {
      const user = await fetchSession();
      await mergeAnonCart();
      return user;
    } catch (error) {
      // Falha de rede/servidor: mantém o token e deixa o React Query tentar de novo
      if (parseError(error).status !== 401) throw error;
      // 401: tenta renovar uma vez antes de considerar a sessão perdida
      if (await tryRefresh()) {
        try {
          const user = await fetchSession();
          await mergeAnonCart();
          return user;
        } catch {
          // cai para a limpeza abaixo
        }
      }
      clearToken();
      return null;
    }
  },
  staleTime: 5 * 60 * 1000,
  retry: false,
} as const;

// Recupera a sessão ao abrir/recarregar a página, usando o token salvo
export function useSession() {
  return useQuery(sessionQuery);
}

// Depois de login/cadastro: guarda o usuário e mescla o carrinho anônimo
export async function onAuthenticated(queryClient: QueryClient, user: User) {
  queryClient.setQueryData(SESSION_KEY, user);
  await mergeAnonCart();
  await queryClient.invalidateQueries({ queryKey: ["cart"] });
  await queryClient.invalidateQueries({ queryKey: ["nfts"] });
}

// Remove dados privados do cache (logout e expiração)
export function clearPrivateData(queryClient: QueryClient) {
  queryClient.setQueryData(SESSION_KEY, null);
  for (const key of [
    "cart",
    "orders",
    "orders-list",
    "favorites",
    "wallets",
    "quote",
  ]) {
    queryClient.removeQueries({ queryKey: [key] });
  }
  queryClient.invalidateQueries({ queryKey: ["nfts"] });
  queryClient.invalidateQueries({ queryKey: ["nft"] });
}

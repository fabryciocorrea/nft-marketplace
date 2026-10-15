import { useQuery } from "@tanstack/react-query";
import { clearToken, fetchSession, getToken } from "../services/auth";
import type { SessionUser } from "../services/auth";

export const SESSION_KEY = ["session"] as const;

// Recupera a sessão ao abrir/recarregar a página, usando o token salvo
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async (): Promise<SessionUser | null> => {
      if (!getToken()) return null;
      try {
        return await fetchSession();
      } catch {
        clearToken(); // token inválido ou expirado
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

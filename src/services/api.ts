import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import type { ApiErrorBody } from "../types";

export const TOKEN_KEY = "nft-marketplace:token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (token: string) =>
  localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignora
  }
};

// Eventos de autenticação (a UI decide o que fazer: toast, redirecionar...)
export const authEvents = new EventTarget();
export const SESSION_EXPIRED = "session-expired";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Renovação silenciosa: uma única tentativa compartilhada entre requisições
let refreshing: Promise<boolean> | null = null;

export async function tryRefresh() {
  if (!refreshing) {
    refreshing = axios
      .post<{ token: string }>(
        "/api/auth/refresh",
        {},
        { headers: { Authorization: `Bearer ${getToken()}` } },
      )
      .then(({ data }) => {
        setToken(data.token);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

type Retriable = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as Retriable | undefined;
    const code = error.response?.data?.error?.code;
    const isAuthCall = config?.url?.startsWith("/auth/");

    if (
      error.response?.status === 401 &&
      code === "SESSION_INVALID" &&
      config &&
      !config._retried &&
      !isAuthCall &&
      getToken()
    ) {
      config._retried = true;
      if (await tryRefresh()) return api.request(config);
      clearToken();
      authEvents.dispatchEvent(new Event(SESSION_EXPIRED));
    }
    return Promise.reject(error);
  },
);

export interface ParsedError {
  status: number | null;
  code: string;
  message: string;
  fields: Record<string, string>;
  details: Record<string, unknown>;
}

export function parseError(
  error: unknown,
  fallback = "Não foi possível concluir a operação. Tente novamente.",
): ParsedError {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data?.error;
    const status = error.response?.status ?? null;
    // Sem corpo de erro da API: diz o que aconteceu em vez de uma mensagem genérica
    const diagnostic = body?.message
      ? null
      : status === null
        ? "Sem resposta da API simulada. Recarregue a página para reativá-la e tente novamente."
        : `A API simulada respondeu fora do contrato (HTTP ${status}). Recarregue a página e tente novamente.`;
    return {
      status,
      code: body?.code ?? "NETWORK_ERROR",
      message: body?.message ?? diagnostic ?? fallback,
      fields: body?.details?.fields ?? {},
      details: (body?.details as Record<string, unknown>) ?? {},
    };
  }
  return {
    status: null,
    code: "UNKNOWN",
    message: fallback,
    fields: {},
    details: {},
  };
}

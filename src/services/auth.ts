import { api, TOKEN_KEY } from "./api";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

interface LoginResponse {
  token: string;
  user: SessionUser;
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function login(email: string, password: string) {
  const { data } = await api.post<LoginResponse>("/auth/login", {
    email,
    password,
  });
  localStorage.setItem(TOKEN_KEY, data.token);
  return data.user;
}

export async function fetchSession() {
  const { data } = await api.get<SessionUser>("/auth/session");
  return data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    clearToken();
  }
}

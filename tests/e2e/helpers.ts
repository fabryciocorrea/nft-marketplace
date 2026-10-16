import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const LARISSA = { email: "larissa@exemplo.com", password: "Senha@123" };
export const CHAVES = { email: "chavesdo8@exemplo.com", password: "Senha@456" };
export const BLOCKED = "0x000000000000000000000000000000000000dEaD";

// Abre a aplicação e espera o MSW (API simulada) estar pronto
export async function boot(page: Page, path = "/") {
  await page.goto(path);
  await page.waitForFunction(
    () => !!(window as unknown as { __kurioMocks?: unknown }).__kurioMocks,
  );
}

export interface ApiResult<T = any> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

// Chama a API simulada de dentro do navegador (onde o MSW intercepta)
export async function api<T = any>(
  page: Page,
  method: string,
  path: string,
  options: {
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ method, path, options }) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      };
      if (options.token) headers.Authorization = `Bearer ${options.token}`;
      const response = await fetch(`/api${path}`, {
        method,
        headers,
        body:
          options.body === undefined || method === "GET"
            ? undefined
            : JSON.stringify(options.body),
      });
      const text = await response.text();
      const out: Record<string, string> = {};
      response.headers.forEach((v, k) => (out[k] = v));
      return {
        status: response.status,
        body: text ? JSON.parse(text) : null,
        headers: out,
      };
    },
    { method, path, options },
  );
}

export async function apiLogin(
  page: Page,
  creds: { email: string; password: string } = LARISSA,
) {
  const res = await api(page, "POST", "/auth/login", { body: creds });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

export async function uiLogin(
  page: Page,
  creds: { email: string; password: string } = LARISSA,
  redirect?: string,
) {
  await boot(page, redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login");
  await page.getByLabel("E-mail").fill(creds.email);
  await page.getByLabel("Senha").fill(creds.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

export async function setScenario(page: Page, patch: Record<string, unknown>) {
  await page.waitForFunction(
    () => !!(window as unknown as { __kurioMocks?: unknown }).__kurioMocks,
  );
  await page.evaluate(
    (p) =>
      (
        window as unknown as {
          __kurioMocks: { setScenario: (v: unknown) => void };
        }
      ).__kurioMocks.setScenario(p),
    patch,
  );
}

export async function mocks<T>(
  page: Page,
  fn: string, // ex.: "socket.dropAll()" ou "expireQuotes()"
): Promise<T> {
  return page.evaluate(
    (code) => new Function("m", `return m.${code}`)((window as any).__kurioMocks),
    fn,
  );
}

export function uniqueEmail(prefix = "novo") {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@exemplo.com`;
}

// Abre o dropdown composto de filtros
export async function openFilters(page: Page) {
  const panel = page.getByRole("dialog", { name: "Filtros do catálogo" });
  if (!(await panel.isVisible())) {
    await page.getByRole("button", { name: /^Filtros/ }).click();
  }
  await panel.waitFor();
  return panel;
}

export function filtersPanel(page: Page) {
  return page.getByRole("dialog", { name: "Filtros do catálogo" });
}

// Sair: no mobile o botão fica dentro do menu (Sheet)
export async function logout(page: Page) {
  const direct = page.getByRole("button", { name: "Sair" });
  if (!(await direct.isVisible())) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
  }
  await page.getByRole("button", { name: "Sair" }).click();
}

// Toasts do Sonner
export function toasts(page: Page) {
  return page.locator("[data-sonner-toast]");
}

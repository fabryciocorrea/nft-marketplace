import { delay, http } from "msw";
import type { DbSession, DbUser } from "./db";
import { commit, db, refresh, resolveOrders } from "./db";
import { fail } from "./errors";
import { getScenario, setScenario } from "./scenarios";

type Method = "get" | "post" | "put" | "patch" | "delete";

export interface Ctx {
  request: Request;
  url: URL;
  params: Record<string, string>;
  user: DbUser | null;
  session: DbSession | null;
  // Corpo JSON (objeto vazio quando ausente ou inválido)
  body: () => Promise<Record<string, unknown>>;
}

type Handler = (ctx: Ctx) => Promise<Response> | Response;

interface RouteOptions {
  auth?: boolean; // exige sessão válida
  optionalAuth?: boolean; // preenche user quando houver sessão válida
  system?: boolean; // rotas de auth/infra: ignoram falhas aleatórias
}

export function readToken(request: Request) {
  const header = request.headers.get("Authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export function findSession(token: string, now = Date.now()) {
  if (!token) return null;
  const session = db().sessions.find((s) => s.token === token);
  if (!session || session.revoked || session.expiresAt < now) return null;
  return session;
}

export function route(
  method: Method,
  path: string,
  handler: Handler,
  options: RouteOptions = {},
) {
  return http[method](`/api${path}`, async ({ request, params }) => {
    refresh(); // outra aba pode ter alterado o banco
    const scenario = getScenario();
    if (scenario.latencyMs > 0) await delay(scenario.latencyMs);

    if (!options.system) {
      if (scenario.serverError) return fail("INTERNAL_ERROR");
      if (scenario.failRate > 0 && Math.random() < scenario.failRate) {
        return fail("INTERNAL_ERROR", {
          message: "Falha intermitente simulada. Tente novamente.",
        });
      }
    }

    resolveOrders();

    let user: DbUser | null = null;
    let session: DbSession | null = null;
    if (options.auth || options.optionalAuth) {
      const token = readToken(request);
      session = findSession(token);
      if (session && options.auth) {
        // Cenários de expiração: valem para a próxima requisição autenticada
        if (scenario.sessionExpired) {
          session.revoked = true;
          setScenario({ sessionExpired: false });
          commit();
          session = null;
        } else if (scenario.sessionBlip) {
          setScenario({ sessionBlip: false });
          return fail("SESSION_INVALID");
        }
      }
      if (session) {
        user = db().users.find((u) => u.id === session!.userId) ?? null;
      }
      if (options.auth && !user) return fail("SESSION_INVALID");
    }

    let parsed: Record<string, unknown> | null = null;
    const ctx: Ctx = {
      request,
      url: new URL(request.url),
      params: params as Record<string, string>,
      user,
      session,
      body: async () => {
        if (parsed) return parsed;
        try {
          const json = await request.clone().json();
          parsed =
            json && typeof json === "object"
              ? (json as Record<string, unknown>)
              : {};
        } catch {
          parsed = {};
        }
        return parsed;
      },
    };

    try {
      return await handler(ctx);
    } catch (error) {
      console.error("[mock] erro no handler", error);
      return fail("INTERNAL_ERROR");
    }
  });
}

// ---- Validação simples de campos

export const isEmail = (value: unknown): value is string =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

export function passwordProblem(value: unknown) {
  if (typeof value !== "string") return "Informe a senha.";
  if (value.length < 8) return "A senha deve ter ao menos 8 caracteres.";
  if (!/[A-Z]/.test(value)) return "Inclua ao menos uma letra maiúscula.";
  if (!/[0-9]/.test(value)) return "Inclua ao menos um número.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Inclua ao menos um símbolo.";
  return null;
}

export function parsePositiveInt(
  value: string | null,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
) {
  if (value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

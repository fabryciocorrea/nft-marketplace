import { setupWorker } from "msw/browser";
import { http, HttpResponse } from "msw";
import { initialNfts, mockUsers } from "./fixtures/db";

const SESSION_TTL_MS = 30 * 60 * 1000; // sessão de 30 minutos

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function publicUser(user: (typeof mockUsers)[number]) {
  return { id: user.id, name: user.name, email: user.email };
}

// Token do mock: "mock.<userId>.<expiraEm>" (suficiente para simular sessão)
function createToken(userId: string) {
  return `mock.${userId}.${Date.now() + SESSION_TTL_MS}`;
}

function getUserFromRequest(request: Request) {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.replace("Bearer ", "");
  const [prefix, userId, expiresAt] = token.split(".");
  if (prefix !== "mock" || !userId || Number(expiresAt) < Date.now())
    return null;
  return mockUsers.find((u) => u.id === userId) ?? null;
}

function errorResponse(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status });
}

export const handlers = [
  http.get("/api/nfts", () => HttpResponse.json(initialNfts)),

  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!body.email || !body.password) {
      return errorResponse(422, "VALIDATION_ERROR", "Informe e-mail e senha.");
    }

    const user = mockUsers.find(
      (u) => u.email.toLowerCase() === body.email!.toLowerCase(),
    );
    const passwordHash = await sha256(body.password);

    if (!user || user.passwordHash !== passwordHash) {
      return errorResponse(
        401,
        "INVALID_CREDENTIALS",
        "E-mail ou senha inválidos.",
      );
    }

    return HttpResponse.json({
      token: createToken(user.id),
      user: publicUser(user),
    });
  }),

  http.get("/api/auth/session", ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user) {
      return errorResponse(
        401,
        "SESSION_INVALID",
        "Sessão inválida ou expirada.",
      );
    }
    return HttpResponse.json(publicUser(user));
  }),

  http.post("/api/auth/logout", () => new HttpResponse(null, { status: 204 })),
];

export const worker = setupWorker(...handlers);

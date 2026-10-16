import { HttpResponse } from "msw";
import {
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  SESSION_TTL_MS,
  commit,
  db,
  hashPassword,
  randomHex,
} from "../db";
import type { DbUser } from "../db";
import { fail, validationError } from "../errors";
import { isEmail, passwordProblem, readToken, route } from "../http";

export function publicUser(user: DbUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    preferences: user.preferences,
  };
}

function createSession(userId: string) {
  const d = db();
  const now = Date.now();
  // limpa sessões vencidas ou revogadas
  d.sessions = d.sessions.filter((s) => !s.revoked && s.expiresAt > now);
  const session = {
    token: `tok_${randomHex(16)}`,
    userId,
    expiresAt: now + SESSION_TTL_MS,
    revoked: false,
  };
  d.sessions.push(session);
  return session;
}

function authResponse(user: DbUser, status = 200) {
  const session = createSession(user.id);
  commit();
  return HttpResponse.json(
    {
      token: session.token,
      expiresAt: new Date(session.expiresAt).toISOString(),
      user: publicUser(user),
    },
    { status },
  );
}

export const authHandlers = [
  route(
    "post",
    "/auth/register",
    async (ctx) => {
      const body = await ctx.body();
      const fields: Record<string, string> = {};
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 2) fields.name = "Informe o seu nome.";
      if (!isEmail(body.email)) fields.email = "Informe um e-mail válido.";
      const pwd = passwordProblem(body.password);
      if (pwd) fields.password = pwd;
      if (Object.keys(fields).length) return validationError(fields);

      const email = (body.email as string).toLowerCase();
      if (db().users.some((u) => u.email.toLowerCase() === email)) {
        return fail("EMAIL_TAKEN", { details: { fields: { email: "E-mail já cadastrado." } } });
      }
      const salt = `kurio:${randomHex(8)}:`;
      const user: DbUser = {
        id: `user-${randomHex(4)}`,
        name,
        email,
        salt,
        passwordHash: await hashPassword(salt, body.password as string),
        avatar: null,
        preferences: { newsletter: false },
        createdAt: new Date().toISOString(),
      };
      db().users.push(user);
      return authResponse(user, 201);
    },
    { system: true },
  ),

  route(
    "post",
    "/auth/login",
    async (ctx) => {
      const body = await ctx.body();
      const email = typeof body.email === "string" ? body.email : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!email || !password) {
        return validationError({
          ...(email ? {} : { email: "Informe o e-mail." }),
          ...(password ? {} : { password: "Informe a senha." }),
        });
      }

      const key = email.toLowerCase();
      const now = Date.now();
      const recent = (db().loginFailures[key] ?? []).filter(
        (t) => now - t < LOGIN_WINDOW_MS,
      );
      if (recent.length >= LOGIN_MAX_FAILURES) {
        const retryAfter = Math.ceil(
          (recent[0] + LOGIN_WINDOW_MS - now) / 1000,
        );
        return fail("TOO_MANY_ATTEMPTS", {
          details: { retryAfterSeconds: retryAfter },
          headers: { "Retry-After": String(retryAfter) },
        });
      }

      const user = db().users.find((u) => u.email.toLowerCase() === key);
      const hash = user ? await hashPassword(user.salt, password) : null;
      if (!user || user.passwordHash !== hash) {
        db().loginFailures[key] = [...recent, now];
        commit();
        return fail("INVALID_CREDENTIALS");
      }
      delete db().loginFailures[key];
      return authResponse(user);
    },
    { system: true },
  ),

  route(
    "get",
    "/auth/session",
    (ctx) =>
      HttpResponse.json({
        user: publicUser(ctx.user!),
        expiresAt: new Date(ctx.session!.expiresAt).toISOString(),
      }),
    { auth: true, system: true },
  ),

  route(
    "post",
    "/auth/refresh",
    (ctx) => {
      ctx.session!.expiresAt = Date.now() + SESSION_TTL_MS;
      commit();
      return HttpResponse.json({
        token: ctx.session!.token,
        expiresAt: new Date(ctx.session!.expiresAt).toISOString(),
        user: publicUser(ctx.user!),
      });
    },
    { auth: true, system: true },
  ),

  route(
    "post",
    "/auth/logout",
    (ctx) => {
      const token = readToken(ctx.request);
      const session = db().sessions.find((s) => s.token === token);
      if (session) {
        session.revoked = true;
        commit();
      }
      return new HttpResponse(null, { status: 204 });
    },
    { system: true },
  ),

  // Resposta sempre 202, exista ou não a conta (evita enumeração de usuários)
  route(
    "post",
    "/auth/forgot-password",
    async (ctx) => {
      const body = await ctx.body();
      if (!isEmail(body.email)) {
        return validationError({ email: "Informe um e-mail válido." });
      }
      return new HttpResponse(null, { status: 202 });
    },
    { system: true },
  ),

  // Login social simulado: o código "invalid" falha, qualquer outro autentica
  route(
    "post",
    "/auth/social/:provider",
    async (ctx) => {
      const body = await ctx.body();
      const provider = ctx.params.provider;
      if (!["google", "github"].includes(provider)) {
        return fail("NOT_FOUND");
      }
      if (typeof body.code !== "string" || !body.code || body.code === "invalid") {
        return fail("INVALID_CREDENTIALS", { message: "Código social inválido." });
      }
      const email = `${provider}.user@exemplo.com`;
      let user = db().users.find((u) => u.email === email);
      if (!user) {
        user = {
          id: `user-${randomHex(4)}`,
          name: `Usuário ${provider}`,
          email,
          salt: `kurio:${randomHex(8)}:`,
          passwordHash: randomHex(32),
          avatar: null,
          preferences: { newsletter: false },
          createdAt: new Date().toISOString(),
        };
        db().users.push(user);
      }
      return authResponse(user);
    },
    { system: true },
  ),
];

import { expect, test } from "@playwright/test";
import { LARISSA, api, apiLogin, boot, mocks, uniqueEmail } from "./helpers";

test.describe("API · autenticação", () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test("cadastro: 201, e-mail duplicado 409 e validação 422 com campos", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const ok = await api(page, "POST", "/auth/register", {
      body: { name: "Nova Pessoa", email, password: "Segura@123" },
    });
    expect(ok.status).toBe(201);
    expect(ok.body.token).toMatch(/^tok_/);
    expect(ok.body.user).toMatchObject({ name: "Nova Pessoa", email });
    expect(ok.body.user.passwordHash).toBeUndefined();

    const dup = await api(page, "POST", "/auth/register", {
      body: { name: "Outra", email: email.toUpperCase(), password: "Segura@123" },
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("EMAIL_TAKEN");

    const bad = await api(page, "POST", "/auth/register", {
      body: { name: "", email: "x", password: "fraca" },
    });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(bad.body.error.details.fields).sort()).toEqual([
      "email",
      "name",
      "password",
    ]);
  });

  test("login: sucesso, credenciais inválidas e campos ausentes", async ({
    page,
  }) => {
    const ok = await api(page, "POST", "/auth/login", { body: LARISSA });
    expect(ok.status).toBe(200);
    expect(ok.body.user.email).toBe(LARISSA.email);

    const wrong = await api(page, "POST", "/auth/login", {
      body: { email: LARISSA.email, password: "errada" },
    });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");

    const missing = await api(page, "POST", "/auth/login", { body: {} });
    expect(missing.status).toBe(422);
  });

  test("login: 5 falhas bloqueiam com 429 e Retry-After", async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      const r = await api(page, "POST", "/auth/login", {
        body: { email: LARISSA.email, password: "errada" },
      });
      expect(r.status).toBe(401);
    }
    const blocked = await api(page, "POST", "/auth/login", { body: LARISSA });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("TOO_MANY_ATTEMPTS");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  test("sessão: 200 com token, 401 sem token ou com token falso", async ({
    page,
  }) => {
    const token = await apiLogin(page);
    const ok = await api(page, "GET", "/auth/session", { token });
    expect(ok.status).toBe(200);
    expect(ok.body.user.id).toBe("user-1");

    expect((await api(page, "GET", "/auth/session")).status).toBe(401);
    const fake = await api(page, "GET", "/auth/session", { token: "tok_falso" });
    expect(fake.status).toBe(401);
    expect(fake.body.error.code).toBe("SESSION_INVALID");
  });

  test("logout revoga o token no servidor", async ({ page }) => {
    const token = await apiLogin(page);
    const out = await api(page, "POST", "/auth/logout", { token });
    expect(out.status).toBe(204);
    const after = await api(page, "GET", "/auth/session", { token });
    expect(after.status).toBe(401);
  });

  test("refresh renova a sessão; sessão vencida não renova", async ({ page }) => {
    const token = await apiLogin(page);
    const refreshed = await api(page, "POST", "/auth/refresh", { token });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.token).toBe(token);

    await mocks(page, "expireSessions()");
    const expired = await api(page, "POST", "/auth/refresh", { token });
    expect(expired.status).toBe(401);
  });

  test("esqueci a senha: 202 para qualquer e-mail válido, 422 para inválido", async ({
    page,
  }) => {
    const known = await api(page, "POST", "/auth/forgot-password", {
      body: { email: LARISSA.email },
    });
    const unknown = await api(page, "POST", "/auth/forgot-password", {
      body: { email: "ninguem@exemplo.com" },
    });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    const bad = await api(page, "POST", "/auth/forgot-password", {
      body: { email: "x" },
    });
    expect(bad.status).toBe(422);
  });

  test("login social: código válido autentica, 'invalid' falha", async ({
    page,
  }) => {
    const ok = await api(page, "POST", "/auth/social/google", {
      body: { code: "abc" },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toMatch(/^tok_/);
    const bad = await api(page, "POST", "/auth/social/google", {
      body: { code: "invalid" },
    });
    expect(bad.status).toBe(401);
    const unknown = await api(page, "POST", "/auth/social/xyz", {
      body: { code: "abc" },
    });
    expect(unknown.status).toBe(404);
  });

  test("senha: atual errada 403, nova fraca 422, sucesso encerra outras sessões", async ({
    page,
  }) => {
    const email = uniqueEmail("senha");
    await api(page, "POST", "/auth/register", {
      body: { name: "Troca Senha", email, password: "Segura@123" },
    });
    const a = await api(page, "POST", "/auth/login", {
      body: { email, password: "Segura@123" },
    });
    const b = await api(page, "POST", "/auth/login", {
      body: { email, password: "Segura@123" },
    });
    const tokenA = a.body.token as string;
    const tokenB = b.body.token as string;

    const wrong = await api(page, "POST", "/profile/password", {
      token: tokenA,
      body: { currentPassword: "nada", newPassword: "Nova@12345" },
    });
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe("WRONG_PASSWORD");

    const weak = await api(page, "POST", "/profile/password", {
      token: tokenA,
      body: { currentPassword: "Segura@123", newPassword: "fraca" },
    });
    expect(weak.status).toBe(422);

    const ok = await api(page, "POST", "/profile/password", {
      token: tokenA,
      body: { currentPassword: "Segura@123", newPassword: "Nova@12345" },
    });
    expect(ok.status).toBe(204);
    expect((await api(page, "GET", "/auth/session", { token: tokenA })).status).toBe(200);
    expect((await api(page, "GET", "/auth/session", { token: tokenB })).status).toBe(401);

    const relogin = await api(page, "POST", "/auth/login", {
      body: { email, password: "Nova@12345" },
    });
    expect(relogin.status).toBe(200);
  });

  test("rotas privadas sem sessão respondem 401", async ({ page }) => {
    for (const [method, path] of [
      ["GET", "/cart"],
      ["GET", "/favorites"],
      ["GET", "/orders"],
      ["GET", "/wallets"],
      ["GET", "/profile"],
      ["POST", "/quotes"],
      ["POST", "/orders"],
    ] as const) {
      const r = await api(page, method, path, { body: {} });
      expect(r.status, `${method} ${path}`).toBe(401);
      expect(r.body.error.code).toBe("SESSION_INVALID");
    }
  });
});

import { test, expect } from "@playwright/test";

test("idempotência: mesma chave devolve o mesmo pedido; conteúdo diferente gera conflito", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Cosmic Genesis #001" }),
  ).toBeVisible();

  const result = await page.evaluate(async () => {
    const loginResponse = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "larissa@exemplo.com",
        password: "Senha@123",
      }),
    });
    const { token } = await loginResponse.json();

    const send = async (quantity: number) => {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": "chave-de-teste-1",
        },
        body: JSON.stringify({ items: [{ nftId: "1", quantity }] }),
      });
      return { status: response.status, body: await response.json() };
    };

    const first = await send(1);
    const second = await send(1);
    const third = await send(2);
    return { first, second, third };
  });

  expect(result.first.status).toBe(201);
  expect(result.second.status).toBe(200);
  expect(result.second.body.id).toBe(result.first.body.id);
  expect(result.third.status).toBe(409);
  expect(result.third.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
});

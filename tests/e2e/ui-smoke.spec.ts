import { expect, test } from "@playwright/test";
import { boot } from "./helpers";

test("a aplicação sobe, lista NFTs e conecta o tempo real", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page);

  await expect(
    page.getByRole("heading", { name: /Descubra, colecione/ }),
  ).toBeVisible();
  await expect(page.getByTestId("result-count")).toContainText("27 resultados");
  await expect(page.getByTestId("realtime-status")).toContainText("conectado");
  expect(errors).toEqual([]);
});

import { expect, test } from "@playwright/test";
import { LARISSA, boot, setScenario, uiLogin, uniqueEmail } from "./helpers";

test.describe("UI · conta", () => {
  test("cadastro: validação, sucesso e e-mail duplicado", async ({ page }) => {
    await boot(page, "/register");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Informe o seu nome.")).toBeVisible();
    await expect(page.getByText("Aceite os termos para continuar.")).toBeVisible();

    await page.getByLabel("Nome").fill("Pessoa Nova");
    await page.getByLabel("E-mail").fill(uniqueEmail("ui"));
    await page.getByLabel("Senha", { exact: true }).fill("fraca");
    await page.getByLabel("Confirmar senha").fill("outra");
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(
      page.getByText("A senha deve ter ao menos 8 caracteres."),
    ).toBeVisible();
    await expect(page.getByText("As senhas não conferem.")).toBeVisible();

    await page.getByLabel("Senha", { exact: true }).fill("Segura@123");
    await page.getByLabel("Confirmar senha").fill("Segura@123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByTestId("user-name")).toHaveText("Pessoa Nova");

    // mesmo e-mail em nova tentativa: erro vindo do servidor no campo
    await page.getByRole("button", { name: "Sair" }).click();
    await page.goto("/register");
    await page.getByLabel("Nome").fill("Duplicada");
    await page.getByLabel("E-mail").fill(LARISSA.email);
    await page.getByLabel("Senha", { exact: true }).fill("Segura@123");
    await page.getByLabel("Confirmar senha").fill("Segura@123");
    await page.getByLabel(/Li e aceito/).check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("E-mail já cadastrado.")).toBeVisible();
  });

  test("esqueci a senha confirma sem revelar se o e-mail existe", async ({
    page,
  }) => {
    await boot(page, "/forgot-password");
    await page.getByLabel("E-mail").fill("qualquer@exemplo.com");
    await page.getByRole("button", { name: "Enviar instruções" }).click();
    await expect(
      page.getByText("Se o e-mail estiver cadastrado"),
    ).toBeVisible();
  });

  test("login social entra com a conta do provedor", async ({ page }) => {
    await boot(page, "/login");
    await page.getByRole("button", { name: "Continuar com Google" }).click();
    await expect(page.getByTestId("user-name")).toContainText("google");
  });

  test("perfil: editar nome, preferências, avatar e senha", async ({ page }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await page.goto("/profile");

    await page.getByLabel("Nome", { exact: true }).fill("Larissa Atualizada");
    await page.getByLabel("Receber novidades por e-mail").check();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(
      page.getByTestId("toast").filter({ hasText: "Perfil atualizado" }),
    ).toBeVisible();
    await expect(page.getByTestId("user-name")).toHaveText("Larissa Atualizada");

    await page.reload();
    await expect(page.getByTestId("user-name")).toHaveText("Larissa Atualizada");

    await page.getByLabel("Endereço da imagem (https)").fill("nao-e-url");
    await page.getByRole("button", { name: "Atualizar avatar" }).click();
    await expect(page.getByText("Informe um endereço https válido.")).toBeVisible();
    await page
      .getByLabel("Endereço da imagem (https)")
      .fill("https://exemplo.com/avatar.png");
    await page.getByRole("button", { name: "Atualizar avatar" }).click();
    await expect(page.getByRole("img", { name: "Seu avatar" })).toBeVisible();

    await page.getByLabel("Senha atual").fill("errada");
    await page.getByLabel("Nova senha", { exact: true }).fill("Nova@12345");
    await page.getByLabel("Confirmar nova senha").fill("Nova@12345");
    await page.getByRole("button", { name: "Alterar senha" }).click();
    await expect(page.getByText("Senha atual incorreta.")).toBeVisible();

    await page.getByLabel("Senha atual").fill(LARISSA.password);
    await page.getByRole("button", { name: "Alterar senha" }).click();
    await expect(
      page.getByTestId("toast").filter({ hasText: "Senha alterada" }),
    ).toBeVisible();
  });

  test("carteiras: adicionar, validar, tornar principal e remover com confirmação", async ({
    page,
  }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await page.goto("/wallets");
    // w-1 é a principal: não oferece "Tornar principal"
    await expect(
      page.getByRole("button", { name: "Definir Principal como principal" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Definir Secundária como principal" }),
    ).toBeVisible();

    await page.getByLabel("Endereço").fill("0x123");
    await page.getByRole("button", { name: "Adicionar carteira" }).click();
    await expect(
      page.getByText("Use 0x seguido de 40 caracteres hexadecimais."),
    ).toBeVisible();

    await page
      .getByLabel("Endereço")
      .fill("0x2222222222222222222222222222222222222222");
    await page.getByLabel("Rede").selectOption("Arbitrum");
    await page.getByLabel("Apelido (opcional)").fill("Cofre");
    await page.getByRole("button", { name: "Adicionar carteira" }).click();
    await expect(page.getByText("Cofre")).toBeVisible();

    await page.getByRole("button", { name: "Definir Cofre como principal" }).click();
    await expect(
      page.getByRole("button", { name: "Definir Principal como principal" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Definir Cofre como principal" }),
    ).toHaveCount(0);

    // confirmação em diálogo: Esc cancela
    await page.getByRole("button", { name: "Remover carteira Cofre" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Remover carteira Cofre" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Remover carteira Cofre" }).click();
    await page.getByRole("button", { name: "Confirmar remoção" }).click();
    await expect(
      page.getByRole("button", { name: "Remover carteira Cofre" }),
    ).toHaveCount(0);
  });

  test("favoritos: otimista, persiste e entra na lista", async ({ page }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await page.goto("/");

    const card = page.getByTestId("nft-card-1");
    const heart = card.getByRole("button", { name: /Favoritar Cosmic/ });
    await expect(heart).toContainText("120");
    await heart.click();
    await expect(
      card.getByRole("button", { name: /Remover Cosmic Genesis #001 dos favoritos/ }),
    ).toContainText("121");

    await page.goto("/favorites");
    await expect(page.getByRole("heading", { name: "Cosmic Genesis #001" })).toBeVisible();
  });

  test("favoritos: rollback e aviso quando a API falha", async ({ page }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await page.goto("/");
    await setScenario(page, { favoritesFail: true });

    const card = page.getByTestId("nft-card-1");
    await card.getByRole("button", { name: /Favoritar Cosmic/ }).click();
    await expect(page.getByTestId("toast").first()).toContainText(
      "Não foi possível atualizar os favoritos",
    );
    // voltou ao estado anterior
    const heart = card.getByRole("button", { name: /Favoritar Cosmic/ });
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await expect(heart).toContainText("120");
  });

  test("favoritar sem login leva ao login e volta à página", async ({ page }) => {
    await boot(page, "/nfts/1");
    await page
      .getByRole("button", { name: "Favoritar Cosmic Genesis #001", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login\?redirect=%2Fnfts%2F1/);
  });

  test("newsletter valida o e-mail e confirma a inscrição", async ({ page }) => {
    await boot(page);
    const news = page.getByRole("region", { name: "Receba as novidades" });
    await news.getByLabel("E-mail").fill("invalido");
    await news.getByRole("button", { name: "Assinar" }).click();
    await expect(news.getByText("Informe um e-mail válido.")).toBeVisible();
    await news.getByLabel("E-mail").fill("leitor@exemplo.com");
    await news.getByRole("button", { name: "Assinar" }).click();
    await expect(news.getByText("Inscrição confirmada. Obrigado!")).toBeVisible();
  });
});

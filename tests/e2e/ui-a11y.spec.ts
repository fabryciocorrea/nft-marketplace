import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { LARISSA, boot, uiLogin } from "./helpers";

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];

async function noHorizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
}

// Contraste WCAG entre duas cores hexadecimais
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test.describe("Responsividade (390 / 768 / 1440)", () => {
  for (const vp of VIEWPORTS) {
    test(`sem rolagem horizontal em ${vp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const publicRoutes = ["/", "/nfts/1", "/cart", "/login", "/register"];
      for (const route of publicRoutes) {
        await boot(page, route);
        await expect(page.getByRole("main")).toBeVisible();
        expect(await noHorizontalOverflow(page), `${route} @${vp.name}`).toBe(
          true,
        );
      }

      await uiLogin(page, LARISSA);
      await expect(page.getByTestId("user-name")).toBeVisible();
      for (const route of ["/orders", "/profile", "/wallets", "/favorites"]) {
        await page.goto(route);
        await expect(page.getByRole("main")).toBeVisible();
        expect(await noHorizontalOverflow(page), `${route} @${vp.name}`).toBe(
          true,
        );
      }
    });
  }

  test("grade do catálogo: 1 coluna no mobile e 3 no desktop", async ({
    page,
  }) => {
    const columns = async () =>
      page.evaluate(() => {
        const cards = [
          ...document.querySelectorAll("[data-testid^=nft-card-]"),
        ];
        return new Set(
          cards
            .slice(0, 9)
            .map((c) => Math.round(c.getBoundingClientRect().left)),
        ).size;
      });
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await expect(page.getByTestId("nft-card-1")).toBeVisible();
    expect(await columns()).toBe(1);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId("nft-card-1")).toBeVisible();
    expect(await columns()).toBe(3);
  });
});

test.describe("Acessibilidade", () => {
  test("tokens de cor atendem aos contrastes mínimos (WCAG)", async ({
    page,
  }) => {
    await boot(page);
    const t = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      const get = (n: string) => s.getPropertyValue(n).trim();
      return {
        ink: get("--color-ink"),
        card: get("--color-card"),
        fg: get("--color-fg"),
        muted: get("--color-muted"),
        accent: get("--color-accent"),
        primary: get("--color-primary"),
        line: get("--color-line"),
        danger: get("--color-danger"),
        success: get("--color-success"),
        secondary: get("--color-secondary"),
      };
    });
    // texto normal >= 4.5:1
    expect(contrast(t.fg, t.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.muted, t.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.muted, t.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.accent, t.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.secondary, t.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.danger, t.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.success, t.ink)).toBeGreaterThanOrEqual(4.5);
    // botão primário: texto escuro sobre cobre
    expect(contrast(t.ink, t.primary)).toBeGreaterThanOrEqual(4.5);
    // componentes de interface (bordas de campos/botões) >= 3:1
    expect(contrast(t.line, t.ink)).toBeGreaterThanOrEqual(3);
    expect(contrast(t.line, t.card)).toBeGreaterThanOrEqual(3);
  });

  test("estrutura: marcos, um h1 por página e imagens com alt", async ({
    page,
  }) => {
    for (const route of ["/", "/nfts/1", "/cart", "/login", "/register"]) {
      await boot(page, route);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Principal" }),
      ).toBeVisible();
      const h1s = await page.getByRole("heading", { level: 1 }).count();
      expect(h1s, `h1 em ${route}`).toBe(1);
      const missingAlt = await page.evaluate(
        () => [...document.images].filter((i) => !i.hasAttribute("alt")).length,
      );
      expect(missingAlt, `alt em ${route}`).toBe(0);
    }
  });

  test("título do documento muda por rota", async ({ page }) => {
    await boot(page, "/");
    await expect(page).toHaveTitle("KURIO — Marketplace de NFTs");
    await page.goto("/cart");
    await expect(page).toHaveTitle("Carrinho · KURIO");
    await page.goto("/login");
    await expect(page).toHaveTitle("Entrar · KURIO");
  });

  test("link para ir ao conteúdo aparece com Tab e leva ao main", async ({
    page,
  }) => {
    await boot(page, "/cart");
    // espera a interface renderizar antes de usar o teclado
    await expect(page.getByRole("main")).toBeVisible();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Ir para o conteúdo" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#conteudo$/);
  });

  test("foco visível nos controles interativos", async ({ page }) => {
    await boot(page, "/login");
    await page.getByLabel("E-mail").focus();
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });

  test("diálogo prende o foco, fecha com Esc e devolve o foco ao gatilho", async ({
    page,
  }) => {
    await uiLogin(page, LARISSA);
    await expect(page.getByTestId("user-name")).toBeVisible();
    await page.goto("/wallets");
    const trigger = page.getByRole("button", {
      name: "Remover carteira Secundária",
    });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () => !!document.activeElement?.closest("[role=dialog]"),
      );
      expect(inside).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("quantidade do carrinho é anunciada (aria-live) e botões têm nome", async ({
    page,
  }) => {
    await boot(page, "/nfts/3");
    await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
    await page.goto("/cart");
    await expect(page.getByTestId("qty-3")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    for (const b of await page.getByRole("button").all()) {
      const name = (await b.getAttribute("aria-label")) ?? (await b.innerText());
      expect(name.trim().length, "botão sem nome acessível").toBeGreaterThan(0);
    }
  });

  test("campos de formulário têm rótulo e erros usam role=alert", async ({
    page,
  }) => {
    await boot(page, "/register");
    await page.getByRole("button", { name: "Criar conta" }).click();
    const unlabeled = await page.evaluate(
      () =>
        [...document.querySelectorAll("input,select,textarea")].filter((el) => {
          const id = el.getAttribute("id");
          const hasLabel = id && document.querySelector(`label[for="${id}"]`);
          return (
            !hasLabel && !el.closest("label") && !el.getAttribute("aria-label")
          );
        }).length,
    );
    expect(unlabeled).toBe(0);
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByLabel("Nome")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("prefers-reduced-motion desliga a animação do skeleton", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await boot(page, "/");
    const name = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "skeleton";
      document.body.appendChild(el);
      return getComputedStyle(el).animationName;
    });
    expect(name).toBe("none");
  });
});

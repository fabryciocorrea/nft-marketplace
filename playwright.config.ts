import { defineConfig, devices } from "@playwright/test";

// E2E_PREVIEW=1 roda a suíte contra o build de produção (o que vai ao ar)
const PREVIEW = process.env.E2E_PREVIEW === "1";
const PORT = PREVIEW ? 4173 : 5173;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  // Sobe o app com os mocks ativos (ou reaproveita o que já estiver rodando)
  webServer: {
    command: PREVIEW
      ? `npm run build && npm run preview -- --port ${PORT} --strictPort`
      : `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: PREVIEW ? 180_000 : 60_000,
  },
});

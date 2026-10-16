// Auditoria Lighthouse do build de produção (npm run build antes).
// Uso: npm run lighthouse   (CHROME_PATH aponta para o Chromium do Playwright)
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const PORT = 4174;
const ROUTES = [
  { name: "inicio", path: "/" },
  { name: "detalhe", path: "/nfts/1" },
  { name: "carrinho", path: "/cart" },
  { name: "login", path: "/login" },
];

const server = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "preview", "--port", String(PORT), "--strictPort"],
  { stdio: "ignore", shell: process.platform === "win32" },
);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("vite preview não respondeu");
}

const results = [];
let chrome;
try {
  await waitForServer();
  chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox"],
  });
  mkdirSync("lighthouse-report", { recursive: true });

  for (const route of ROUTES) {
    const run = await lighthouse(
      `http://localhost:${PORT}${route.path}`,
      { port: chrome.port, output: "json", logLevel: "error" },
      {
        extends: "lighthouse:default",
        settings: {
          formFactor: "mobile",
          onlyCategories: [
            "performance",
            "accessibility",
            "best-practices",
            "seo",
          ],
        },
      },
    );
    const lhr = run.lhr;
    writeFileSync(
      `lighthouse-report/${route.name}.json`,
      JSON.stringify(lhr, null, 2),
    );
    const score = (id) => Math.round((lhr.categories[id]?.score ?? 0) * 100);
    results.push({
      rota: route.path,
      performance: score("performance"),
      acessibilidade: score("accessibility"),
      "boas-praticas": score("best-practices"),
      seo: score("seo"),
      lcp: lhr.audits["largest-contentful-paint"]?.displayValue,
      cls: lhr.audits["cumulative-layout-shift"]?.displayValue,
    });
  }
  console.table(results);
  writeFileSync(
    "lighthouse-report/resumo.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  if (chrome) await chrome.kill();
  server.kill();
}

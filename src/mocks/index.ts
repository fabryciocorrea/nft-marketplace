import { setupWorker } from "msw/browser";
import { accountHandlers } from "./handlers/account";
import { adminHandlers } from "./handlers/admin";
import { authHandlers } from "./handlers/auth";
import { cartHandlers } from "./handlers/cart";
import { catalogHandlers } from "./handlers/catalog";
import { commerceHandlers } from "./handlers/commerce";
import { contentHandlers } from "./handlers/content";
import { favoritesHandlers } from "./handlers/favorites";
import { commit, db, refresh, resetDb, resumePendingOrders } from "./db";
import {
  applyScenarioFromUrl,
  getScenario,
  resetScenario,
  setScenario,
} from "./scenarios";
import { socketHandlers, socketTools } from "./socket";

export const handlers = [
  ...authHandlers,
  ...catalogHandlers,
  ...favoritesHandlers,
  ...cartHandlers,
  ...commerceHandlers,
  ...accountHandlers,
  ...contentHandlers,
  ...adminHandlers,
];

export const worker = setupWorker(...handlers, ...socketHandlers);

export async function startMocks() {
  applyScenarioFromUrl(window.location.search);
  await worker.start({ onUnhandledFrame: "bypass" });
  resumePendingOrders();
  // Atalhos para testes E2E e demonstrações
  (window as unknown as Record<string, unknown>).__kurioMocks = {
    reset: () => {
      resetDb();
      resetScenario();
    },
    getScenario,
    setScenario,
    socket: socketTools,
    // Vence todas as cotações (testa QUOTE_EXPIRED sem esperar 60 s)
    expireQuotes: () => {
      refresh();
      db().quotes.forEach((q) => (q.expiresAt = Date.now() - 1000));
      commit();
    },
    // Vence a sessão por tempo (testa refresh e expiração)
    expireSessions: () => {
      refresh();
      db().sessions.forEach((s) => (s.expiresAt = Date.now() - 1000));
      commit();
    },
  };
}

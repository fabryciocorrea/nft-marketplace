import { HttpResponse } from "msw";
import { resetDb } from "../db";
import { getScenario, resetScenario, setScenario } from "../scenarios";
import type { Scenario } from "../scenarios";
import { route } from "../http";

// Rotas exclusivas do mock (não existem numa API real)
export const adminHandlers = [
  route(
    "post",
    "/__reset",
    () => {
      resetDb();
      resetScenario();
      return new HttpResponse(null, { status: 204 });
    },
    { system: true },
  ),
  route("get", "/__scenario", () => HttpResponse.json(getScenario()), {
    system: true,
  }),
  route(
    "put",
    "/__scenario",
    async (ctx) => {
      const patch = (await ctx.body()) as Partial<Scenario>;
      return HttpResponse.json(setScenario(patch));
    },
    { system: true },
  ),
];

import { HttpResponse } from "msw";
import { commit, db } from "../db";
import { validationError } from "../errors";
import { POSTS } from "../fixtures/seed";
import { isEmail, route } from "../http";

export const contentHandlers = [
  route("get", "/posts", () => HttpResponse.json(POSTS)),

  // Idempotente: repetir o mesmo e-mail devolve 200 em vez de 201
  route("post", "/newsletter", async (ctx) => {
    const body = await ctx.body();
    if (!isEmail(body.email)) {
      return validationError({ email: "Informe um e-mail válido." });
    }
    const email = body.email.toLowerCase();
    if (db().newsletter.includes(email)) {
      return HttpResponse.json({ subscribed: true }, { status: 200 });
    }
    db().newsletter.push(email);
    commit();
    return HttpResponse.json({ subscribed: true }, { status: 201 });
  }),
];

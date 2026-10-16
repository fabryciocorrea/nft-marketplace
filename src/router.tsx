import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";
import { z } from "zod";
import Layout from "./components/Layout";
import { sessionQuery } from "./hooks/useSession";
import Home from "./pages/Home";
import { EmptyState } from "./components/ui/misc";

// Páginas fora do catálogo carregam sob demanda (menos JS na primeira tela)
const lazyPage = (
  load: () => Promise<Record<string, unknown>>,
  exportName = "default",
) => lazyRouteComponent(load as never, exportName as never);

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Layout,
  notFoundComponent: () => (
    <EmptyState
      level={1}
      title="Página não encontrada"
      description="O endereço não existe ou foi movido."
    />
  ),
});

// Rota privada: sem sessão, vai para o login e volta ao contexto original
async function requireUser({
  context,
  location,
}: {
  context: RouterContext;
  location: { href: string };
}) {
  const user = await context.queryClient
    .ensureQueryData(sessionQuery)
    .catch(() => null);
  if (!user) {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }
}

const optionalString = z.string().optional().catch(undefined);

const homeSearch = z.object({
  q: optionalString,
  collection: optionalString,
  network: optionalString,
  minPrice: optionalString,
  maxPrice: optionalString,
  tab: optionalString,
  sort: optionalString,
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search) => homeSearch.parse(search),
  component: Home,
});

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/nfts/$id",
  component: lazyPage(() => import("./pages/NftDetail")),
});

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cart",
  component: lazyPage(() => import("./pages/Cart")),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search) =>
    z.object({ redirect: optionalString }).parse(search),
  component: lazyPage(() => import("./pages/Auth"), "LoginPage"),
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: lazyPage(() => import("./pages/Auth"), "RegisterPage"),
});

const forgotRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: lazyPage(() => import("./pages/Auth"), "ForgotPasswordPage"),
});

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/checkout",
  beforeLoad: requireUser,
  component: lazyPage(() => import("./pages/Checkout")),
});

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/order/$id",
  beforeLoad: requireUser,
  component: lazyPage(() => import("./pages/Order")),
});

const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders",
  beforeLoad: requireUser,
  component: lazyPage(() => import("./pages/Orders")),
});

const favoritesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/favorites",
  beforeLoad: requireUser,
  component: lazyPage(() => import("./pages/Favorites")),
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  beforeLoad: requireUser,
  component: lazyPage(() => import("./pages/Profile")),
});

const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wallets",
  beforeLoad: requireUser,
  component: lazyPage(() => import("./pages/Wallets")),
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftRoute,
  cartRoute,
  loginRoute,
  registerRoute,
  forgotRoute,
  checkoutRoute,
  orderRoute,
  ordersRoute,
  favoritesRoute,
  profileRoute,
  walletsRoute,
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    // URL legível: ?q=cosmic&minPrice=1 (sem aspas JSON nos valores)
    parseSearch: (search) =>
      Object.fromEntries(
        new URLSearchParams(search.startsWith("?") ? search.slice(1) : search),
      ),
    stringifySearch: (search) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(search)) {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, String(value));
        }
      }
      const text = params.toString();
      return text ? `?${text}` : "";
    },
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

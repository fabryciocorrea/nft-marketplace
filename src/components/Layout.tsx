import { useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useCart } from "../hooks/useCart";
import { clearPrivateData, useSession } from "../hooks/useSession";
import { SESSION_EXPIRED, authEvents } from "../services/api";
import { logout } from "../services/endpoints";
import { connectSocket, disconnectSocket, useRealtime } from "../services/socket";
import { toast, useToasts } from "../services/toast";
import { cn } from "../lib/cn";

const PRIVATE_PREFIXES = [
  "/checkout",
  "/orders",
  "/order/",
  "/profile",
  "/wallets",
  "/favorites",
];

function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          data-testid="toast"
          className={cn(
            "pointer-events-auto flex items-start justify-between gap-3 rounded-lg border bg-card p-3 text-sm shadow-lg",
            t.tone === "error"
              ? "border-danger text-danger"
              : t.tone === "success"
                ? "border-success text-success"
                : "border-line text-fg",
          )}
        >
          <span>{t.message}</span>
          <button
            aria-label="Dispensar aviso"
            className="cursor-pointer"
            onClick={() => dismiss(t.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useSession();
  const cart = useCart();
  const search = useRouterState({
    select: (s) => (s.location.search as { q?: string }).q ?? "",
  });
  const [term, setTerm] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setTerm(search), [search]);

  const submit = (value: string, replace = false) =>
    navigate({
      to: "/",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        q: value || undefined,
        page: undefined,
      }),
      replace,
    });

  const onSearchChange = (value: string) => {
    setTerm(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => submit(value.trim(), true), 300);
  };

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    clearPrivateData(queryClient);
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link
          to="/"
          search={{}}
          className="text-xl font-bold tracking-[0.3em] text-primary"
        >
          KURIO
        </Link>

        <form
          role="search"
          className="order-3 w-full md:order-none md:max-w-sm md:flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            clearTimeout(timer.current);
            submit(term.trim());
          }}
        >
          <label htmlFor="global-search" className="sr-only">
            Buscar NFTs
          </label>
          <input
            id="global-search"
            type="search"
            value={term}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar NFTs, coleções ou criadores"
            className="h-10 w-full rounded-lg border border-line bg-card px-3 text-sm placeholder:text-secondary"
          />
        </form>

        <nav
          aria-label="Principal"
          className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
        >
          {user && (
            <Link to="/favorites" className="text-muted hover:text-fg">
              Favoritos
            </Link>
          )}
          <Link
            to="/cart"
            aria-label={`Carrinho, ${cart.count} ${cart.count === 1 ? "item" : "itens"}`}
            className="flex items-center gap-1 text-fg hover:text-accent"
          >
            <span aria-hidden="true">Carrinho</span>
            <span
              data-testid="cart-count"
              aria-hidden="true"
              className="rounded-full bg-primary px-2 text-xs font-bold text-ink"
            >
              {cart.count}
            </span>
          </Link>
          {user ? (
            <>
              <Link to="/orders" className="text-muted hover:text-fg">
                Pedidos
              </Link>
              <Link to="/wallets" className="text-muted hover:text-fg">
                Carteiras
              </Link>
              <Link
                to="/profile"
                className="font-bold text-accent"
                data-testid="user-name"
              >
                {user.name}
              </Link>
              <button
                onClick={handleLogout}
                className="cursor-pointer text-danger underline"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                search={{}}
                className="rounded-lg border border-primary bg-primary px-3 py-1.5 font-bold text-ink hover:bg-accent"
              >
                Entrar
              </Link>
              <Link to="/register" className="text-muted hover:text-fg">
                Cadastrar
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const connected = useRealtime((s) => s.connected);
  const events = useRealtime((s) => s.events);
  const discarded = useRealtime((s) => s.discarded);
  return (
    <footer className="mt-16 border-t border-line-soft py-8 text-xs text-secondary">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4">
        <span>© 2026 KURIO · Marketplace de NFTs (ambiente simulado)</span>
        <span data-testid="realtime-status" aria-live="polite">
          Tempo real: {connected ? "conectado" : "desconectado"}
        </span>
        <span data-testid="realtime-stats" className="sr-only">
          eventos {events} descartados {discarded}
        </span>
      </div>
    </footer>
  );
}

const TITLES: [RegExp, string][] = [
  [/^\/nfts\//, "Detalhes do NFT"],
  [/^\/cart/, "Carrinho"],
  [/^\/checkout/, "Pagamento"],
  [/^\/order\//, "Pedido"],
  [/^\/orders/, "Meus pedidos"],
  [/^\/favorites/, "Favoritos"],
  [/^\/login/, "Entrar"],
  [/^\/register/, "Criar conta"],
  [/^\/forgot-password/, "Recuperar senha"],
  [/^\/profile/, "Perfil"],
  [/^\/wallets/, "Carteiras"],
];

// Título do documento por rota (leitores de tela anunciam a mudança)
function useDocumentTitle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    const match = TITLES.find(([re]) => re.test(pathname));
    document.title = match ? `${match[1]} · KURIO` : "KURIO — Marketplace de NFTs";
  }, [pathname]);
}

export default function Layout() {
  useDocumentTitle();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const { data: user } = useSession();
  const userId = user?.id ?? null;

  // O socket reconecta quando o usuário muda e é fechado na saída
  useEffect(() => {
    connectSocket(queryClient);
    return () => disconnectSocket();
  }, [queryClient, userId]);

  // Sessão expirada em qualquer requisição: limpa, avisa e retoma o contexto
  useEffect(() => {
    const onExpired = () => {
      clearPrivateData(queryClient);
      toast.error("Sua sessão expirou. Entre novamente para continuar.");
      const { href, pathname } = router.state.location;
      if (PRIVATE_PREFIXES.some((p) => pathname.startsWith(p))) {
        navigate({ to: "/login", search: { redirect: href } });
      }
    };
    authEvents.addEventListener(SESSION_EXPIRED, onExpired);
    return () => authEvents.removeEventListener(SESSION_EXPIRED, onExpired);
  }, [queryClient, navigate, router]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-ink"
      >
        Ir para o conteúdo
      </a>
      <Header />
      <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}

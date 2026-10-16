import { useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import {
  HeartIcon,
  MenuIcon,
  PackageIcon,
  SearchIcon,
  ShoppingCartIcon,
  UserIcon,
  WalletIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useCart } from "../hooks/useCart";
import { clearPrivateData, useSession } from "../hooks/useSession";
import { SESSION_EXPIRED, authEvents } from "../services/api";
import { logout } from "../services/endpoints";
import {
  connectSocket,
  disconnectSocket,
  useRealtime,
} from "../services/socket";
import { toast } from "../services/toast";

const PRIVATE_PREFIXES = [
  "/checkout",
  "/orders",
  "/order/",
  "/profile",
  "/wallets",
  "/favorites",
];

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
    document.title = match
      ? `${match[1]} · KURIO`
      : "KURIO — Marketplace de NFTs";
  }, [pathname]);
}

function Logo() {
  return (
    <Link
      to="/"
      search={{}}
      className="flex items-center gap-2 text-xl font-bold tracking-tight"
      aria-label="KURIO, ir para o início"
    >
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground"
      >
        K
      </span>
      <span>KURIO</span>
    </Link>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useSession();
  const cart = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
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
    setMenuOpen(false);
    await logout().catch(() => undefined);
    clearPrivateData(queryClient);
    navigate({ to: "/" });
  };

  const linkClass =
    "rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <Logo />

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
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="global-search"
              type="search"
              value={term}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar NFTs, coleções ou criadores"
              className="h-10 rounded-lg pl-9"
            />
          </div>
        </form>

        <nav
          aria-label="Principal"
          className="ml-auto flex items-center gap-1 sm:gap-2"
        >
          {user && (
            <div className="hidden items-center gap-1 md:flex">
              <Link to="/favorites" className={linkClass}>
                Favoritos
              </Link>
              <Link to="/orders" className={linkClass}>
                Pedidos
              </Link>
              <Link to="/wallets" className={linkClass}>
                Carteiras
              </Link>
            </div>
          )}

          <Link
            to="/cart"
            aria-label={`Carrinho, ${cart.count} ${cart.count === 1 ? "item" : "itens"}`}
            className="relative flex size-10 items-center justify-center rounded-lg hover:bg-muted"
          >
            <ShoppingCartIcon aria-hidden="true" className="size-5" />
            <span
              data-testid="cart-count"
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground"
            >
              {cart.count}
            </span>
          </Link>

          {user ? (
            <>
              <Link
                to="/profile"
                className="flex max-w-[9rem] items-center gap-2 rounded-lg px-1.5 py-1 text-sm font-medium hover:bg-muted"
              >
                <Avatar className="size-7">
                  {user.avatar && <AvatarImage src={user.avatar} alt="" />}
                  <AvatarFallback className="text-xs">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span data-testid="user-name" className="truncate">
                  {user.name}
                </span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex"
                onClick={handleLogout}
              >
                Sair
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <Link to="/login" search={{}}>
                  Entrar
                </Link>
              </Button>
              <Button
                asChild
                variant="dark"
                size="sm"
                className="hidden md:inline-flex"
              >
                <Link to="/register">Cadastrar</Link>
              </Button>
            </>
          )}

          {/* Menu móvel (Sheet) */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Abrir menu"
              >
                <MenuIcon aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription className="sr-only">
                  Navegação principal
                </SheetDescription>
              </SheetHeader>
              <ul className="flex flex-col gap-1 px-4 pb-4">
                {[
                  { to: "/", label: "Catálogo", icon: SearchIcon },
                  ...(user
                    ? [
                        { to: "/favorites", label: "Favoritos", icon: HeartIcon },
                        { to: "/orders", label: "Pedidos", icon: PackageIcon },
                        { to: "/wallets", label: "Carteiras", icon: WalletIcon },
                        { to: "/profile", label: "Perfil", icon: UserIcon },
                      ]
                    : [{ to: "/register", label: "Cadastrar", icon: UserIcon }]),
                ].map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium hover:bg-muted"
                    >
                      <item.icon aria-hidden="true" className="size-5" />
                      {item.label}
                    </Link>
                  </li>
                ))}
                {user && (
                  <li>
                    <button
                      onClick={handleLogout}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-base font-medium text-destructive hover:bg-muted"
                    >
                      Sair
                    </button>
                  </li>
                )}
              </ul>
            </SheetContent>
          </Sheet>
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
    <footer className="mt-16 border-t bg-secondary py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
        <span>© 2026 KURIO · Marketplace de NFTs (ambiente simulado)</span>
        <span
          data-testid="realtime-status"
          aria-live="polite"
          className="flex items-center gap-2"
        >
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${connected ? "bg-success" : "bg-muted-foreground"}`}
          />
          Tempo real: {connected ? "conectado" : "desconectado"}
        </span>
        <span data-testid="realtime-stats" className="sr-only">
          eventos {events} descartados {discarded}
        </span>
      </div>
    </footer>
  );
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
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Ir para o conteúdo
      </a>
      <Header />
      <main
        id="conteudo"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:py-10"
      >
        <Outlet />
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}

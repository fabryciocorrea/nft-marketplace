import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "../components/ui/button";
import { Card, EmptyState, Skeleton } from "../components/ui/misc";
import { useCart } from "../hooks/useCart";
import { useSession } from "../hooks/useSession";
import { formatEth } from "../utils/money";

export default function CartPage() {
  const cart = useCart();
  const { data: user } = useSession();
  const navigate = useNavigate();

  if (cart.isLoading) return <Skeleton className="h-48 w-full" />;

  if (cart.rows.length === 0) {
    return (
      <EmptyState
        title="Seu carrinho está vazio"
        description="Explore o catálogo e adicione NFTs para comprar."
      >
        <Button asChild>
          <Link to="/" search={{}}>
            Explorar catálogo
          </Link>
        </Button>
      </EmptyState>
    );
  }

  const goToCheckout = () => {
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/checkout" } });
      return;
    }
    navigate({ to: "/checkout" });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <section aria-labelledby="cart-title">
        <h1 id="cart-title" className="mb-4 text-2xl font-bold">
          Seu carrinho
        </h1>
        <ul className="flex flex-col gap-3">
          {cart.rows.map((row) => (
            <li key={row.nft.id}>
              <Card
                data-testid={`cart-row-${row.nft.id}`}
                className="flex flex-wrap items-center gap-4 p-4"
              >
                <img
                  src={row.nft.image}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <div className="min-w-40 flex-1">
                  <Link
                    to="/nfts/$id"
                    params={{ id: row.nft.id }}
                    className="font-bold hover:text-accent"
                  >
                    {row.nft.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {formatEth(row.nft.priceEth)} ETH cada · {row.nft.network}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Diminuir quantidade de ${row.nft.title}`}
                      disabled={cart.isBusy}
                      onClick={() => cart.decrement(row.nft, row.quantity)}
                    >
                      −
                    </Button>
                    <span
                      data-testid={`qty-${row.nft.id}`}
                      aria-live="polite"
                      className="min-w-6 text-center"
                    >
                      {row.quantity}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Aumentar quantidade de ${row.nft.title}`}
                      disabled={
                        cart.isBusy || row.quantity >= row.nft.availableQuantity
                      }
                      onClick={() => cart.add(row.nft)}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-accent">
                    {formatEth(row.lineTotal)} ETH
                  </p>
                  <button
                    onClick={() => cart.remove(row.nft)}
                    className="mt-1 cursor-pointer text-xs text-danger underline"
                    aria-label={`Remover ${row.nft.title} do carrinho`}
                  >
                    Remover
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <aside aria-labelledby="summary-title">
        <Card className="sticky top-24 p-5">
          <h2 id="summary-title" className="text-lg font-bold">
            Resumo
          </h2>
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd data-testid="cart-subtotal" className="font-bold">
                {formatEth(cart.subtotal)} ETH
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Taxa de rede</dt>
              <dd className="text-secondary">calculada no pagamento</dd>
            </div>
          </dl>
          {!user && (
            <p className="mt-4 text-xs text-muted">
              Entre na sua conta para pagar. Seu carrinho será mantido.
            </p>
          )}
          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={goToCheckout}>
              {user ? "Ir para o pagamento" : "Entrar para comprar"}
            </Button>
            <Button variant="ghost" onClick={cart.clear} disabled={cart.isBusy}>
              Esvaziar carrinho
            </Button>
          </div>
        </Card>
      </aside>
    </div>
  );
}

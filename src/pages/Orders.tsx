import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Badge, Card, EmptyState, ErrorState, Skeleton } from "../components/ui/misc";
import { useSession } from "../hooks/useSession";
import { parseError } from "../services/api";
import { fetchOrders } from "../services/endpoints";
import { formatEth } from "../utils/money";

const LABEL = {
  pending: "Pendente",
  confirmed: "Confirmado",
  failed: "Recusado",
} as const;

export default function OrdersPage() {
  const { data: user } = useSession();
  const [page, setPage] = useState(1);
  const orders = useQuery({
    queryKey: ["orders-list", user?.id, page],
    queryFn: () => fetchOrders(page),
    enabled: !!user,
    placeholderData: (p) => p,
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Meus pedidos</h1>

      {orders.isLoading && <Skeleton className="h-32 w-full" />}
      {orders.isError && (
        <ErrorState
          message={parseError(orders.error).message}
          onRetry={() => orders.refetch()}
        />
      )}

      {orders.data && orders.data.items.length === 0 && (
        <EmptyState
          title="Você ainda não fez pedidos"
          description="Quando comprar um NFT, o recibo aparece aqui."
        >
          <Button asChild>
            <Link to="/" search={{}}>
              Explorar catálogo
            </Link>
          </Button>
        </EmptyState>
      )}

      <ul className="flex flex-col gap-3">
        {(orders.data?.items ?? []).map((o) => (
          <li key={o.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link
                  to="/order/$id"
                  params={{ id: o.id }}
                  className="font-bold hover:text-accent"
                >
                  {o.id}
                </Link>
                <p className="text-xs text-muted">
                  {new Date(o.createdAt).toLocaleString("pt-BR")} ·{" "}
                  {o.items.length} {o.items.length === 1 ? "item" : "itens"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge data-testid={`order-badge-${o.id}`}>
                  {LABEL[o.status]}
                </Badge>
                <span className="font-bold text-accent">
                  {formatEth(o.total)} ETH
                </span>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {orders.data && orders.data.totalPages > 1 && (
        <nav aria-label="Paginação" className="flex items-center gap-4">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm">
            Página {orders.data.page} de {orders.data.totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= orders.data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </nav>
      )}
    </div>
  );
}

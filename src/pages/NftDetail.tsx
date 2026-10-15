import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import FavoriteButton from "../components/FavoriteButton";
import NftCard from "../components/NftCard";
import { Button } from "../components/ui/button";
import { Badge, Card, EmptyState, ErrorState, Skeleton } from "../components/ui/misc";
import { useCart } from "../hooks/useCart";
import { parseError } from "../services/api";
import { fetchNft, fetchRelated, fetchReviews } from "../services/endpoints";
import { formatEth } from "../utils/money";

const route = getRouteApi("/nfts/$id");

export default function NftDetail() {
  const { id } = route.useParams();
  const navigate = useNavigate();
  const cart = useCart();

  const nft = useQuery({
    queryKey: ["nft", id],
    queryFn: ({ signal }) => fetchNft(id, signal),
    retry: (count, error) => parseError(error).status !== 404 && count < 2,
  });
  const related = useQuery({
    queryKey: ["related", id],
    queryFn: () => fetchRelated(id),
  });
  const reviews = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => fetchReviews(id),
  });

  if (nft.isLoading) {
    return (
      <div className="grid gap-8 md:grid-cols-2" aria-busy="true">
        <Skeleton className="aspect-square w-full" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (nft.isError) {
    const notFound = parseError(nft.error).status === 404;
    return notFound ? (
      <EmptyState
        title="NFT não encontrado"
        description="O item pode ter sido removido ou o endereço está incorreto."
      >
        <Button asChild>
          <Link to="/" search={{}}>
            Voltar ao catálogo
          </Link>
        </Button>
      </EmptyState>
    ) : (
      <ErrorState
        message={`Erro ao carregar o NFT: ${parseError(nft.error).message}`}
        onRetry={() => nft.refetch()}
      />
    );
  }

  const item = nft.data!;
  const inCart = cart.quantityOf(item.id);
  const soldOut = item.availableQuantity < 1;
  const maxed = inCart >= item.availableQuantity;

  const buyNow = () => {
    if (!soldOut && !maxed) cart.add(item);
    navigate({ to: "/checkout" });
  };

  return (
    <div className="flex flex-col gap-12">
      <nav aria-label="Trilha de navegação" className="text-xs text-secondary">
        <Link to="/" search={{}} className="hover:text-fg">
          Catálogo
        </Link>{" "}
        / <span>{item.title}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <img
          src={item.image}
          alt={item.title}
          className="aspect-square w-full rounded-xl border border-line-soft object-cover"
        />

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{item.network}</Badge>
            <Badge>{item.category}</Badge>
          </div>
          <h1 className="text-2xl font-bold md:text-3xl">{item.title}</h1>
          <p className="text-sm text-muted">
            Coleção {item.collection.name} · por {item.author.name}
            {item.author.verified ? " ✓" : ""}
          </p>
          <p className="text-base">{item.description}</p>

          <Card className="p-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-secondary">Preço</dt>
                <dd data-testid="detail-price" className="text-xl font-bold text-accent">
                  {formatEth(item.priceEth)} ETH
                </dd>
              </div>
              <div>
                <dt className="text-xs text-secondary">Edições disponíveis</dt>
                <dd data-testid="detail-stock" className="text-xl font-bold">
                  {item.availableQuantity}
                </dd>
              </div>
            </dl>
          </Card>

          {soldOut && (
            <p role="status" className="text-sm font-bold text-danger">
              Este NFT está esgotado.
            </p>
          )}
          {!soldOut && maxed && (
            <p role="status" className="text-sm text-muted">
              Você já tem todas as edições disponíveis no carrinho.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={soldOut || maxed || cart.isBusy} onClick={() => cart.add(item)}>
              Adicionar ao carrinho
            </Button>
            <Button variant="outline" disabled={soldOut && inCart === 0} onClick={buyNow}>
              Comprar agora
            </Button>
            <FavoriteButton nft={item} />
          </div>
        </div>
      </div>

      <section aria-labelledby="reviews-title">
        <h2 id="reviews-title" className="mb-3 text-xl font-bold">
          Avaliações
        </h2>
        {reviews.isLoading ? (
          <Skeleton className="h-20" />
        ) : (
          <ul className="flex flex-col gap-3">
            {(reviews.data?.items ?? []).map((r) => (
              <li key={r.id}>
                <Card className="p-4">
                  <p className="text-sm font-bold">
                    {r.author}{" "}
                    <span className="text-accent" aria-label={`${r.rating} de 5`}>
                      {"★".repeat(r.rating)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">{r.comment}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="related-title">
        <h2 id="related-title" className="mb-3 text-xl font-bold">
          NFTs relacionados
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(related.data ?? []).map((n) => (
            <li key={n.id}>
              <NftCard nft={n} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import NftCard from "../components/NftCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "../components/states";
import { useSession } from "../hooks/useSession";
import { parseError } from "../services/api";
import { fetchFavorites } from "../services/endpoints";

export default function FavoritesPage() {
  const { data: user } = useSession();
  const favorites = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: fetchFavorites,
    enabled: !!user,
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Favoritos</h1>
      {favorites.isLoading && <Skeleton className="h-40 w-full" />}
      {favorites.isError && (
        <ErrorState
          message={parseError(favorites.error).message}
          onRetry={() => favorites.refetch()}
        />
      )}
      {favorites.data && favorites.data.length === 0 && (
        <EmptyState
          title="Nenhum favorito ainda"
          description="Toque no coração de um NFT para acompanhá-lo aqui."
        >
          <Button asChild>
            <Link to="/" search={{}}>
              Explorar catálogo
            </Link>
          </Button>
        </EmptyState>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(favorites.data ?? []).map((nft) => (
          <li key={nft.id}>
            <NftCard nft={nft} />
          </li>
        ))}
      </ul>
    </div>
  );
}

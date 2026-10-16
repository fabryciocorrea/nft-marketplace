import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { HeartIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "../hooks/useSession";
import { parseError } from "../services/api";
import { setFavorite } from "../services/endpoints";
import { toast } from "../services/toast";
import type { NFT, Page } from "../types";

type Snapshot = [readonly unknown[], unknown][];

// Atualização otimista com rollback quando a API falha
export default function FavoriteButton({ nft }: { nft: NFT }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const { data: user } = useSession();

  const mutation = useMutation({
    mutationFn: (liked: boolean) => setFavorite(nft.id, liked),
    onMutate: async (liked) => {
      await queryClient.cancelQueries({ queryKey: ["nfts"] });
      await queryClient.cancelQueries({ queryKey: ["nft", nft.id] });
      const snapshot: Snapshot = [
        ...queryClient.getQueriesData({ queryKey: ["nfts"] }),
        ...queryClient.getQueriesData({ queryKey: ["nft", nft.id] }),
        ...queryClient.getQueriesData({ queryKey: ["favorites"] }),
      ];
      const patch = (n: NFT): NFT =>
        n.id === nft.id
          ? { ...n, isLiked: liked, likes: n.likes + (liked ? 1 : -1) }
          : n;
      queryClient.setQueriesData<Page<NFT>>({ queryKey: ["nfts"] }, (old) =>
        old ? { ...old, items: old.items.map(patch) } : old,
      );
      queryClient.setQueriesData<NFT>({ queryKey: ["nft", nft.id] }, (old) =>
        old ? patch(old) : old,
      );
      return { snapshot };
    },
    onError: (error, _liked, context) => {
      context?.snapshot.forEach(([key, data]) =>
        queryClient.setQueryData(key, data),
      );
      toast.error(
        `Não foi possível atualizar os favoritos: ${parseError(error).message}`,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const onClick = () => {
    if (!user) {
      navigate({ to: "/login", search: { redirect: href } });
      return;
    }
    mutation.mutate(!nft.isLiked);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={nft.isLiked}
      aria-label={
        nft.isLiked
          ? `Remover ${nft.title} dos favoritos`
          : `Favoritar ${nft.title}`
      }
      className={cn(
        "flex h-9 min-w-9 cursor-pointer items-center justify-center gap-1 rounded-full border bg-background/95 px-2.5 text-xs font-semibold shadow-sm transition-colors hover:bg-background",
        nft.isLiked ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <HeartIcon
        aria-hidden="true"
        className={cn("size-4", nft.isLiked && "fill-current")}
      />
      <span>{nft.likes}</span>
    </button>
  );
}

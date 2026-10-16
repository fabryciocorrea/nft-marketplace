import { Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheckIcon, ShoppingCartIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "../hooks/useCart";
import { formatEth } from "../utils/money";
import type { NFT } from "../types";
import FavoriteButton from "./FavoriteButton";

// Card do design: raio 20, borda, sombra, imagem 4:3 com raio interno 16.
export default function NftCard({ nft }: { nft: NFT }) {
  const cart = useCart();
  const navigate = useNavigate();
  const inCart = cart.quantityOf(nft.id);
  const soldOut = nft.availableQuantity < 1;
  const maxed = inCart >= nft.availableQuantity;

  const buyNow = () => {
    if (!soldOut && !maxed) cart.add(nft);
    navigate({ to: "/checkout" });
  };

  return (
    <article
      data-testid={`nft-card-${nft.id}`}
      aria-labelledby={`nft-${nft.id}-title`}
      className="hover-lift flex h-full flex-col rounded-lg border bg-card shadow-card"
    >
      <div className="p-3">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
          <Link to="/nfts/$id" params={{ id: nft.id }} tabIndex={-1}>
            <img
              src={nft.image}
              alt={nft.title}
              loading="lazy"
              className="size-full object-cover"
            />
          </Link>
          <div className="absolute top-2 right-2">
            <FavoriteButton nft={nft} />
          </div>
          {soldOut && (
            <Badge variant="destructive" className="absolute top-2 left-2">
              Esgotado
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="size-5">
            <AvatarImage src={nft.author.avatar} alt="" />
            <AvatarFallback className="text-[10px]">
              {nft.author.name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{nft.author.name}</span>
          {nft.author.verified && (
            <BadgeCheckIcon
              aria-label="Criador verificado"
              className="size-4 text-primary"
            />
          )}
        </div>

        <div>
          <h3 id={`nft-${nft.id}-title`} className="text-lg leading-[26px] font-semibold">
            <Link
              to="/nfts/$id"
              params={{ id: nft.id }}
              className="hover:text-primary"
            >
              {nft.title}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">
            {nft.collection.name} · {nft.category}
          </p>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div>
            <span className="block text-xs font-medium text-muted-foreground">
              Preço
            </span>
            <span className="text-base font-bold">
              {formatEth(nft.priceEth)} ETH
            </span>
          </div>
          <div className="text-right">
            <Badge variant="outline">{nft.network}</Badge>
            <span className="mt-1 block text-xs text-muted-foreground">
              {nft.availableQuantity} disponíveis
            </span>
          </div>
        </div>

        <div className="mt-auto flex gap-2">
          <Button
            className="flex-1"
            disabled={soldOut && inCart === 0}
            onClick={buyNow}
            aria-label={`Comprar ${nft.title} agora`}
          >
            Comprar agora
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={soldOut || maxed || cart.isBusy}
            onClick={() => cart.add(nft)}
            aria-label={`Adicionar ${nft.title} ao carrinho`}
          >
            <ShoppingCartIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  );
}

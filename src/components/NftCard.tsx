import { Link } from "@tanstack/react-router";
import { useCart } from "../hooks/useCart";
import { formatEth } from "../utils/money";
import type { NFT } from "../types";
import FavoriteButton from "./FavoriteButton";
import { Button } from "./ui/button";
import { Badge, Card } from "./ui/misc";

export default function NftCard({ nft }: { nft: NFT }) {
  const cart = useCart();
  const inCart = cart.quantityOf(nft.id);
  const soldOut = nft.availableQuantity < 1;
  const maxed = inCart >= nft.availableQuantity;

  return (
    <Card
      data-testid={`nft-card-${nft.id}`}
      className="flex flex-col overflow-hidden"
    >
      <article className="flex h-full flex-col" aria-labelledby={`nft-${nft.id}-title`}>
        <div className="relative">
          <Link to="/nfts/$id" params={{ id: nft.id }} tabIndex={-1}>
            <img
              src={nft.image}
              alt={nft.title}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
          </Link>
          <div className="absolute right-2 top-2">
            <FavoriteButton nft={nft} />
          </div>
          {soldOut && (
            <span className="absolute left-2 top-2 rounded bg-ink/90 px-2 py-0.5 text-xs font-bold text-danger">
              Esgotado
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{nft.network}</Badge>
            <Badge>{nft.category}</Badge>
          </div>
          <h3 id={`nft-${nft.id}-title`} className="text-base font-bold">
            <Link
              to="/nfts/$id"
              params={{ id: nft.id }}
              className="hover:text-accent"
            >
              {nft.title}
            </Link>
          </h3>
          <p className="text-xs text-muted">{nft.collection.name}</p>

          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div>
              <span className="block text-[10px] text-secondary">Preço</span>
              <span className="font-bold text-accent">
                {formatEth(nft.priceEth)} ETH
              </span>
              <span className="block text-[10px] text-secondary">
                {nft.availableQuantity} disponíveis
              </span>
            </div>
            <Button
              size="sm"
              disabled={soldOut || maxed || cart.isBusy}
              onClick={() => cart.add(nft)}
              aria-label={`Adicionar ${nft.title} ao carrinho`}
            >
              {soldOut ? "Esgotado" : maxed ? "No carrinho" : "Adicionar"}
            </Button>
          </div>
        </div>
      </article>
    </Card>
  );
}

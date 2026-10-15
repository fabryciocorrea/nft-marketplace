import Decimal from "decimal.js";
import type { CartItem } from "../types";

export function lineTotal(item: CartItem) {
  return new Decimal(item.nft.priceEth).times(item.quantity);
}

export function cartSubtotal(items: CartItem[]) {
  return items.reduce(
    (total, item) => total.plus(lineTotal(item)),
    new Decimal(0),
  );
}

export function formatEth(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(6).toFixed();
}

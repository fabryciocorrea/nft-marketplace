import Decimal from "decimal.js";

// Valores em ETH são strings decimais; nunca usamos Number para somar.
export function formatEth(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(6).toFixed();
}

export function lineTotal(priceEth: string, quantity: number) {
  return new Decimal(priceEth).times(quantity);
}

export function sum(values: Decimal.Value[]) {
  return values.reduce<Decimal>((t, v) => t.plus(v), new Decimal(0));
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function applyMarkup(factoryPrice: number, markupPct: number): number {
  return factoryPrice * (1 + markupPct / 100);
}

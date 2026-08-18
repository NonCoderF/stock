export function updatePaperMarkToMarket({
  account,
  currentPrice
}) {
  const position = account.openPosition;

  if (!position) {
    account.unrealizedPnl = 0;
    account.equity = account.cash;
    return account;
  }

  const price = Number(currentPrice);

  if (!Number.isFinite(price) || price <= 0) {
    return account;
  }

  position.currentPrice = price;
  position.marketValue = position.quantity * price;
  position.unrealizedPnl = (price - position.entryPrice) * position.quantity;
  account.unrealizedPnl = position.unrealizedPnl;
  account.equity = account.cash + position.marketValue;
  account.updatedAt = new Date().toISOString();

  return account;
}

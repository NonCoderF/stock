const STORAGE_PAPER_ACCOUNT = "market-war-room:paper-account:v1";

export function createPaperAccount(initialCapital) {
  const capital = Number(initialCapital);

  return {
    version: 1,
    initialCapital: Number.isFinite(capital) ? capital : 0,
    cash: Number.isFinite(capital) ? capital : 0,
    equity: Number.isFinite(capital) ? capital : 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    openPosition: null,
    trades: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function restorePaperAccount() {
  try {
    const raw = localStorage.getItem(STORAGE_PAPER_ACCOUNT);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return null;

    return {
      ...parsed,
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
      openPosition: parsed.openPosition || null
    };
  } catch (error) {
    console.warn("Unable to restore paper account.", error);
    return null;
  }
}

export function persistPaperAccount(account) {
  if (!account) return;

  try {
    account.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_PAPER_ACCOUNT, JSON.stringify(account));
  } catch (error) {
    console.warn("Unable to persist paper account.", error);
  }
}

export function resetPaperAccount(initialCapital) {
  const account = createPaperAccount(initialCapital);
  persistPaperAccount(account);
  return account;
}

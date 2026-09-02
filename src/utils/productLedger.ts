import { KlabinDatabase, ProdutoRecord } from '../types';
import { getFreightRecords } from './freightUtils';

/**
 * Per-product reconciliation of the two ledgers the app keeps separately:
 * wood bought (Cargas) and wood sold (Vendas).
 *
 * Quantities on both sides are treated as tonnes. Purchases already store
 * `quantityTons`; sales store a bare `quantity` whose `unitOfMeasure` is free
 * text, so a product whose catalogue unit is not "ton" is flagged through
 * `unitMismatch` rather than silently mixed into the totals.
 */
export interface ProductLedgerEntry {
  productId?: string;
  productName: string;
  unitOfMeasure: string;
  /** The catalogue unit is not tonnes, so these figures mix units. */
  unitMismatch: boolean;

  tonsBought: number;
  purchaseCost: number;
  /** Freight paid to bring the wood in — part of what the stock cost. */
  freightInbound: number;
  /** purchaseCost + freightInbound. */
  landedCost: number;
  /** landedCost / tonsBought. Zero when nothing was bought. */
  avgCostPerTon: number;

  tonsSold: number;
  salesRevenue: number;
  /** salesRevenue / tonsSold. Zero when nothing was sold. */
  avgPricePerTon: number;
  /** Freight paid to deliver to the client — a selling expense, not stock cost. */
  freightOutbound: number;

  /** tonsSold × avgCostPerTon — weighted average, see the note below. */
  costOfGoodsSold: number;
  /** salesRevenue − costOfGoodsSold − freightOutbound. */
  grossMargin: number;
  /** grossMargin / tonsSold. Zero when nothing was sold. */
  marginPerTon: number;

  /** tonsBought − tonsSold. Negative means more was sold than ever bought. */
  stockTons: number;
  /** stockTons × avgCostPerTon. */
  stockValue: number;
}

export interface ProductLedgerTotals {
  tonsBought: number;
  tonsSold: number;
  purchaseCost: number;
  salesRevenue: number;
  freightInbound: number;
  freightOutbound: number;
  costOfGoodsSold: number;
  grossMargin: number;
  stockTons: number;
  stockValue: number;
  /** True when any product mixes units, so the UI can qualify the totals. */
  hasUnitMismatch: boolean;
}

/** Same normalization `sanitizeDatabase` uses to match a product by name. */
function normalizeProductName(name?: string): string {
  return String(name || '').toLowerCase().trim();
}

const divide = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : 0;

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface Accumulator extends ProductLedgerEntry {
  /** Preserves catalogue order so listing is stable when values tie. */
  order: number;
}

/**
 * Builds the per-product ledger.
 *
 * **The margin is an estimate.** A sale carries no reference to the load it
 * came from — `VendaRecord` has no `cargaId` and there is no lot concept — so
 * the cost of what was sold can only be derived from the weighted average
 * landed cost of everything bought for that product. With stable purchase
 * prices this tracks reality closely; across a sharp price swing it lags.
 */
export function getProductLedger(database: KlabinDatabase): ProductLedgerEntry[] {
  const produtos = database.Produtos || [];
  const cargas = database.Cargas || [];
  const vendas = database.Vendas || [];

  const entries = new Map<string, Accumulator>();
  const keyByName = new Map<string, string>();
  let nextOrder = 0;

  const registerCatalogue = (produto: ProdutoRecord) => {
    const key = produto.id || normalizeProductName(produto.name);
    const unitOfMeasure = (produto.unitOfMeasure || 'ton').trim();
    entries.set(key, blankEntry(key, produto.name, unitOfMeasure, nextOrder++, produto.id));
    keyByName.set(normalizeProductName(produto.name), key);
  };

  produtos.forEach(registerCatalogue);

  /**
   * Resolves a movement to a ledger row. A product that was transacted but is
   * not (or no longer) in the catalogue still gets a row — dropping it would
   * hide real tonnage and real money.
   */
  const resolve = (productId?: string, productName?: string): Accumulator => {
    const normalized = normalizeProductName(productName);
    const key =
      (productId && entries.has(productId) ? productId : undefined) ||
      keyByName.get(normalized) ||
      productId ||
      normalized ||
      'sem-produto';

    let entry = entries.get(key);
    if (!entry) {
      entry = blankEntry(key, productName || 'Sem produto', 'ton', nextOrder++, productId);
      entries.set(key, entry);
      if (normalized) keyByName.set(normalized, key);
    }
    return entry;
  };

  cargas.forEach((carga) => {
    const entry = resolve(carga.productId, carga.product);
    entry.tonsBought += toNumber(carga.quantityTons);
    entry.purchaseCost += toNumber(carga.totalValue);
  });

  vendas.forEach((venda) => {
    // A cancelled sale never happened: it must not consume stock or book margin.
    if (venda.status === 'CANCELLED') return;
    const entry = resolve(venda.productId, venda.product);
    entry.tonsSold += toNumber(venda.quantity);
    entry.salesRevenue += toNumber(venda.totalValue);
  });

  // Freight comes from the shared unifier so the numbers match the Motoristas
  // screen and the freight PDF, including the `freightCost ?? tons × rate`
  // fallback and the opt-out/opt-in defaults per record type.
  getFreightRecords({
    Cargas: cargas,
    Vendas: vendas,
    Motoristas: database.Motoristas || [],
    appSettings: database.appSettings,
  }).forEach((freight) => {
    const original = freight.originalRecord as { productId?: string; status?: string };
    if (freight.type === 'VENDA' && original.status === 'CANCELLED') return;
    const entry = resolve(original.productId, freight.product);
    if (freight.type === 'CARGA') {
      entry.freightInbound += toNumber(freight.freightCost);
    } else {
      entry.freightOutbound += toNumber(freight.freightCost);
    }
  });

  return Array.from(entries.values())
    .map(finalize)
    .sort((a, b) => b.tonsBought - a.tonsBought || b.tonsSold - a.tonsSold);
}

function blankEntry(
  _key: string,
  productName: string,
  unitOfMeasure: string,
  order: number,
  productId?: string
): Accumulator {
  return {
    productId,
    productName,
    unitOfMeasure,
    unitMismatch: false,
    tonsBought: 0,
    purchaseCost: 0,
    freightInbound: 0,
    landedCost: 0,
    avgCostPerTon: 0,
    tonsSold: 0,
    salesRevenue: 0,
    avgPricePerTon: 0,
    freightOutbound: 0,
    costOfGoodsSold: 0,
    grossMargin: 0,
    marginPerTon: 0,
    stockTons: 0,
    stockValue: 0,
    order,
  };
}

function finalize(entry: Accumulator): ProductLedgerEntry {
  const landedCost = entry.purchaseCost + entry.freightInbound;
  const avgCostPerTon = divide(landedCost, entry.tonsBought);
  const costOfGoodsSold = entry.tonsSold * avgCostPerTon;
  const grossMargin = entry.salesRevenue - costOfGoodsSold - entry.freightOutbound;
  const stockTons = entry.tonsBought - entry.tonsSold;

  const { order: _order, ...rest } = entry;
  return {
    ...rest,
    unitMismatch: normalizeProductName(entry.unitOfMeasure) !== 'ton',
    landedCost,
    avgCostPerTon,
    avgPricePerTon: divide(entry.salesRevenue, entry.tonsSold),
    costOfGoodsSold,
    grossMargin,
    marginPerTon: divide(grossMargin, entry.tonsSold),
    stockTons,
    stockValue: stockTons * avgCostPerTon,
  };
}

export function getLedgerTotals(entries: ProductLedgerEntry[]): ProductLedgerTotals {
  return entries.reduce<ProductLedgerTotals>(
    (totals, entry) => ({
      tonsBought: totals.tonsBought + entry.tonsBought,
      tonsSold: totals.tonsSold + entry.tonsSold,
      purchaseCost: totals.purchaseCost + entry.purchaseCost,
      salesRevenue: totals.salesRevenue + entry.salesRevenue,
      freightInbound: totals.freightInbound + entry.freightInbound,
      freightOutbound: totals.freightOutbound + entry.freightOutbound,
      costOfGoodsSold: totals.costOfGoodsSold + entry.costOfGoodsSold,
      grossMargin: totals.grossMargin + entry.grossMargin,
      stockTons: totals.stockTons + entry.stockTons,
      stockValue: totals.stockValue + entry.stockValue,
      hasUnitMismatch: totals.hasUnitMismatch || entry.unitMismatch,
    }),
    {
      tonsBought: 0,
      tonsSold: 0,
      purchaseCost: 0,
      salesRevenue: 0,
      freightInbound: 0,
      freightOutbound: 0,
      costOfGoodsSold: 0,
      grossMargin: 0,
      stockTons: 0,
      stockValue: 0,
      hasUnitMismatch: false,
    }
  );
}

/** Available tonnage of one product, for the stock warning on the sale form. */
export function getAvailableStock(
  entries: ProductLedgerEntry[],
  productId?: string,
  productName?: string
): ProductLedgerEntry | undefined {
  const normalized = normalizeProductName(productName);
  return entries.find(
    (entry) =>
      (productId && entry.productId === productId) ||
      (!!normalized && normalizeProductName(entry.productName) === normalized)
  );
}

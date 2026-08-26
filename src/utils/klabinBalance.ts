import { CargaRecord, DepositoKlabinRecord } from '../types';

/**
 * Single source of truth for the Klabin balance: depósitos recebidos - cargas abatidas.
 *
 * The pieces are exposed separately because some views compute only one half over a
 * search-filtered subset (TableCargas, TableDepositos) rather than the whole database.
 *
 * Note: `sanitizeDatabase` normalizes `deductFromBalance` to a real boolean before any
 * of these run, so in practice only the `=== true` branch fires. The `'YES'` branch is
 * kept to match the behavior of the call sites this replaced.
 */
export function isDeductedFromBalance(carga: CargaRecord): boolean {
  return carga.deductFromBalance === 'YES' || (carga.deductFromBalance as any) === true;
}

/** Sum of `totalValue` over the cargas that are deducted from the Klabin balance. */
export function sumDeductedFromBalance(cargas: CargaRecord[]): number {
  return (cargas || [])
    .filter(isDeductedFromBalance)
    .reduce((acc, c) => acc + (Number(c.totalValue) || 0), 0);
}

/** Sum of `value` over deposit records. */
export function sumDepositos(depositos: DepositoKlabinRecord[]): number {
  return (depositos || []).reduce((acc, d) => acc + (Number(d.value) || 0), 0);
}

export interface KlabinBalance {
  totalDepositos: number;
  totalAbatido: number;
  saldo: number;
}

/**
 * Full balance. Values are returned unrounded — callers round only for display.
 */
export function calcKlabinBalance(input: {
  cargas: CargaRecord[];
  depositos: DepositoKlabinRecord[];
}): KlabinBalance {
  const totalDepositos = sumDepositos(input.depositos);
  const totalAbatido = sumDeductedFromBalance(input.cargas);
  return {
    totalDepositos,
    totalAbatido,
    saldo: totalDepositos - totalAbatido,
  };
}

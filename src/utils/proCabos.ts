import { CargaRecord } from '../types';

/** Tarifa vigente de mão de obra da Pro Cabos (R$/t), copiada para a carga no momento da marcação. */
export const PRO_CABOS_LABOR_RATE_PER_TON = 115;

type ProCabosFields = Pick<CargaRecord, 'quantityTons' | 'valuePerTon' | 'proCabos' | 'proCabosLaborRatePerTon'>;

export function isProCabosCarga(carga: { proCabos?: unknown } | null | undefined): boolean {
  const flag = carga?.proCabos;
  return flag === true || flag === 'YES' || flag === 'SIM';
}

/**
 * Tarifa registrada na própria carga. O fallback para a tarifa vigente só cobre
 * registros sem tarifa gravada; `sanitizeDatabase` fixa o valor na primeira leitura.
 */
export function getProCabosLaborRate(carga: { proCabosLaborRatePerTon?: unknown } | null | undefined): number {
  const rate = Number(carga?.proCabosLaborRatePerTon);
  return Number.isFinite(rate) && rate > 0 ? rate : PRO_CABOS_LABOR_RATE_PER_TON;
}

// `toPrecision` desfaz o resíduo binário antes de arredondar (4308,745 vira 4308,75, não 4308,74).
function roundCents(value: number): number {
  return Math.round(parseFloat((value * 100).toPrecision(12))) / 100;
}

/** Valor devido pela Pro Cabos: toneladas × (valor unitário Klabin + mão de obra). Zero se a carga não for Pro Cabos. */
export function calcProCabosAmountDue(carga: ProCabosFields): number {
  if (!isProCabosCarga(carga)) return 0;
  const tons = Number(carga.quantityTons) || 0;
  const valuePerTon = Number(carga.valuePerTon) || 0;
  return roundCents(tons * (valuePerTon + getProCabosLaborRate(carga)));
}

/**
 * Projeção das cargas Klabin marcadas como Pro Cabos. Não há cadastro próprio:
 * editar ou excluir a carga original se reflete aqui no próximo cálculo.
 */
export function getProCabosCargas(cargas: CargaRecord[]): CargaRecord[] {
  return (cargas || []).filter(isProCabosCarga);
}

export function isProCabosPaid(carga: { proCabosStatus?: unknown } | null | undefined): boolean {
  return carga?.proCabosStatus === 'PAID';
}

/** Cargas Pro Cabos separadas entre em aberto e quitadas. */
export function splitProCabosCargas(cargas: CargaRecord[]): { open: CargaRecord[]; paid: CargaRecord[] } {
  const open: CargaRecord[] = [];
  const paid: CargaRecord[] = [];
  getProCabosCargas(cargas).forEach((c) => (isProCabosPaid(c) ? paid : open).push(c));
  return { open, paid };
}

/** "Saldo Devedor Pro Cabos": soma do valor devido das cargas Pro Cabos ainda em aberto. */
export function calcProCabosOutstanding(cargas: CargaRecord[]): number {
  return sumProCabosAmountDue(splitProCabosCargas(cargas).open);
}

export function sumProCabosAmountDue(cargas: CargaRecord[]): number {
  const total = getProCabosCargas(cargas).reduce((acc, c) => acc + calcProCabosAmountDue(c), 0);
  return roundCents(total);
}

import { describe, expect, it } from 'vitest';
import { regressionDatabase } from './fixtures/regressionDatabase';
import { mergeAppSettings } from '../utils/settings/mergeAppSettings';
import { sanitizeDatabase } from '../utils/storage';

const withFreight = (freight: Record<string, unknown> | undefined) => {
  const raw: any = regressionDatabase();
  raw.appSettings.freight = freight;
  return sanitizeDatabase(raw).appSettings!;
};

describe('configuração legada "frete a pagar por padrão em cargas"', () => {
  it('não é mais criada quando o banco não a tem', () => {
    expect(withFreight(undefined).freight).toEqual({ defaultSaleFreightPayable: false });
    expect(mergeAppSettings(undefined, {}).freight).toEqual({ defaultSaleFreightPayable: false });
  });

  it('valor já gravado é mantido como está, sem migração', () => {
    expect(withFreight({ defaultCargoFreightPayable: false, defaultSaleFreightPayable: true }).freight).toEqual({
      defaultCargoFreightPayable: false,
      defaultSaleFreightPayable: true,
    });
    expect(withFreight({ defaultCargoFreightPayable: true }).freight).toEqual({
      defaultCargoFreightPayable: true,
      defaultSaleFreightPayable: false,
    });
  });

  it('salvar as preferências de frete não apaga o valor legado nem perde o padrão de vendas', () => {
    const current = withFreight({ defaultCargoFreightPayable: false, defaultSaleFreightPayable: false });
    const merged = mergeAppSettings(current, { freightRatePerTon: 20, freight: { defaultSaleFreightPayable: true } });
    expect(merged.freightRatePerTon).toBe(20);
    expect(merged.freight).toEqual({ defaultCargoFreightPayable: false, defaultSaleFreightPayable: true });
  });

  it('a tarifa de frete e as cargas existentes não mudam com ou sem o valor legado', () => {
    const base = sanitizeDatabase(regressionDatabase());
    const raw: any = regressionDatabase();
    raw.appSettings.freight = { defaultCargoFreightPayable: false };
    const legacy = sanitizeDatabase(raw);
    expect(legacy.Cargas).toEqual(base.Cargas);
    expect(legacy.appSettings!.freightRatePerTon).toBe(base.appSettings!.freightRatePerTon);
  });
});

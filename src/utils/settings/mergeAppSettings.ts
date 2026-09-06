import type { AppSettings } from '../../types';

/** Shared merge policy; callers retain their own local or captured settings input. */
export function mergeAppSettings(settings: AppSettings | undefined, newSettingsPartial: Partial<AppSettings>): AppSettings {
  return {
    freightRatePerTon: newSettingsPartial.freightRatePerTon !== undefined
      ? newSettingsPartial.freightRatePerTon
      : (settings?.freightRatePerTon || 15),
    company: {
      name: 'Madeireira Sol Nascente',
      ...(settings?.company || {}),
      ...(newSettingsPartial.company || {}),
    },
    klabin: {
      defaultDeductFromBalance: true,
      ...(settings?.klabin || {}),
      ...(newSettingsPartial.klabin || {}),
    },
    freight: {
      defaultCargoFreightPayable: true,
      defaultSaleFreightPayable: false,
      ...(settings?.freight || {}),
      ...(newSettingsPartial.freight || {}),
    },
    cycles: {
      lockedMonths: [],
      ...(settings?.cycles || {}),
      ...(newSettingsPartial.cycles || {}),
    },
    companyName:
      newSettingsPartial.company?.name ||
      newSettingsPartial.companyName ||
      settings?.company?.name ||
      settings?.companyName ||
      'Madeireira Sol Nascente',
  };
}

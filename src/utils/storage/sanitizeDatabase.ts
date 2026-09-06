import { AppSettings, KlabinDatabase } from '../../types';
import { normalizeIsoDate, normalizeIsoTimestamp } from '../formatters';

/**
 * Sanitizes the database object by removing corrupt/phantom entries from Cargas, Depositos, Clientes, Vendas, Produtos
 */
export function sanitizeDatabase(rawDb: any): KlabinDatabase {
  if (!rawDb || typeof rawDb !== 'object') {
    return {
      Cargas: [],
      Depositos_Klabin: [],
      Frete: [],
      Clientes: [],
      Vendas: [],
      Produtos: [],
      Motoristas: [],
    };
  }

  // 1. Sanitize & Normalize Produtos first so we have the products lookup map
  const rawProdutos = Array.isArray(rawDb.Produtos) ? rawDb.Produtos : [];
  const cleanProdutos = rawProdutos.filter((p: any) => {
    if (!p || typeof p !== 'object') return false;
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    const price = Number(p.referencePrice);
    return Boolean(name) && !isNaN(price);
  });

  // Map product names to IDs for fast lookup
  const productNameToIdMap = new Map<string, string>();
  cleanProdutos.forEach((p: any) => {
    if (p.id && p.name) {
      productNameToIdMap.set(p.name.toLowerCase().trim(), p.id);
    }
  });

  // 2. Sanitize & Normalize Clientes
  const rawClientes = Array.isArray(rawDb.Clientes) ? rawDb.Clientes : [];
  const cleanClientes = rawClientes.filter((cli: any) => {
    if (!cli || typeof cli !== 'object') return false;
    const name = typeof cli.name === 'string' ? cli.name.trim() : '';
    return Boolean(name);
  });

  // Map client names to IDs for fast lookup
  const clientNameToIdMap = new Map<string, string>();
  cleanClientes.forEach((cli: any) => {
    if (cli.id && cli.name) {
      clientNameToIdMap.set(cli.name.toLowerCase().trim(), cli.id);
    }
  });

  // 2b. Sanitize & Normalize Motoristas
  const rawMotoristas = Array.isArray(rawDb.Motoristas) ? rawDb.Motoristas : [];
  const cleanMotoristas = rawMotoristas
    .filter((m: any) => {
      if (!m || typeof m !== 'object') return false;
      const name = typeof m.name === 'string' ? m.name.trim() : '';
      const licensePlate = typeof m.licensePlate === 'string' ? m.licensePlate.trim() : '';
      return Boolean(name) || Boolean(licensePlate);
    })
    .map((m: any) => ({
      ...m,
      name: (m.name || '').trim(),
      licensePlate: (m.licensePlate || '').trim().toUpperCase(),
      trailerPlate: m.trailerPlate ? String(m.trailerPlate).trim().toUpperCase() : undefined,
      phone: m.phone ? String(m.phone).trim() : undefined,
      status: m.status === 'INACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const),
      createdAt: normalizeIsoTimestamp(m.createdAt || new Date().toISOString()),
    }));

  // Map motorista plates and names to IDs
  const motoristaMap = new Map<string, string>();
  cleanMotoristas.forEach((m: any) => {
    if (m.id) {
      if (m.licensePlate) motoristaMap.set(m.licensePlate.toLowerCase(), m.id);
      if (m.name) motoristaMap.set(m.name.toLowerCase(), m.id);
    }
  });

  // 3. Sanitize & Normalize Cargas
  const rawCargas = Array.isArray(rawDb.Cargas) ? rawDb.Cargas : [];
  const cleanCargas = rawCargas
    .filter((c: any) => {
      if (!c || typeof c !== 'object') return false;
      const supplier = typeof c.supplier === 'string' ? c.supplier.trim() : '';
      const invoiceNumber = typeof c.invoiceNumber === 'string' ? c.invoiceNumber.trim() : '';
      const product = typeof c.product === 'string' ? c.product.trim() : '';
      const quantityTons = Number(c.quantityTons);
      const valuePerTon = Number(c.valuePerTon);

      // Product and positive numeric values are mandatory
      if (!product) return false;
      if (isNaN(quantityTons) || quantityTons <= 0) return false;
      if (isNaN(valuePerTon) || valuePerTon <= 0) return false;

      // PURGE MOCK/TEST ENTRIES (e.g., "XXX", "00000", "00", "TEST", "TESTE")
      const supplierUpper = supplier ? supplier.toUpperCase() : '';
      const invoiceUpper = invoiceNumber ? invoiceNumber.toUpperCase() : '';

      const invalidInvoices = ['XXX', '00', '000', '0000', '00000', 'TEST', 'TESTE'];
      const invalidSuppliers = ['00', '0', '000', 'TEST', 'TESTE'];

      if (invoiceUpper && (invalidInvoices.includes(invoiceUpper) || /^0+$/.test(invoiceUpper))) return false;
      if (supplierUpper && (invalidSuppliers.includes(supplierUpper) || /^0+$/.test(supplierUpper))) return false;

      return true;
    })
    .map((c: any) => {
      const supplier = typeof c.supplier === 'string' && c.supplier.trim() ? c.supplier.trim() : 'Klabin';
      const invoiceNumber = typeof c.invoiceNumber === 'string' && c.invoiceNumber.trim() ? c.invoiceNumber.trim() : undefined;
      const quantityTons = Number(c.quantityTons) || 0;
      const valuePerTon = Number(c.valuePerTon) || 0;
      const totalValue = c.totalValue !== undefined && !isNaN(Number(c.totalValue)) && Number(c.totalValue) > 0
        ? Number(c.totalValue)
        : Number((quantityTons * valuePerTon).toFixed(2));

      // Convert deductFromBalance to normalized boolean (default to true)
      const deductBool =
        c.deductFromBalance === true ||
        c.deductFromBalance === 'YES' ||
        c.deductFromBalance === 'SIM' ||
        c.deductFromBalance === undefined;

      // Convert freightPayable to normalized boolean (default to true)
      const freightBool =
        c.freightPayable === true ||
        c.freightPayable === 'YES' ||
        c.freightPayable === 'SIM' ||
        c.freightPayable === undefined;

      // Standardize freightStatus enum
      const freightStatus = c.freightStatus === 'PAID' ? 'PAID' : 'PENDING';

      // Attach relational productId if available, or try name match with fallback aliases
      let productId = typeof c.productId === 'string' ? c.productId.trim() : '';
      if (!productId && c.product) {
        const pNorm = String(c.product).toLowerCase().trim();
        productId = productNameToIdMap.get(pNorm) || '';
        if (!productId) {
          if (pNorm.includes('eucalipto')) productId = productNameToIdMap.get('tora de eucalipto') || productNameToIdMap.get('eucalipto') || productNameToIdMap.get('tora eucalipto') || '';
          if (pNorm.includes('pinus')) productId = productNameToIdMap.get('tora de pinus') || productNameToIdMap.get('pinus taeda') || productNameToIdMap.get('pinus') || '';
          if (pNorm.includes('cavaco')) productId = productNameToIdMap.get('cavaco de madeira') || productNameToIdMap.get('cavaco') || '';
        }
      }

      // Freight cost fallback enforcement
      let freightCost = c.freightCost !== undefined && c.freightCost !== null ? Number(c.freightCost) : NaN;
      if (isNaN(freightCost)) {
        const rate = Number(rawDb?.appSettings?.freightRatePerTon) || 15;
        freightCost = freightBool ? Number((quantityTons * rate).toFixed(2)) : 0;
      }

      // Relational driverId resolution
      let driverId = typeof c.driverId === 'string' ? c.driverId.trim() : (typeof c.motoristaId === 'string' ? c.motoristaId.trim() : '');
      if (!driverId && (c.driverPlate || c.licensePlate)) {
        const plateNorm = (c.licensePlate || '').trim().toLowerCase();
        const driverNorm = (c.driverPlate || '').trim().toLowerCase();
        if (plateNorm && motoristaMap.has(plateNorm)) {
          driverId = motoristaMap.get(plateNorm)!;
        } else if (driverNorm && motoristaMap.has(driverNorm)) {
          driverId = motoristaMap.get(driverNorm)!;
        } else if (driverNorm) {
          cleanMotoristas.forEach((m: any) => {
            if (!driverId && m.id) {
              if (m.licensePlate && driverNorm.includes(m.licensePlate.toLowerCase())) driverId = m.id;
              if (!driverId && m.name && driverNorm.includes(m.name.toLowerCase())) driverId = m.id;
            }
          });
        }
      }

      // Normalize ISO dates
      const date = normalizeIsoDate(c.date);
      const createdAt = normalizeIsoTimestamp(c.createdAt || date);
      const freightPaidAt = c.freightPaidAt ? normalizeIsoTimestamp(c.freightPaidAt) : undefined;

      return {
        ...c,
        supplier,
        invoiceNumber,
        product: String(c.product).trim(),
        quantityTons,
        valuePerTon,
        totalValue,
        date,
        productId: productId || undefined,
        driverId: driverId || undefined,
        motoristaId: driverId || undefined,
        deductFromBalance: deductBool ? true : false,
        freightPayable: freightBool ? true : false,
        freightCost,
        freightStatus,
        freightPaidAt,
        createdAt,
      };
    });

  // 4. Sanitize Depositos_Klabin
  const rawDepositos = Array.isArray(rawDb.Depositos_Klabin) ? rawDb.Depositos_Klabin : [];
  const cleanDepositos = rawDepositos
    .filter((d: any) => {
      if (!d || typeof d !== 'object') return false;
      const val = Number(d.value);
      return !isNaN(val) && val > 0 && Boolean(d.date);
    })
    .map((d: any) => {
      const date = normalizeIsoDate(d.date);
      const createdAt = normalizeIsoTimestamp(d.createdAt || date);

      return {
        ...d,
        date,
        createdAt,
      };
    });

  // 5. Sanitize & Normalize Vendas
  const rawVendas = Array.isArray(rawDb.Vendas) ? rawDb.Vendas : [];
  const cleanVendas = rawVendas
    .filter((v: any) => {
      if (!v || typeof v !== 'object') return false;
      const qty = Number(v.quantity);
      const clientName = typeof v.clientName === 'string' ? v.clientName.trim() : '';
      const clientId = typeof v.clientId === 'string' ? v.clientId.trim() : '';
      return !isNaN(qty) && qty > 0 && (Boolean(clientName) || Boolean(clientId));
    })
    .map((v: any) => {
      // Attach relational clientId if missing
      let clientId = typeof v.clientId === 'string' ? v.clientId.trim() : '';
      const clientName = typeof v.clientName === 'string' ? v.clientName.trim() : '';

      if (!clientId && clientName) {
        clientId = clientNameToIdMap.get(clientName.toLowerCase().trim()) || '';
      }

      // Attach relational productId if missing
      let productId = typeof v.productId === 'string' ? v.productId.trim() : '';
      const prodName = typeof v.product === 'string' ? v.product.trim() : '';
      if (!productId && prodName) {
        productId = productNameToIdMap.get(prodName.toLowerCase().trim()) || '';
      }

      // Standardize status enum ("PENDING" | "PAID" | "CANCELLED")
      let status: 'PENDING' | 'PAID' | 'CANCELLED' = 'PENDING';
      if (v.status === 'PAID') status = 'PAID';
      else if (v.status === 'CANCELLED') status = 'CANCELLED';

      const date = normalizeIsoDate(v.date);
      const createdAt = normalizeIsoTimestamp(v.createdAt || date);
      const paidAt = v.paidAt ? normalizeIsoTimestamp(v.paidAt) : undefined;

      return {
        ...v,
        date,
        clientId: clientId || undefined,
        productId: productId || undefined,
        status,
        paidAt,
        createdAt,
      };
    });

  const customLogo = typeof rawDb?.customLogo === 'string' && rawDb.customLogo.trim() ? rawDb.customLogo : undefined;

  const rawRate = Number(rawDb?.appSettings?.freightRatePerTon);
  const rawCompany = rawDb?.appSettings?.company;
  const legacyCompanyName = typeof rawDb?.appSettings?.companyName === 'string' && rawDb.appSettings.companyName.trim()
    ? rawDb.appSettings.companyName.trim()
    : '';

  const companyName = (typeof rawCompany?.name === 'string' && rawCompany.name.trim())
    ? rawCompany.name.trim()
    : (legacyCompanyName || 'Madeireira Sol Nascente');

  const companyCnpj = typeof rawCompany?.cnpj === 'string' && rawCompany.cnpj.trim()
    ? rawCompany.cnpj.trim()
    : undefined;

  const companyCity = typeof rawCompany?.city === 'string' && rawCompany.city.trim()
    ? rawCompany.city.trim()
    : undefined;

  const companyState = typeof rawCompany?.state === 'string' && rawCompany.state.trim()
    ? rawCompany.state.trim().toUpperCase()
    : undefined;

  const rawKlabin = rawDb?.appSettings?.klabin;
  const defaultDeductFromBalance = rawKlabin?.defaultDeductFromBalance !== undefined
    ? Boolean(rawKlabin.defaultDeductFromBalance)
    : true;

  const rawFreight = rawDb?.appSettings?.freight;
  const defaultCargoFreightPayable = rawFreight?.defaultCargoFreightPayable !== undefined
    ? Boolean(rawFreight.defaultCargoFreightPayable)
    : true;
  const defaultSaleFreightPayable = rawFreight?.defaultSaleFreightPayable !== undefined
    ? Boolean(rawFreight.defaultSaleFreightPayable)
    : false;

  const rawCycles = rawDb?.appSettings?.cycles;
  let lockedMonths: string[] = Array.isArray(rawCycles?.lockedMonths)
    ? rawCycles.lockedMonths.filter((m: any) => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m))
    : [];

  // Migration from legacy localStorage key if lockedMonths is empty
  if (lockedMonths.length === 0 && typeof window !== 'undefined') {
    try {
      const legacyLocked = localStorage.getItem('klabin_locked_months');
      if (legacyLocked) {
        const parsed = JSON.parse(legacyLocked);
        if (Array.isArray(parsed) && parsed.length > 0) {
          lockedMonths = parsed.filter((m: any) => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m));
        }
      }
    } catch {
      // ignore
    }
  }

  const appSettings: AppSettings = {
    freightRatePerTon: !isNaN(rawRate) && rawRate > 0 ? rawRate : 15,
    company: {
      name: companyName,
      cnpj: companyCnpj,
      city: companyCity,
      state: companyState,
    },
    klabin: {
      defaultDeductFromBalance,
    },
    freight: {
      defaultCargoFreightPayable,
      defaultSaleFreightPayable,
    },
    cycles: {
      lockedMonths,
    },
    companyName,
  };

  // An empty Motoristas array is a completely valid state and MUST NOT be replaced with initial demo data!
  const finalMotoristas = cleanMotoristas;

  return {
    customLogo,
    appSettings,
    Cargas: cleanCargas,
    Depositos_Klabin: cleanDepositos,
    Frete: Array.isArray(rawDb?.Frete) ? rawDb.Frete : [],
    Clientes: cleanClientes,
    Vendas: cleanVendas,
    Produtos: cleanProdutos,
    Motoristas: finalMotoristas,
  };
}

/**
 * Validates imported backup JSON schema and initializes missing entity arrays gracefully as []
 */

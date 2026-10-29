export type TableType =
  | 'Dashboard'
  | 'Klabin'
  | 'MaoDeObra'
  | 'ProCabos'
  | 'Clientes_Produtos'
  | 'Motoristas'
  | 'Historico'
  | 'Configuracoes'
  | 'Cargas'
  | 'Depositos_Klabin'
  | 'Gestao_Clientes'
  | 'Vendas'
  | 'Produtos'
  | 'Resumo'
  | 'Caixa'
  | 'Frete';

/**
 * PDF anexado a uma carga. Vive somente neste computador (pasta de dados do aplicativo) e NÃO
 * faz parte de `CargaRecord`: não entra no banco local, no Firestore nem nos backups JSON.
 */
export interface CargaAttachment {
  id: string;
  fileName: string;
  sizeBytes: number;
  addedAt: string;
}

export interface CargaRecord {
  id: string;
  date: string;
  invoiceNumber?: string;
  supplier?: string;
  supplierCnpj?: string;
  product?: string;
  productId?: string;
  unitOfMeasure?: string;
  quantityTons: number;
  valuePerTon?: number;
  totalValue: number;
  driverPlate?: string;
  licensePlate?: string;
  driverId?: string;
  motoristaId?: string;
  freightPayable?: 'YES' | 'NO' | boolean;
  freightCost?: number;
  freightStatus?: 'PENDING' | 'PAID';
  freightPaidAt?: string;
  transactionKey?: string;
  deductFromBalance?: 'YES' | 'NO' | boolean;
  /** Carga Klabin que também gera valor devido pela Pro Cabos. Ausente em cargas antigas = false. */
  proCabos?: boolean;
  /** Tarifa de mão de obra (R$/t) vigente quando a carga foi marcada como Pro Cabos. */
  proCabosLaborRatePerTon?: number;
  /** Situação do valor devido pela Pro Cabos. Ausente em carga Pro Cabos = em aberto. */
  proCabosStatus?: 'PENDING' | 'PAID';
  notes?: string;
}

export interface DepositoKlabinRecord {
  id: string;
  date: string;
  value: number;
  notes?: string;
}

export interface FreteRecord {
  id: string;
  referenceDateLine?: string;
  quantityTons?: number;
  value?: number;
  notes?: string;
}

export interface ResumoRecord {
  id: string;
  metricName: string;
  metricValue: number;
}

export interface CaixaRecord {
  id: string;
  balanceControlKlabin: string;
  value: number;
}

export interface ClientRecord {
  id: string;
  name: string;
  contact: string;
  notes: string;
  createdAt: string;
}

export interface VendaRecord {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  product: string;
  productId?: string;
  unitOfMeasure?: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paidAt?: string;
  notes: string;
  createdAt: string;
  freightPayable?: 'YES' | 'NO' | boolean;
  freightCost?: number;
  freightStatus?: 'PENDING' | 'PAID';
  freightPaidAt?: string;
  transactionKey?: string;
  driverId?: string;
  driverPlate?: string;
  licensePlate?: string;
  motoristaId?: string;
}

export interface ProdutoRecord {
  id: string;
  name: string;
  unitOfMeasure: string;
  referencePrice: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface MotoristaRecord {
  id: string;
  name: string;
  licensePlate: string;
  trailerPlate?: string;
  phone?: string;
  pixKey?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
}

/**
 * Cadastros e lançamentos do módulo Mão de Obra. São independentes de Clientes/Produtos
 * de vendas. Campos opcionais ausentes ficam como `null` (nunca `undefined`): o Firestore
 * grava com merge, então só um `null` explícito apaga um valor antigo na nuvem.
 */
export interface MaoDeObraClienteRecord {
  id: string;
  name: string;
  createdAt: string | null;
}
export interface MaoDeObraProdutoRecord {
  id: string;
  name: string;
  /** Preço de referência (R$/t) usado só para sugerir o valor de lançamentos novos. */
  pricePerTon: number | null;
  createdAt: string | null;
}
export interface MaoDeObraLancamentoRecord {
  id: string;
  clientId: string | null;
  /** Nome do cliente na data do lançamento; mantém o registro legível se o cadastro sumir. */
  clientName: string | null;
  productId: string | null;
  productName: string | null;
  date: string | null;
  quantityTons: number | null;
  /** Preço R$/t usado no cálculo, gravado no lançamento; não acompanha mudanças do cadastro. */
  pricePerTon: number | null;
  /** Valor total gravado; `null` = valor ainda não conhecido (não é R$ 0,00). */
  totalValue: number | null;
  /** O valor foi digitado pelo usuário e não deve ser recalculado automaticamente. */
  totalValueManual: boolean;
  status: 'PENDING' | 'PAID';
  paidAt: string | null;
  createdAt: string | null;
}
export interface CompanySettings {
  name: string;
  cnpj?: string;
  city?: string;
  state?: string;
}

export interface KlabinSettings {
  defaultDeductFromBalance: boolean;
}

export interface FreightSettings {
  /** Legado: não é mais lido pelo app; mantido só para não descartar o valor já gravado. */
  defaultCargoFreightPayable?: boolean;
  defaultSaleFreightPayable?: boolean;
}

export interface CyclesSettings {
  lockedMonths?: string[];
}

export interface AppSettings {
  freightRatePerTon?: number;
  company?: CompanySettings;
  klabin?: KlabinSettings;
  freight?: FreightSettings;
  cycles?: CyclesSettings;
  companyName?: string;
}

export interface KlabinDatabase {
  Cargas: CargaRecord[];
  Depositos_Klabin: DepositoKlabinRecord[];
  Frete: FreteRecord[];
  Motoristas?: MotoristaRecord[];
  Clientes?: ClientRecord[];
  Vendas?: VendaRecord[];
  Produtos?: ProdutoRecord[];
  MaoDeObra_Lancamentos?: MaoDeObraLancamentoRecord[];
  MaoDeObra_Clientes?: MaoDeObraClienteRecord[];
  MaoDeObra_Produtos?: MaoDeObraProdutoRecord[];
  appSettings?: AppSettings;
  customLogo?: string;
}

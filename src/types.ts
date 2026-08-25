export type TableType =
  | 'Dashboard'
  | 'Klabin'
  | 'Clientes_Produtos'
  | 'Motoristas'
  | 'Configuracoes'
  | 'Cargas'
  | 'Depositos_Klabin'
  | 'Gestao_Clientes'
  | 'Vendas'
  | 'Produtos'
  | 'Resumo'
  | 'Caixa'
  | 'Frete';

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
  appSettings?: AppSettings;
  customLogo?: string;
}

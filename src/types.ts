export type WoodProductType = 'Eucalipto' | 'Pinus Taeda' | 'Pinus Elliottii' | 'Tora Eucalipto' | 'Outros' | string;

export interface ProductDefault {
  id: string;
  name: string;
  defaultPricePerTon: number;
  description?: string;
}

export type UnitOfMeasure = 'ton' | 'm³' | 'm²' | 'un';

export const UNIT_OF_MEASURE_OPTIONS: { value: UnitOfMeasure; label: string }[] = [
  { value: 'ton', label: 'Toneladas (ton)' },
  { value: 'm³', label: 'Metro Cúbico (m³)' },
  { value: 'm²', label: 'Metro Quadrado (m²)' },
  { value: 'un', label: 'Unidade (un)' },
];

export interface AppSettings {
  freightRatePerTon: number;
  companyName?: string;
}

export interface MotoristaRecord {
  id: string;
  name: string;
  licensePlate: string; // Placa do Cavalo
  trailerPlate?: string; // Placa da Carreta (optional)
  phone?: string; // Telefone / WhatsApp (optional)
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
}

export interface CargaRecord {
  id: string;
  date: string; // Date of Purchase (YYYY-MM-DD)
  invoiceNumber?: string; // Invoice Number (optional)
  supplier?: string; // Supplier (optional legacy field)
  supplierCnpj?: string; // Supplier CNPJ (optional legacy field)
  product: string; // Product name ('Eucalipto', 'Pinus Taeda', etc)
  productId?: string; // Relational link to ProdutoRecord.id
  quantityTons: number; // Quantity
  unitOfMeasure?: UnitOfMeasure | string; // Unidade de medida ('ton', 'm³', 'm²', 'un')
  valuePerTon: number; // Value per unit
  totalValue: number; // Total Value (quantityTons * valuePerTon)
  licensePlate?: string; // Vehicle License Plate
  driverPlate?: string; // Driver Name / License Plate (e.g. "Carlos Silva / ABC-4E12")
  driverId?: string; // Relational link to MotoristaRecord.id
  motoristaId?: string; // Relational link alias to MotoristaRecord.id
  freightPayable?: boolean | 'YES' | 'NO'; // Freight Payable? Default true / "YES"
  freightCost?: number; // Calculated Freight Cost = quantityTons * 15 (if freightPayable)
  freightStatus?: 'PENDING' | 'PAID'; // Freight status: "PENDING" (default) or "PAID"
  freightPaidAt?: string; // Date/Time when freight was paid
  transactionKey?: string; // Chave da Transação / NSU / Comprovante PIX
  notes?: string; // Notes
  deductFromBalance: boolean | 'YES' | 'NO'; // Deduct from balance?
  createdAt?: string;
}

export interface DepositoKlabinRecord {
  id: string;
  date: string; // Date (YYYY-MM-DD)
  value: number; // Value (Currency BRL)
  notes?: string; // Notes
  createdAt?: string;
}

export interface ResumoRecord {
  id: string;
  metricName: string; // Metric Name
  metricValue: number; // Metric Value
  createdAt?: string;
}

export interface CaixaRecord {
  id: string;
  balanceControlKlabin: string; // Balance Control Klabin
  value: number; // Value (Currency BRL)
  createdAt?: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  contact?: string;
  notes?: string;
  createdAt?: string;
}

export interface VendaRecord {
  id: string;
  date: string; // YYYY-MM-DD
  clientId?: string; // ID of the client (relational link to ClientRecord.id)
  clientName: string; // Name of the client for quick lookup / fallback
  productId?: string; // ID of product (relational link to ProdutoRecord.id)
  product: string; // Product name
  quantity: number; // Quantity sold
  unitOfMeasure?: UnitOfMeasure | string; // Unidade de medida ('ton', 'm³', 'm²', 'un')
  unitPrice: number; // Price per unit
  totalValue: number; // Auto-calculated: quantity * unitPrice
  status: 'PENDING' | 'PAID' | 'CANCELLED'; // Sales payment status
  paidAt?: string;
  transactionKey?: string; // Chave da Transação / NSU / Comprovante
  notes?: string;
  driverId?: string;
  motoristaId?: string;
  driverPlate?: string;
  licensePlate?: string;
  freightPayable?: boolean | 'YES' | 'NO';
  freightCost?: number;
  freightStatus?: 'PENDING' | 'PAID';
  freightPaidAt?: string;
  createdAt?: string;
}

export interface ProdutoRecord {
  id: string;
  name: string; // Nome do Produto
  referencePrice: number; // Preço de Referência (Currency / Number)
  unitOfMeasure: UnitOfMeasure | string; // Unidade de Medida padrão
  status: 'ACTIVE' | 'INACTIVE'; // Status (Ativo / Inativo)
  description?: string; // Descrição ou observação
  createdAt?: string;
}

export type TableType =
  | 'Dashboard'
  | 'Klabin'
  | 'Cargas'
  | 'Depositos_Klabin'
  | 'Clientes_Produtos'
  | 'Motoristas'
  | 'Gestao_Clientes'
  | 'Vendas'
  | 'Produtos'
  | 'Resumo'
  | 'Caixa'
  | 'Configuracoes';

export interface KlabinDatabase {
  customLogo?: string;
  appSettings?: AppSettings;
  Cargas: CargaRecord[];
  Depositos_Klabin: DepositoKlabinRecord[];
  Resumo?: ResumoRecord[];
  Caixa?: CaixaRecord[];
  Clientes?: ClientRecord[];
  Vendas?: VendaRecord[];
  Produtos?: ProdutoRecord[];
  Motoristas?: MotoristaRecord[];
}



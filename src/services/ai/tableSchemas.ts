import { TableSchema } from './types';

export const CARGAS_SCHEMA: TableSchema = {
  tableKey: 'Cargas',
  tableName: 'Cargas (Entradas de Madeira)',
  description: 'Registro de carregamentos, compras e entregas de madeira para Klabin ou terceiros',
  fields: [
    {
      key: 'date',
      label: 'Data da Compra / Entrada',
      type: 'date',
      description: 'Data do carregamento ou emissão da nota no formato YYYY-MM-DD',
      required: true,
      example: '2026-08-14',
    },
    {
      key: 'invoiceNumber',
      label: 'Número da Nota / Ticket',
      type: 'string',
      description: 'Número da NF-e, romaneio, ticket de pesagem ou recibo',
      example: 'NF-10482',
    },
    {
      key: 'product',
      label: 'Produto / Tipo de Madeira',
      type: 'string',
      description: 'Espécie de madeira (Ex: Eucalipto, Pinus Taeda, Pinus Elliottii, Tora Eucalipto)',
      example: 'Eucalipto',
    },
    {
      key: 'quantityTons',
      label: 'Quantidade / Peso Líquido (ton)',
      type: 'number',
      description: 'Peso líquido em toneladas ou volume indicado no documento',
      example: '32.45',
    },
    {
      key: 'unitOfMeasure',
      label: 'Unidade de Medida',
      type: 'select',
      options: ['ton', 'm³', 'm²', 'un'],
      description: 'Unidade de medida padrão',
      example: 'ton',
    },
    {
      key: 'valuePerTon',
      label: 'Valor Unitário (R$/ton)',
      type: 'currency',
      description: 'Preço unitário pago por tonelada ou m³',
      example: '145.00',
    },
    {
      key: 'totalValue',
      label: 'Valor Total (R$)',
      type: 'currency',
      description: 'Valor total da carga (quantidade * valor unitário)',
      example: '4705.25',
    },
    {
      key: 'licensePlate',
      label: 'Placa do Veículo / Cavalo',
      type: 'string',
      description: 'Placa do caminhão no formato ABC-1234 ou ABC1D23',
      example: 'BRA-2E19',
    },
    {
      key: 'driverPlate',
      label: 'Nome do Motorista / Identificação',
      type: 'string',
      description: 'Nome completo do motorista ou motorista e placa',
      example: 'Carlos Mendes',
    },
    {
      key: 'transactionKey',
      label: 'Chave da NF-e / PIX / Comprovante',
      type: 'string',
      description: 'Chave de acesso da NFe de 44 dígitos ou código do comprovante PIX',
      example: '35260800000000000000550010000010482100000001',
    },
    {
      key: 'notes',
      label: 'Observações Gerais',
      type: 'string',
      description: 'Observações, local de retirada, talhão ou detalhes adicionais',
      example: 'Madeira entregue na Unidade Klabin Monte Alegre',
    },
  ],
};

export const DEPOSITOS_SCHEMA: TableSchema = {
  tableKey: 'Depositos_Klabin',
  tableName: 'Depósitos Klabin',
  description: 'Comprovantes de depósitos bancários e adiantamentos realizados pela Klabin',
  fields: [
    {
      key: 'date',
      label: 'Data do Depósito',
      type: 'date',
      description: 'Data do pagamento/transferência no formato YYYY-MM-DD',
      required: true,
      example: '2026-08-14',
    },
    {
      key: 'value',
      label: 'Valor do Depósito (R$)',
      type: 'currency',
      description: 'Valor monetário creditado',
      required: true,
      example: '50000.00',
    },
    {
      key: 'notes',
      label: 'Observações / Descrição',
      type: 'string',
      description: 'Número da TED, DOC, chave PIX ou observação do depósito',
      example: 'Adiantamento quinzenal safra agosto',
    },
  ],
};

export const CLIENTES_SCHEMA: TableSchema = {
  tableKey: 'Clientes',
  tableName: 'Cadastro de Clientes',
  description: 'Informações cadastrais de clientes compradores de madeira',
  fields: [
    {
      key: 'name',
      label: 'Nome / Razão Social',
      type: 'string',
      description: 'Nome do cliente ou empresa compradora',
      required: true,
      example: 'Serraria Santa Maria Ltda',
    },
    {
      key: 'contact',
      label: 'Contato / Telefone / CNPJ',
      type: 'string',
      description: 'Telefone, WhatsApp, e-mail ou documento de contato',
      example: '(42) 99876-5432 / 12.345.678/0001-90',
    },
    {
      key: 'notes',
      label: 'Observações / Endereço',
      type: 'string',
      description: 'Endereço da entrega, condições de pagamento ou detalhes',
      example: 'Entrega no pátio da fábrica em Telêmaco Borba',
    },
  ],
};

export const VENDAS_SCHEMA: TableSchema = {
  tableKey: 'Vendas',
  tableName: 'Vendas de Madeira',
  description: 'Contratos e pedidos de vendas faturadas de madeira para clientes',
  fields: [
    {
      key: 'date',
      label: 'Data da Venda',
      type: 'date',
      description: 'Data da operação no formato YYYY-MM-DD',
      required: true,
      example: '2026-08-14',
    },
    {
      key: 'clientName',
      label: 'Cliente',
      type: 'string',
      description: 'Nome do cliente comprador',
      required: true,
      example: 'Serraria Santa Maria',
    },
    {
      key: 'product',
      label: 'Produto Vendido',
      type: 'string',
      description: 'Espécie ou tipo de madeira vendida',
      example: 'Pinus Taeda',
    },
    {
      key: 'quantity',
      label: 'Quantidade',
      type: 'number',
      description: 'Volume ou peso comercializado',
      example: '45.0',
    },
    {
      key: 'unitOfMeasure',
      label: 'Unidade de Medida',
      type: 'select',
      options: ['ton', 'm³', 'm²', 'un'],
      description: 'Unidade de medida comercial',
      example: 'ton',
    },
    {
      key: 'unitPrice',
      label: 'Preço Unitário (R$)',
      type: 'currency',
      description: 'Valor cobrado por unidade de medida',
      example: '180.00',
    },
    {
      key: 'totalValue',
      label: 'Valor Total da Venda (R$)',
      type: 'currency',
      description: 'Valor total faturado (quantidade * preço unitário)',
      example: '8100.00',
    },
    {
      key: 'status',
      label: 'Status do Pagamento',
      type: 'select',
      options: ['PENDING', 'PAID', 'CANCELLED'],
      description: 'Status do recebimento (PAID para pago, PENDING para a receber)',
      example: 'PAID',
    },
    {
      key: 'transactionKey',
      label: 'Chave / Comprovante',
      type: 'string',
      description: 'Chave PIX ou número do pedido/recibo',
      example: 'PIX-9823412',
    },
    {
      key: 'driverPlate',
      label: 'Transportador / Placa',
      type: 'string',
      description: 'Motorista ou placa do caminhão que retirou a madeira',
      example: 'Marcos / ABC-1234',
    },
    {
      key: 'notes',
      label: 'Observações',
      type: 'string',
      description: 'Observações adicionais da venda',
      example: 'Faturamento à vista',
    },
  ],
};

export const PRODUTOS_SCHEMA: TableSchema = {
  tableKey: 'Produtos',
  tableName: 'Cadastro de Produtos',
  description: 'Catálogo de tipos de madeira e preços de referência',
  fields: [
    {
      key: 'name',
      label: 'Nome do Produto',
      type: 'string',
      description: 'Nome da espécie ou tipo de madeira',
      required: true,
      example: 'Eucalipto Saligna',
    },
    {
      key: 'referencePrice',
      label: 'Preço de Referência (R$)',
      type: 'currency',
      description: 'Preço base por unidade',
      example: '155.00',
    },
    {
      key: 'unitOfMeasure',
      label: 'Unidade de Medida',
      type: 'select',
      options: ['ton', 'm³', 'm²', 'un'],
      description: 'Unidade de medida padrão',
      example: 'ton',
    },
    {
      key: 'description',
      label: 'Descrição / Detalhes',
      type: 'string',
      description: 'Especificações técnicas ou descrição do produto',
      example: 'Madeira com casca para celulose',
    },
  ],
};

export const MOTORISTAS_SCHEMA: TableSchema = {
  tableKey: 'Motoristas',
  tableName: 'Cadastro de Motoristas',
  description: 'Informações cadastrais e veículos dos motoristas e transportadores',
  fields: [
    {
      key: 'name',
      label: 'Nome do Motorista',
      type: 'string',
      description: 'Nome completo do condutor',
      required: true,
      example: 'Carlos Alberto Mendes',
    },
    {
      key: 'licensePlate',
      label: 'Placa do Cavalo (Trator)',
      type: 'string',
      description: 'Placa principal do caminhão',
      required: true,
      example: 'ABC-1234',
    },
    {
      key: 'trailerPlate',
      label: 'Placa da Carreta / Semirreboque',
      type: 'string',
      description: 'Placa do reboque ou carreta acoplada',
      example: 'XYZ-9876',
    },
    {
      key: 'phone',
      label: 'Telefone / WhatsApp',
      type: 'string',
      description: 'Contato direto do motorista',
      example: '(42) 98888-7777',
    },
  ],
};

export const ALL_TABLE_SCHEMAS: Record<string, TableSchema> = {
  Cargas: CARGAS_SCHEMA,
  Depositos_Klabin: DEPOSITOS_SCHEMA,
  Clientes: CLIENTES_SCHEMA,
  Vendas: VENDAS_SCHEMA,
  Produtos: PRODUTOS_SCHEMA,
  Motoristas: MOTORISTAS_SCHEMA,
};

export function getTableSchema(key: string): TableSchema {
  return ALL_TABLE_SCHEMAS[key] || CARGAS_SCHEMA;
}

import { KlabinDatabase } from '../../types';
import { generateCSVString } from '../storage';

/** Drive exports intentionally retain their own columns and filenames. */
export function buildDriveCSVExports(database: KlabinDatabase, now: string): { name: string; csv: string }[] {
  return [
        {
          name: `Cargas_Klabin_${now}.csv`,
          csv: generateCSVString(database.Cargas || [], [
            { key: 'date', label: 'Data' },
            { key: 'invoiceNumber', label: 'NF' },
            { key: 'driverPlate', label: 'Motorista' },
            { key: 'quantityTons', label: 'Quantidade (Ton)' },
            { key: 'totalValue', label: 'Valor Madeira (R$)' },
            { key: 'freightCost', label: 'Valor Frete (R$)' },
            { key: 'freightStatus', label: 'Status' },
          ]),
        },
        {
          name: `Depositos_Klabin_${now}.csv`,
          csv: generateCSVString(database.Depositos_Klabin || [], [
            { key: 'date', label: 'Data' },
            { key: 'value', label: 'Valor (R$)' },
            { key: 'notes', label: 'Observações / Comprovante' },
          ]),
        },
        {
          name: `Vendas_Clientes_${now}.csv`,
          csv: generateCSVString(database.Vendas || [], [
            { key: 'date', label: 'Data' },
            { key: 'clientName', label: 'Cliente' },
            { key: 'product', label: 'Produto' },
            { key: 'quantity', label: 'Quantidade' },
            { key: 'unitPrice', label: 'Preço Unitário (R$)' },
            { key: 'totalValue', label: 'Valor Total (R$)' },
            { key: 'status', label: 'Status Pagamento' },
          ]),
        },
        {
          name: `Motoristas_Fretes_${now}.csv`,
          csv: generateCSVString(database.Motoristas || [], [
            { key: 'name', label: 'Nome' },
            { key: 'licensePlate', label: 'Placa' },
            { key: 'phone', label: 'Telefone' },
            { key: 'status', label: 'Status' },
          ]),
        },
        {
          name: `Catalogo_Produtos_${now}.csv`,
          csv: generateCSVString(database.Produtos || [], [
            { key: 'name', label: 'Nome do Produto' },
            { key: 'unitOfMeasure', label: 'Unidade' },
            { key: 'referencePrice', label: 'Preço Padrão (R$)' },
            { key: 'status', label: 'Status' },
          ]),
        },
      ];

}

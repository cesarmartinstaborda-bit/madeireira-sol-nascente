import { KlabinDatabase, TableType } from '../../types';
import { computeDashboardMetrics } from '../dashboard/computedMetrics';
import { exportTableCSV } from '../storage';

export function exportActiveTable(activeTable: TableType, klabinSubTab: 'CARGAS' | 'DEPOSITOS', database: KlabinDatabase, computedMetrics: ReturnType<typeof computeDashboardMetrics>) {
    switch (activeTable === 'Klabin' ? (klabinSubTab === 'DEPOSITOS' ? 'Depositos_Klabin' : 'Cargas') : activeTable) {
      case 'Cargas':
        exportTableCSV('Cargas', database.Cargas, [
          { key: 'date', label: 'Data Compra' },
          { key: 'supplier', label: 'Fornecedor' },
          { key: 'product', label: 'Produto' },
          { key: 'quantityTons', label: 'Quantidade (Ton)' },
          { key: 'valuePerTon', label: 'Valor/Ton (R$)' },
          { key: 'totalValue', label: 'Valor Total (R$)' },
          { key: 'driverPlate', label: 'Motorista / Placa' },
          { key: 'freightPayable', label: 'Frete a Pagar?' },
          { key: 'freightCost', label: 'Custo Frete (R$)' },
          { key: 'deductFromBalance', label: 'Abater do Saldo?' },
          { key: 'notes', label: 'Observações' },
        ]);
        break;
      case 'Depositos_Klabin':
        exportTableCSV('Depositos_Klabin', database.Depositos_Klabin, [
          { key: 'date', label: 'Data Depósito' },
          { key: 'value', label: 'Valor Depósito (R$)' },
          { key: 'notes', label: 'Observações / Comprovante' },
        ]);
        break;
      case 'Motoristas':
        exportTableCSV('Motoristas', database.Motoristas || [], [
          { key: 'name', label: 'Nome Motorista' },
          { key: 'licensePlate', label: 'Placa Veículo' },
          { key: 'trailerPlate', label: 'Placa Reboque' },
          { key: 'phone', label: 'Telefone' },
          { key: 'pixKey', label: 'Chave PIX' },
          { key: 'status', label: 'Status' },
        ]);
        break;
      case 'Clientes_Produtos':
      case 'Gestao_Clientes':
      case 'Vendas':
        exportTableCSV('Vendas', database.Vendas || [], [
          { key: 'date', label: 'Data Venda' },
          { key: 'clientName', label: 'Nome Cliente' },
          { key: 'product', label: 'Produto' },
          { key: 'quantity', label: 'Quantidade' },
          { key: 'unitPrice', label: 'Preço Unitário (R$)' },
          { key: 'totalValue', label: 'Valor Total (R$)' },
          { key: 'status', label: 'Status' },
          { key: 'notes', label: 'Observações' },
        ]);
        break;
      case 'Produtos':
        exportTableCSV('Produtos', database.Produtos || [], [
          { key: 'name', label: 'Nome Produto' },
          { key: 'unitOfMeasure', label: 'Unidade de Medida' },
          { key: 'referencePrice', label: 'Preço de Referência' },
          { key: 'status', label: 'Status' },
        ]);
        break;
      case 'Resumo':
        exportTableCSV('Resumo', computedMetrics.resumoRecords, [
          { key: 'metricName', label: 'Nome da Métrica' },
          { key: 'metricValue', label: 'Valor da Métrica' },
        ]);
        break;
      case 'Caixa':
        exportTableCSV('Caixa', computedMetrics.caixaRecords, [
          { key: 'balanceControlKlabin', label: 'Controle de Saldo Klabin' },
          { key: 'value', label: 'Valor (R$)' },
        ]);
        break;
    }
}

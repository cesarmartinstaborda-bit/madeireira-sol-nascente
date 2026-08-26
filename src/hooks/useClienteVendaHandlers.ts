import { KlabinDatabase, ClientRecord, VendaRecord } from '../types';
import { upsertFirestoreRecord, deleteFirestoreRecord } from '../utils/firebaseSync';
import { generateId } from '../utils/idGenerator';
import { normalizeIsoDate } from '../utils/formatters';

interface UseClienteVendaHandlersParams {
  database: KlabinDatabase;
  mutateDatabase: (updater: (prev: KlabinDatabase) => KlabinDatabase) => void;
  showToast: (msg: string) => void;
  isDateLocked: (dateStr?: string) => boolean;
}

/**
 * CRUD handlers for Clientes and Vendas.
 *
 * `isDateLocked` is injected: Venda mutations respect `appSettings.cycles.lockedMonths`
 * (Clientes have no date field and are never locked).
 *
 * Note on ownership: `Clientes` is written exclusively here. `Vendas` is not — the generic
 * modal path in `handleSaveRecord` also writes it (`modalTableType === 'Gestao_Clientes' |
 * 'Vendas' | 'Clientes_Produtos'`), and `useFreightHandlers` writes it too when settling
 * freight for a driver's sales.
 */
export function useClienteVendaHandlers({
  database,
  mutateDatabase,
  showToast,
  isDateLocked,
}: UseClienteVendaHandlersParams) {
  // CLIENT & VENDA HANDLERS
  const handleAddClient = (clientData: Partial<ClientRecord>) => {
    const trimmedName = (clientData.name || '').trim();
    if (!trimmedName) {
      showToast('Erro de validação: O nome do cliente não pode ser vazio.');
      return;
    }

    const newClient: ClientRecord = {
      id: generateId('cli'),
      name: trimmedName,
      contact: (clientData.contact || '').trim() || 'Não informado',
      notes: (clientData.notes || '').trim(),
      createdAt: new Date().toISOString(),
    };
    mutateDatabase((prev) => ({
      ...prev,
      Clientes: [...(prev.Clientes || []), newClient],
    }));
    upsertFirestoreRecord('clientes', newClient);
    showToast(`Cliente ${newClient.name} cadastrado com sucesso.`);
  };

  const handleUpdateClient = (updatedClient: ClientRecord) => {
    mutateDatabase((prev) => ({
      ...prev,
      Clientes: (prev.Clientes || []).map((c) => (c.id === updatedClient.id ? updatedClient : c)),
    }));
    upsertFirestoreRecord('clientes', updatedClient);
    showToast(`Cliente ${updatedClient.name} atualizado.`);
  };

  const handleDeleteClient = (clientId: string) => {
    mutateDatabase((prev) => ({
      ...prev,
      Clientes: (prev.Clientes || []).filter((c) => c.id !== clientId),
    }));
    deleteFirestoreRecord('clientes', clientId);
    showToast('Cliente removido.');
  };

  const handleAddVenda = (vendaData: Partial<VendaRecord>) => {
    const vDate = normalizeIsoDate(vendaData.date);
    if (isDateLocked(vDate)) {
      showToast('Operação bloqueada: o mês selecionado está trancado no Fechamento de Ciclo.');
      return;
    }
    const clientName = (vendaData.clientName || '').trim();
    if (!clientName) {
      showToast('Erro de validação: Informe um cliente para a venda.');
      return;
    }
    const product = (vendaData.product || '').trim();
    if (!product) {
      showToast('Erro de validação: Informe um produto para a venda.');
      return;
    }

    const newVenda: VendaRecord = {
      id: generateId('vnd'),
      date: vDate,
      clientId: vendaData.clientId || 'cli-general',
      clientName,
      product,
      quantity: Number(vendaData.quantity) || 1,
      unitPrice: Number(vendaData.unitPrice) || 0,
      totalValue: Number(vendaData.totalValue) || (Number(vendaData.quantity) || 1) * (Number(vendaData.unitPrice) || 0),
      status: vendaData.status || 'PENDING',
      notes: (vendaData.notes || '').trim(),
      createdAt: new Date().toISOString(),
    };
    mutateDatabase((prev) => ({
      ...prev,
      Vendas: [...(prev.Vendas || []), newVenda],
    }));
    upsertFirestoreRecord('vendas', newVenda);
    showToast(`Venda lançada para ${newVenda.clientName}.`);
  };

  const handleUpdateVenda = (updatedVenda: VendaRecord) => {
    if (isDateLocked(updatedVenda.date)) {
      showToast('Operação bloqueada: esta venda pertence a um mês trancado no Fechamento de Ciclo.');
      return;
    }
    mutateDatabase((prev) => ({
      ...prev,
      Vendas: (prev.Vendas || []).map((v) => (v.id === updatedVenda.id ? updatedVenda : v)),
    }));
    upsertFirestoreRecord('vendas', updatedVenda);
    showToast('Venda atualizada.');
  };

  const handleDeleteVenda = (vendaId: string) => {
    const existingVenda = (database.Vendas || []).find((v) => v.id === vendaId);
    if (existingVenda && isDateLocked(existingVenda.date)) {
      showToast('Operação bloqueada: não é possível excluir venda em mês trancado no Fechamento de Ciclo.');
      return;
    }
    mutateDatabase((prev) => ({
      ...prev,
      Vendas: (prev.Vendas || []).filter((v) => v.id !== vendaId),
    }));
    deleteFirestoreRecord('vendas', vendaId);
    showToast('Lançamento de venda removido.');
  };

  const handleToggleVendaStatus = (vendaId: string) => {
    const existingVenda = (database.Vendas || []).find((v) => v.id === vendaId);
    if (existingVenda && isDateLocked(existingVenda.date)) {
      showToast('Operação bloqueada: não é possível alterar status de venda em mês trancado.');
      return;
    }
    let updatedRecord: VendaRecord | null = null;
    mutateDatabase((prev) => {
      const updatedVendas = (prev.Vendas || []).map((v) => {
        if (v.id === vendaId) {
          const newStatus = v.status === 'PAID' ? 'PENDING' : 'PAID';
          updatedRecord = {
            ...v,
            status: newStatus as 'PENDING' | 'PAID',
            paidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined,
          };
          return updatedRecord;
        }
        return v;
      });
      return {
        ...prev,
        Vendas: updatedVendas,
      };
    });
    if (updatedRecord) {
      upsertFirestoreRecord('vendas', updatedRecord);
    }
    showToast('Status de quitação da venda alterado.');
  };

  return {
    handleAddClient,
    handleUpdateClient,
    handleDeleteClient,
    handleAddVenda,
    handleUpdateVenda,
    handleDeleteVenda,
    handleToggleVendaStatus,
  };
}

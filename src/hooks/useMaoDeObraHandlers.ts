import {
  KlabinDatabase,
  MaoDeObraClienteRecord,
  MaoDeObraLancamentoRecord,
  MaoDeObraProdutoRecord,
} from '../types';
import { deleteFirestoreRecord, upsertFirestoreRecord } from '../utils/firebaseSync';
import { generateId } from '../utils/idGenerator';

/** Campos editáveis de um lançamento; situação e datas de controle ficam com o hook. */
export type MaoDeObraLancamentoInput = Pick<
  MaoDeObraLancamentoRecord,
  'clientId' | 'clientName' | 'productId' | 'productName' | 'date' | 'quantityTons' | 'pricePerTon' | 'totalValue' | 'totalValueManual'
>;

interface UseMaoDeObraHandlersParams {
  database: KlabinDatabase;
  mutateDatabase: (updater: (prev: KlabinDatabase) => KlabinDatabase) => void;
  showToast: (msg: string) => void;
  isDateLocked: (dateStr?: string) => boolean;
}

/**
 * Lançamentos e cadastros (clientes e produtos) do módulo Mão de Obra.
 *
 * Cada ação atualiza o estado local e espelha o registro no Firestore. Quitar/reverter só
 * troca `status`/`paidAt` e, como na Pro Cabos, continua disponível em mês trancado;
 * criar, editar e excluir respeitam o fechamento de competência.
 */
export function useMaoDeObraHandlers({ database, mutateDatabase, showToast, isDateLocked }: UseMaoDeObraHandlersParams) {
  const lancamentos = database.MaoDeObra_Lancamentos || [];

  const blockedByLock = (...dates: (string | null | undefined)[]) => {
    if (!dates.some((date) => date && isDateLocked(date))) return false;
    showToast('Competência trancada: lançamentos desse mês não podem ser alterados.');
    return true;
  };

  const handleSaveLancamento = (input: MaoDeObraLancamentoInput, editingId?: string): boolean => {
    const original = editingId ? lancamentos.find((l) => l.id === editingId) : undefined;
    if (editingId && !original) return false;
    if (blockedByLock(input.date, original?.date)) return false;

    const record: MaoDeObraLancamentoRecord = original
      ? { ...original, ...input }
      : { id: generateId('mob'), ...input, status: 'PENDING', paidAt: null, createdAt: new Date().toISOString() };

    mutateDatabase((prev) => ({
      ...prev,
      MaoDeObra_Lancamentos: original
        ? (prev.MaoDeObra_Lancamentos || []).map((l) => (l.id === record.id ? record : l))
        : [record, ...(prev.MaoDeObra_Lancamentos || [])],
    }));
    upsertFirestoreRecord('maoDeObraLancamentos', record);
    showToast(original ? 'Lançamento de mão de obra atualizado.' : 'Lançamento de mão de obra registrado.');
    return true;
  };

  const handleDeleteLancamento = (id: string) => {
    const original = lancamentos.find((l) => l.id === id);
    if (!original || blockedByLock(original.date)) return;
    mutateDatabase((prev) => ({
      ...prev,
      MaoDeObra_Lancamentos: (prev.MaoDeObra_Lancamentos || []).filter((l) => l.id !== id),
    }));
    deleteFirestoreRecord('maoDeObraLancamentos', id);
    showToast('Lançamento de mão de obra excluído.');
  };

  const handleSetLancamentoStatus = (id: string, status: 'PENDING' | 'PAID') => {
    const original = lancamentos.find((l) => l.id === id);
    if (!original) return;
    const record: MaoDeObraLancamentoRecord = {
      ...original,
      status,
      paidAt: status === 'PAID' ? new Date().toISOString() : null,
    };
    mutateDatabase((prev) => ({
      ...prev,
      MaoDeObra_Lancamentos: (prev.MaoDeObra_Lancamentos || []).map((l) => (l.id === id ? record : l)),
    }));
    upsertFirestoreRecord('maoDeObraLancamentos', record);
    showToast(status === 'PAID' ? 'Lançamento marcado como quitado.' : 'Quitação revertida; lançamento voltou para Principal.');
  };

  const handleSaveCliente = (name: string, editingId?: string) => {
    const original = editingId ? (database.MaoDeObra_Clientes || []).find((c) => c.id === editingId) : undefined;
    const record: MaoDeObraClienteRecord = original
      ? { ...original, name }
      : { id: generateId('mobcli'), name, createdAt: new Date().toISOString() };
    mutateDatabase((prev) => ({
      ...prev,
      MaoDeObra_Clientes: original
        ? (prev.MaoDeObra_Clientes || []).map((c) => (c.id === record.id ? record : c))
        : [...(prev.MaoDeObra_Clientes || []), record],
    }));
    upsertFirestoreRecord('maoDeObraClientes', record);
    showToast(original ? `Cliente ${name} atualizado.` : `Cliente ${name} cadastrado.`);
  };

  // Lançamentos guardam o nome do cliente/produto, então excluir o cadastro não os afeta.
  const handleDeleteCliente = (id: string) => {
    mutateDatabase((prev) => ({
      ...prev,
      MaoDeObra_Clientes: (prev.MaoDeObra_Clientes || []).filter((c) => c.id !== id),
    }));
    deleteFirestoreRecord('maoDeObraClientes', id);
    showToast('Cliente excluído do cadastro da Mão de Obra.');
  };

  const handleSaveProduto = (name: string, pricePerTon: number | null, editingId?: string) => {
    const original = editingId ? (database.MaoDeObra_Produtos || []).find((p) => p.id === editingId) : undefined;
    const record: MaoDeObraProdutoRecord = original
      ? { ...original, name, pricePerTon }
      : { id: generateId('mobprod'), name, pricePerTon, createdAt: new Date().toISOString() };
    mutateDatabase((prev) => ({
      ...prev,
      MaoDeObra_Produtos: original
        ? (prev.MaoDeObra_Produtos || []).map((p) => (p.id === record.id ? record : p))
        : [...(prev.MaoDeObra_Produtos || []), record],
    }));
    upsertFirestoreRecord('maoDeObraProdutos', record);
    showToast(original ? `Produto ${name} atualizado.` : `Produto ${name} cadastrado.`);
  };

  const handleDeleteProduto = (id: string) => {
    mutateDatabase((prev) => ({
      ...prev,
      MaoDeObra_Produtos: (prev.MaoDeObra_Produtos || []).filter((p) => p.id !== id),
    }));
    deleteFirestoreRecord('maoDeObraProdutos', id);
    showToast('Produto excluído do cadastro da Mão de Obra.');
  };

  return {
    handleSaveLancamento,
    handleDeleteLancamento,
    handleSetLancamentoStatus,
    handleSaveCliente,
    handleDeleteCliente,
    handleSaveProduto,
    handleDeleteProduto,
  };
}

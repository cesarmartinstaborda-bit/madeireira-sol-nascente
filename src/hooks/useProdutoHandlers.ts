import { KlabinDatabase, ProdutoRecord } from '../types';
import { upsertFirestoreRecord, deleteFirestoreRecord } from '../utils/firebaseSync';
import { generateId } from '../utils/idGenerator';

interface UseProdutoHandlersParams {
  database: KlabinDatabase;
  mutateDatabase: (updater: (prev: KlabinDatabase) => KlabinDatabase) => void;
  showToast: (msg: string) => void;
}

/**
 * CRUD handlers for the Produtos catalog.
 *
 * Takes the whole `database` rather than just the Produtos slice: deleting a product
 * checks Cargas and Vendas for existing references, and soft-deletes (INACTIVE) instead
 * of removing when any history exists.
 *
 * `Produtos` is owned exclusively here — the generic `RecordModal` (App.tsx's
 * `handleSaveRecord`) only ever renders Carga/Depósito forms and never targets this
 * collection.
 */
export function useProdutoHandlers({
  database,
  mutateDatabase,
  showToast,
}: UseProdutoHandlersParams) {
  const handleAddProduto = (prodData: Partial<ProdutoRecord>) => {
    const name = (prodData.name || '').trim();
    if (!name) {
      showToast('Erro de validação: Nome do produto é obrigatório.');
      return;
    }
    const newProd: ProdutoRecord = {
      id: generateId('p'),
      name,
      unitOfMeasure: prodData.unitOfMeasure || 'ton',
      referencePrice: Number(prodData.referencePrice) || 250,
      status: prodData.status || 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    mutateDatabase((prev) => ({
      ...prev,
      Produtos: [...(prev.Produtos || []), newProd],
    }));
    upsertFirestoreRecord('produtos', newProd);
    showToast(`Produto ${newProd.name} cadastrado com sucesso.`);
  };

  const handleUpdateProduto = (updatedProd: ProdutoRecord) => {
    mutateDatabase((prev) => ({
      ...prev,
      Produtos: (prev.Produtos || []).map((p) => (p.id === updatedProd.id ? updatedProd : p)),
    }));
    upsertFirestoreRecord('produtos', updatedProd);
    showToast(`Produto ${updatedProd.name} atualizado.`);
  };

  const handleDeleteProduto = (prodId: string) => {
    const targetProd = (database.Produtos || []).find((p) => p.id === prodId);
    if (!targetProd) return;

    const prodNameLower = targetProd.name.trim().toLowerCase();
    const hasCargas = (database.Cargas || []).some(
      (c) => c.productId === prodId || (c.product && c.product.trim().toLowerCase() === prodNameLower)
    );
    const hasVendas = (database.Vendas || []).some(
      (v) => v.productId === prodId || (v.product && v.product.trim().toLowerCase() === prodNameLower)
    );

    if (hasCargas || hasVendas) {
      const inactivated: ProdutoRecord = {
        ...targetProd,
        status: 'INACTIVE',
      };
      mutateDatabase((prev) => ({
        ...prev,
        Produtos: (prev.Produtos || []).map((p) => (p.id === prodId ? inactivated : p)),
      }));
      upsertFirestoreRecord('produtos', inactivated);
      showToast(`Produto ${targetProd.name} possui histórico e foi desativado (INATIVO) para preservar os registros.`);
    } else {
      mutateDatabase((prev) => ({
        ...prev,
        Produtos: (prev.Produtos || []).filter((p) => p.id !== prodId),
      }));
      deleteFirestoreRecord('produtos', prodId);
      showToast(`Produto ${targetProd.name} removido do catálogo.`);
    }
  };

  return { handleAddProduto, handleUpdateProduto, handleDeleteProduto };
}

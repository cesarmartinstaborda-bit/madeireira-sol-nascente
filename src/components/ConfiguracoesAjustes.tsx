import React, { useState, useEffect } from 'react';
import { CargaRecord, ProductDefault, KlabinDatabase } from '../types';
import { TableCargas } from './TableCargas';
import { Settings, Tag, Plus, Save, Trash2, ShieldAlert, CheckCircle2, Truck, Database, RotateCcw, Download, History, HardDrive } from 'lucide-react';
import { formatBRL } from '../utils/formatters';
import { generateId } from '../utils/idGenerator';
import { getAutoBackups, validateAndSanitizeBackupJSON, exportDatabaseJSON, AutoBackupEntry } from '../utils/storage';

interface ConfiguracoesAjustesProps {
  productCatalog: ProductDefault[];
  onUpdateProductCatalog: (catalog: ProductDefault[]) => void;
  cargasRecords: CargaRecord[];
  onUpdateCargaRecord: (record: CargaRecord) => void;
  onDeleteCargaRecord: (id: string) => void;
  onAddCargaRecord: () => void;
  freightRatePerTon?: number;
  onUpdateFreightRatePerTon?: (rate: number) => void;
  onRestoreBackup?: (backupData: KlabinDatabase) => void;
}

export const ConfiguracoesAjustes: React.FC<ConfiguracoesAjustesProps> = ({
  productCatalog,
  onUpdateProductCatalog,
  cargasRecords,
  onUpdateCargaRecord,
  onDeleteCargaRecord,
  onAddCargaRecord,
  freightRatePerTon = 15,
  onUpdateFreightRatePerTon,
  onRestoreBackup,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState<number>(200);
  const [newProdDesc, setNewProdDesc] = useState('');
  const [showAddProd, setShowAddProd] = useState(false);
  const [localFreightRate, setLocalFreightRate] = useState<number>(freightRatePerTon);
  const [freightRateSaved, setFreightRateSaved] = useState(false);

  const [autoBackups, setAutoBackups] = useState<AutoBackupEntry[]>([]);
  const [restoreFeedback, setRestoreFeedback] = useState<string | null>(null);

  // Load auto backups on mount or change
  useEffect(() => {
    setAutoBackups(getAutoBackups());
  }, []);

  const handleRestoreClick = (backup: AutoBackupEntry) => {
    const result = validateAndSanitizeBackupJSON(backup.data);
    if (!result.isValid || !result.sanitizedDb) {
      alert(`O backup selecionado (${backup.filename}) é inválido ou está corrompido: ${result.errorMessage || 'Erro desconhecido.'}`);
      return;
    }

    const confirmMessage = `Deseja restaurar o backup "${backup.filename}"?\n\nTodos os dados atuais serão substituídos pelas informações deste ponto de restauração (${new Date(backup.timestamp).toLocaleString('pt-BR')}).`;

    if (window.confirm(confirmMessage)) {
      if (onRestoreBackup) {
        onRestoreBackup(result.sanitizedDb);
        setRestoreFeedback(`Backup "${backup.filename}" restaurado com sucesso!`);
        setTimeout(() => setRestoreFeedback(null), 4000);
        setAutoBackups(getAutoBackups());
      }
    }
  };

  const handleDownloadBackupFile = (backup: AutoBackupEntry) => {
    exportDatabaseJSON(backup.data);
  };

  const handleSaveFreightRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateFreightRatePerTon) {
      onUpdateFreightRatePerTon(Number(localFreightRate) || 15);
      setFreightRateSaved(true);
      setTimeout(() => setFreightRateSaved(false), 3000);
    }
  };

  // Handle product price change in catalog
  const handlePriceChange = (id: string, newPrice: number) => {
    const updated = productCatalog.map((p) =>
      p.id === id ? { ...p, defaultPricePerTon: newPrice } : p
    );
    onUpdateProductCatalog(updated);
  };

  // Handle product name change
  const handleNameChange = (id: string, newName: string) => {
    const updated = productCatalog.map((p) =>
      p.id === id ? { ...p, name: newName } : p
    );
    onUpdateProductCatalog(updated);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add new product
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = newProdName.trim();
    if (!trimmedName) return;

    setIsSubmitting(true);
    try {
      const newProd: ProductDefault = {
        id: generateId('prod'),
        name: trimmedName,
        defaultPricePerTon: Number(newProdPrice) || 0,
        description: newProdDesc.trim() || 'Produto florestal cadastrado',
      };
      onUpdateProductCatalog([...productCatalog, newProd]);
      setNewProdName('');
      setNewProdPrice(200);
      setNewProdDesc('');
      setShowAddProd(false);
    } finally {
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  // Delete product from catalog
  const handleDeleteProduct = (id: string) => {
    const updated = productCatalog.filter((p) => p.id !== id);
    onUpdateProductCatalog(updated);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="glass-card p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 tracking-tight">Configurações & Ajustes do Sistema</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl text-xs text-amber-300 font-medium">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Edições retroativas nesta tela atualizam todos os saldos e indicadores em tempo real.</span>
        </div>
      </div>

      {/* SECTION 0: GLOBAL FREIGHT RATE CONFIGURATION */}
      <div className="glass-card p-5 rounded-2xl border border-white/[0.08]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 shrink-0 mt-0.5">
              <Truck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-100 tracking-tight">
                Tarifa Padrão de Frete (R$ / Tonelada)
              </h3>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                Valor utilizado no cálculo automático dos custos de frete nas operações de Cargas e Vendas.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveFreightRate} className="flex items-center gap-3 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.08] shrink-0">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Valor (R$ / Ton)
              </label>
              <div className="flex items-center space-x-1.5 bg-white/[0.04] px-2.5 py-1 rounded-lg text-slate-100 border border-white/[0.08]">
                <span className="text-slate-400 font-mono text-xs font-bold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={localFreightRate}
                  onChange={(e) => setLocalFreightRate(Number(e.target.value))}
                  className="w-20 text-xs font-mono font-extrabold focus:outline-none text-slate-100 bg-transparent"
                />
              </div>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="submit"
                className="mt-3.5 mac-button-primary px-3.5 py-1.5 font-bold text-xs flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Tarifa</span>
              </button>
            </div>
          </form>
        </div>

        {freightRateSaved && (
          <div className="mt-3 text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Tarifa global de frete atualizada para {formatBRL(localFreightRate)} / ton!</span>
          </div>
        )}
      </div>

      {/* SECTION AUTO-BACKUP: COPIAS DE SEGURANCA E RESTAURACAO */}
      <div className="glass-card overflow-hidden p-5 rounded-2xl border border-white/[0.08] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.07] pb-3.5">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Database className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Cópias de Segurança Automáticas (Backups)</h3>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium bg-white/[0.04] text-slate-300 px-3 py-1 rounded-lg border border-white/[0.08]">
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>{autoBackups.length} / 10 cópias mantidas</span>
          </div>
        </div>

        {restoreFeedback && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{restoreFeedback}</span>
          </div>
        )}

        {autoBackups.length === 0 ? (
          <div className="p-8 text-center bg-white/[0.02] rounded-xl border border-dashed border-white/[0.08]">
            <HardDrive className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">Nenhum backup automático gerado ainda.</p>
            <p className="text-[11px] text-slate-500 mt-0.5">As cópias serão criadas automaticamente conforme você salva dados no sistema.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-3">Arquivo de Backup</th>
                  <th className="py-2.5 px-3">Data e Hora da Criação</th>
                  <th className="py-2.5 px-3">Resumo dos Dados</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {autoBackups.map((backup, idx) => {
                  const cargasCount = backup.data.Cargas?.length || 0;
                  const depositosCount = backup.data.Depositos_Klabin?.length || 0;
                  const vendasCount = backup.data.Vendas?.length || 0;

                  return (
                    <tr key={backup.filename + idx} className="mac-table-row">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-100 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>{backup.filename}</span>
                          {idx === 0 && (
                            <span className="text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.2 rounded-full font-sans font-bold">Mais Recente</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(backup.timestamp).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        <span className="bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded text-slate-300 font-medium">
                          {cargasCount} Carga(s) | {depositosCount} Depósito(s) | {vendasCount} Venda(s)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadBackupFile(backup)}
                            className="mac-button-secondary px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1"
                            title="Baixar arquivo JSON deste backup"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Baixar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestoreClick(backup)}
                            className="mac-button-primary px-3 py-1 font-bold text-[11px] flex items-center gap-1"
                            title="Restaurar o aplicativo com estes dados"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restaurar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION A: PRODUCT CATALOG & DEFAULT PRICES */}
      <div className="glass-card overflow-hidden rounded-2xl border border-white/[0.08]">
        <div className="p-4 border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-3 bg-white/[0.02]">
          <div>
            <div className="flex items-center space-x-2">
              <Tag className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-slate-100 text-sm">Catálogo de Produtos & Preços Padrão</h3>
            </div>
          </div>

          <button
            onClick={() => setShowAddProd(!showAddProd)}
            className="mac-button-primary px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Novo Produto</span>
          </button>
        </div>

        {/* Add Product Form Collapse */}
        {showAddProd && (
          <form onSubmit={handleAddProduct} className="p-4 bg-white/[0.02] border-b border-white/[0.07] grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1">Nome do Produto</label>
              <input
                type="text"
                required
                placeholder="Ex: Pinus Elliottii"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                className="mac-input w-full"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1">Preço Padrão / Ton (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newProdPrice}
                onChange={(e) => setNewProdPrice(Number(e.target.value))}
                className="mac-input w-full font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-300 mb-1">Descrição do Produto</label>
              <input
                type="text"
                placeholder="Detalhes ou finalidade"
                value={newProdDesc}
                onChange={(e) => setNewProdDesc(e.target.value)}
                className="mac-input w-full"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="w-full py-1.5 mac-button-primary font-bold text-xs"
              >
                Salvar Produto
              </button>
              <button
                type="button"
                onClick={() => setShowAddProd(false)}
                className="py-1.5 px-3 mac-button-secondary font-bold text-xs"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Product Catalog Grid Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="mac-table-header">
                <th className="py-2.5 px-3 w-48">Produto</th>
                <th className="py-2.5 px-3 w-48">Preço Padrão / Ton (R$)</th>
                <th className="py-2.5 px-3">Descrição / Aplicação</th>
                <th className="py-2.5 px-3 text-center w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {productCatalog.map((prod) => (
                <tr key={prod.id} className="mac-table-row">
                  <td className="py-2.5 px-3 font-bold text-slate-100 whitespace-nowrap">
                    <input
                      type="text"
                      value={prod.name}
                      onChange={(e) => handleNameChange(prod.id, e.target.value)}
                      className="mac-input w-full font-bold text-slate-100 py-0.5 px-2"
                    />
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-mono">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={prod.defaultPricePerTon}
                        onChange={(e) => handlePriceChange(prod.id, Number(e.target.value))}
                        className="w-28 mac-input font-mono font-bold text-slate-100 text-xs py-0.5 px-2"
                      />
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 font-medium">
                    {prod.description || 'Produto para comercialização e fornecimento Klabin'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(prod.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                      title="Excluir produto do catálogo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION B: GLOBAL LOG & HISTORICAL DATA GRID */}
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 tracking-tight">
              Log Geral de Histórico & Auditoria Retroativa
            </h3>
          </div>

          <div className="w-72">
            <input
              type="text"
              placeholder="Buscar por NF, fornecedor, placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mac-input w-full py-1 text-xs"
            />
          </div>
        </div>

        {/* Embedded TableCargas Data Grid */}
        <TableCargas
          records={cargasRecords}
          searchTerm={searchTerm}
          onDelete={onDeleteCargaRecord}
          onAdd={onAddCargaRecord}
          onUpdateRecord={onUpdateCargaRecord}
          productCatalog={productCatalog}
        />
      </div>
    </div>
  );
};

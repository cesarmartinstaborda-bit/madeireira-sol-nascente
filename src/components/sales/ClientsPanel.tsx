import { Edit2, Plus, Trash2, UserCheck } from 'lucide-react';
import type { useSalesController } from './useSalesController';

type Props = {
  model: Pick<ReturnType<typeof useSalesController>,
    'activeSubTab'
    | 'openClientModal'
    | 'clientes'
    | 'onDeleteClient'
  >;
};

export function ClientsPanel({ model }: Props) {
  const { activeSubTab, openClientModal, clientes, onDeleteClient } = model;
  return <>{activeSubTab === 'CLIENTS' && (
        <div className="glass-card-static overflow-hidden">
          <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-blue-400" />
              <span>Clientes Cadastrados</span>
            </h2>
            <button
              onClick={() => openClientModal()}
              className="mac-button-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Cliente</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-3">Nome / Razão Social</th>
                  <th className="py-2.5 px-3">Contato / Telefone</th>
                  <th className="py-2.5 px-3">Observações</th>
                  <th className="py-2.5 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-slate-300">
                {clientes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500 font-medium">
                      Nenhum cliente cadastrado.
                    </td>
                  </tr>
                ) : (
                  clientes.map((c) => (
                    <tr key={c.id} className="mac-table-row">
                      <td className="py-2.5 px-3 font-semibold text-white">{c.name}</td>
                      <td className="py-2.5 px-3 text-slate-300">{c.contact || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-400">{c.notes || '-'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => openClientModal(c)}
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-[var(--graphite-surface-2)] rounded-md transition-all"
                            title="Editar cliente"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteClient(c.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-all"
                            title="Excluir cliente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}</>;
}

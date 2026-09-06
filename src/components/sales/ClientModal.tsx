import { createPortal } from 'react-dom';
import type { useSalesController } from './useSalesController';

type Props = {
  model: Pick<ReturnType<typeof useSalesController>,
    'showClientModal'
    | 'editingClient'
    | 'handleSaveClientModal'
    | 'clientName'
    | 'setClientName'
    | 'clientContact'
    | 'setClientContact'
    | 'clientNotes'
    | 'setClientNotes'
    | 'setShowClientModal'
  >;
};

export function ClientModal({ model }: Props) {
  const {
    showClientModal,
    editingClient,
    handleSaveClientModal,
    clientName,
    setClientName,
    clientContact,
    setClientContact,
    clientNotes,
    setClientNotes,
    setShowClientModal,
  } = model;
  return <>{showClientModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#181c23] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--graphite-border-base)] max-h-[90vh] overflow-y-auto my-auto">
            <h3 className="text-base font-bold text-white mb-4">
              {editingClient ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
            </h3>
            <form onSubmit={handleSaveClientModal} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome / Razão Social *</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Madeireira Vale do Sol"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Contato / Telefone</label>
                <input
                  type="text"
                  value={clientContact}
                  onChange={(e) => setClientContact(e.target.value)}
                  placeholder="Ex: (42) 99911-2233"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="Anotações sobre faturamento ou prazos"
                  className="w-full px-3 py-2 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-[var(--graphite-border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="mac-button-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="mac-button-primary"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}</>;
}

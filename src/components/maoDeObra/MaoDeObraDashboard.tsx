import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Clock, Scale, Settings2, Wallet } from 'lucide-react';
import { MaoDeObraClienteRecord, MaoDeObraLancamentoRecord, MaoDeObraProdutoRecord } from '../../types';
import { MaoDeObraLancamentoInput } from '../../hooks/useMaoDeObraHandlers';
import { sortByDateDescending } from '../../utils/dateSorting';
import { formatBRL } from '../../utils/formatters';
import { formatTons, splitMaoDeObraLancamentos, sumMaoDeObra } from '../../utils/maoDeObra';
import { ConfirmModal } from '../ConfirmModal';
import { CadastroPanel } from './CadastroPanel';
import { LancamentoForm } from './LancamentoForm';
import { LancamentosTable } from './LancamentosTable';

type MaoDeObraTab = 'PRINCIPAL' | 'QUITADOS' | 'CADASTRO';

type PendingDelete =
  | { kind: 'lancamento'; record: MaoDeObraLancamentoRecord }
  | { kind: 'cliente'; record: MaoDeObraClienteRecord }
  | { kind: 'produto'; record: MaoDeObraProdutoRecord };

interface MaoDeObraDashboardProps {
  lancamentos: MaoDeObraLancamentoRecord[];
  clientes: MaoDeObraClienteRecord[];
  produtos: MaoDeObraProdutoRecord[];
  isDateLocked: (dateStr?: string) => boolean;
  onSaveLancamento: (input: MaoDeObraLancamentoInput, editingId?: string) => boolean;
  onDeleteLancamento: (id: string) => void;
  onSetLancamentoStatus: (id: string, status: 'PENDING' | 'PAID') => void;
  onSaveCliente: (name: string, editingId?: string) => void;
  onDeleteCliente: (id: string) => void;
  onSaveProduto: (name: string, pricePerTon: number | null, editingId?: string) => void;
  onDeleteProduto: (id: string) => void;
}

const SummaryCard: React.FC<{ label: string; value: string; hint?: string; icon: React.ReactNode; tone: string }> = ({ label, value, hint, icon, tone }) => (
  <div className="glass-card p-4 flex items-center space-x-3">
    <div className={`p-2.5 bg-[#232832] ${tone} rounded-xl border border-[var(--graphite-border-subtle)]`}>{icon}</div>
    <div>
      <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">{label}</span>
      <span className={`text-lg font-bold font-mono ${tone}`}>{value}</span>
      {hint && <span className="text-[11px] text-slate-500 block">{hint}</span>}
    </div>
  </div>
);

export const MaoDeObraDashboard: React.FC<MaoDeObraDashboardProps> = (props) => {
  const { lancamentos, clientes, produtos, isDateLocked } = props;
  const [activeTab, setActiveTab] = useState<MaoDeObraTab>('PRINCIPAL');
  const [editing, setEditing] = useState<MaoDeObraLancamentoRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const { pending, paid } = useMemo(() => {
    const split = splitMaoDeObraLancamentos(lancamentos);
    const byDate = (list: MaoDeObraLancamentoRecord[]) => sortByDateDescending(list, (l) => l.date, (l) => l.createdAt);
    return { pending: byDate(split.pending), paid: byDate(split.paid) };
  }, [lancamentos]);

  const isPaidTab = activeTab === 'QUITADOS';
  const totals = sumMaoDeObra(isPaidTab ? paid : pending);
  const situation = isPaidTab ? 'quitado' : 'pendente';

  const confirmDelete = () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    if (target.kind === 'lancamento') props.onDeleteLancamento(target.record.id);
    else if (target.kind === 'cliente') props.onDeleteCliente(target.record.id);
    else props.onDeleteProduto(target.record.id);
  };

  const deleteTitle = pendingDelete?.kind === 'lancamento' ? 'Excluir Lançamento' : pendingDelete?.kind === 'cliente' ? 'Excluir Cliente' : 'Excluir Produto';
  const deleteMessage = !pendingDelete
    ? ''
    : pendingDelete.kind === 'lancamento'
      ? 'Tem certeza de que deseja excluir este lançamento de mão de obra? Esta ação será sincronizada.'
      : `Tem certeza de que deseja excluir "${pendingDelete.record.name}" do cadastro? Os lançamentos já registrados mantêm o nome gravado.`;

  const tabButton = (tab: MaoDeObraTab, icon: React.ReactNode, text: string) => (
    <button onClick={() => setActiveTab(tab)} className={`mac-segmented-item ${activeTab === tab ? 'mac-segmented-item-active' : ''}`}>
      {icon}
      <span>{text}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--graphite-border-subtle)] pb-4">
        <div className="mac-segmented-control">
          {tabButton('PRINCIPAL', <Clock className="w-3.5 h-3.5" />, `Principal (${pending.length})`)}
          {tabButton('QUITADOS', <CheckCircle2 className="w-3.5 h-3.5" />, `Quitados (${paid.length})`)}
          {tabButton('CADASTRO', <Settings2 className="w-3.5 h-3.5" />, 'Cadastro')}
        </div>
        <div className="hidden sm:block text-xs text-[var(--graphite-text-secondary)] font-medium">Módulo Mão de Obra</div>
      </div>

      {activeTab === 'CADASTRO' ? (
        <CadastroPanel
          clientes={clientes}
          produtos={produtos}
          onSaveCliente={props.onSaveCliente}
          onDeleteCliente={(record) => setPendingDelete({ kind: 'cliente', record })}
          onSaveProduto={props.onSaveProduto}
          onDeleteProduto={(record) => setPendingDelete({ kind: 'produto', record })}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label={`Totais ${isPaidTab ? 'quitados' : 'pendentes'}`}>
            <SummaryCard
              label={`Toneladas ${isPaidTab ? 'quitadas' : 'pendentes'}`}
              value={`${formatTons(totals.tons)} t`}
              icon={<Scale className="w-5 h-5" />}
              tone="text-blue-400"
            />
            <SummaryCard
              label={`Valor ${situation} conhecido`}
              value={formatBRL(totals.value)}
              hint={totals.withoutValue > 0 ? `${totals.withoutValue} lançamento(s) sem valor informado` : undefined}
              icon={<Wallet className="w-5 h-5" />}
              tone={isPaidTab ? 'text-emerald-400' : 'text-amber-400'}
            />
          </div>

          {!isPaidTab && (
            <div className="glass-card-static p-4">
              <LancamentoForm clientes={clientes} produtos={produtos} onSubmit={(input) => props.onSaveLancamento(input)} />
            </div>
          )}

          <LancamentosTable
            title={isPaidTab ? 'Lançamentos Quitados' : 'Lançamentos Pendentes'}
            records={isPaidTab ? paid : pending}
            clientes={clientes}
            produtos={produtos}
            paidView={isPaidTab}
            isDateLocked={isDateLocked}
            onSetStatus={props.onSetLancamentoStatus}
            onEdit={isPaidTab ? undefined : setEditing}
            onDelete={isPaidTab ? undefined : (record) => setPendingDelete({ kind: 'lancamento', record })}
          />
        </div>
      )}

      {editing && createPortal(
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#181c23] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--graphite-border-base)] max-h-[90vh] overflow-y-auto my-auto">
            <h3 className="text-base font-bold text-white mb-4">Editar Lançamento de Mão de Obra</h3>
            <LancamentoForm
              clientes={clientes}
              produtos={produtos}
              record={editing}
              onCancel={() => setEditing(null)}
              onSubmit={(input) => {
                const saved = props.onSaveLancamento(input, editing.id);
                if (saved) setEditing(null);
                return saved;
              }}
            />
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={pendingDelete !== null}
        title={deleteTitle}
        message={deleteMessage}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

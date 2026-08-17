import React from 'react';
import { CaixaRecord } from '../types';
import { formatBRL } from '../utils/formatters';
import { Wallet, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';

interface TableCaixaProps {
  records: CaixaRecord[];
  searchTerm: string;
}

export const TableCaixa: React.FC<TableCaixaProps> = ({
  records,
  searchTerm,
}) => {
  const filtered = records.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      !term ||
      r.balanceControlKlabin.toLowerCase().includes(term) ||
      r.value.toString().includes(term)
    );
  });

  // Financial sums
  const totalEntradas = filtered
    .filter((r) => r.value > 0)
    .reduce((acc, r) => acc + Number(r.value), 0);
  const totalSaidas = filtered
    .filter((r) => r.value < 0)
    .reduce((acc, r) => acc + Math.abs(Number(r.value)), 0);
  const saldoLiquidoCaixa = totalEntradas - totalSaidas;

  return (
    <div className="space-y-4">
      {/* KPI Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Saldo em Caixa Operacional</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${saldoLiquidoCaixa < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {formatBRL(saldoLiquidoCaixa)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Saldo final conciliado Klabin</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Wallet className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Entradas / Créditos</p>
            <p className="text-xl font-bold font-mono text-slate-100 mt-1">{formatBRL(totalEntradas)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Adiantamentos & Depósitos</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <ArrowUpRight className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Saídas / Abatimentos</p>
            <p className="text-xl font-bold font-mono text-slate-100 mt-1">{formatBRL(totalSaidas)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Cargas com Abatimento Aprovado</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <ArrowDownRight className="w-4.5 h-4.5" />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="mac-table-container">
        <div className="p-3.5 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 text-xs">Tabela de Caixa (Controle de Saldo Klabin)</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full uppercase tracking-wider">
                <Zap className="w-3 h-3 text-blue-400" /> Conciliação Dinâmica
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono bg-white/[0.04] text-slate-300 border border-white/[0.08] px-2.5 py-0.5 rounded-full font-semibold">
              {filtered.length} Lançamentos Ativos
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">Nenhum lançamento no caixa</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="mac-table-header">
                  <th className="py-2.5 px-4">Controle de Saldo Klabin (Descrição)</th>
                  <th className="py-2.5 px-4 text-center w-32">Tipo</th>
                  <th className="py-2.5 px-4 text-right w-48">Valor (R$)</th>
                  <th className="py-2.5 px-4 text-center w-32">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((item) => {
                  const isCredit = item.value >= 0;
                  return (
                    <tr key={item.id} className="mac-table-row">
                      <td className="py-2.5 px-4 font-semibold text-slate-100">
                        {item.balanceControlKlabin}
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCredit
                              ? 'badge-emerald'
                              : 'badge-amber'
                          }`}
                        >
                          {isCredit ? (
                            <>
                              <ArrowUpRight className="w-3 h-3 text-emerald-400" /> Crédito
                            </>
                          ) : (
                            <>
                              <ArrowDownRight className="w-3 h-3 text-amber-400" /> Débito
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-xs whitespace-nowrap text-slate-100">
                        {formatBRL(item.value)}
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 bg-white/[0.04] text-slate-400 rounded-full text-[10px] font-semibold uppercase tracking-wider border border-white/[0.08]">
                          Conciliado
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

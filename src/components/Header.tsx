import React from 'react';
import { TableType } from '../types';
import { Search, Plus, Download, RefreshCw, Sun, Moon, Sparkles } from 'lucide-react';
import { DEFAULT_COMPANY_LOGO } from '../utils/logoAsset';

interface HeaderProps {
  activeTable: TableType;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onAddRecord: () => void;
  onExportCSV: () => void;
  onSyncMetrics?: () => void;
  onOpenAIFill?: () => void;
  klabinBalance: number;
  customLogo?: string;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

const tableTitles: Record<TableType, { title: string; subtitle: string; icon: string }> = {
  Dashboard: {
    title: 'Painel Consolidado',
    subtitle: 'Resumo de controle de cargas de madeira, fretes e fluxo de caixa',
    icon: '📊',
  },
  Klabin: {
    title: 'Módulo Klabin',
    subtitle: 'Gestão de Cargas de Madeira e Depósitos Financeiros Klabin',
    icon: '🌲',
  },
  Cargas: {
    title: 'Tabela: Cargas',
    subtitle: 'Registro de compra de madeira, notas fiscais, placas e abatimentos',
    icon: '📦',
  },
  Motoristas: {
    title: 'Gestão de Motoristas',
    subtitle: 'Agrupamento e consolidação do custo de fretes por Motorista e Placa (R$ 15,00/ton)',
    icon: '🚚',
  },
  Depositos_Klabin: {
    title: 'Tabela: Depósitos Klabin',
    subtitle: 'Histórico de aportes e adiantamentos financeiros da Klabin S.A.',
    icon: '🏦',
  },
  Resumo: {
    title: 'Tabela: Resumo de Métricas',
    subtitle: 'Consolidado de métricas e indicadores chave de desempenho',
    icon: '📈',
  },
  Caixa: {
    title: 'Tabela: Caixa Operacional',
    subtitle: 'Controle de saldo Klabin, conciliação e fluxo financeiro',
    icon: '💰',
  },
  Configuracoes: {
    title: 'Configurações e Ajustes',
    subtitle: 'Gestão de Tabela de Preços Padrão e Auditoria Histórica Completa',
    icon: '⚙️',
  },
  Clientes_Produtos: {
    title: 'Clientes & Produtos',
    subtitle: 'Gestão Unificada de Clientes, Vendas a Receber e Cadastro de Produtos',
    icon: '👥',
  },
  Gestao_Clientes: {
    title: 'Clientes & Produtos',
    subtitle: 'Gestão Unificada de Clientes, Vendas a Receber e Cadastro de Produtos',
    icon: '👥',
  },
  Vendas: {
    title: 'Tabela de Vendas',
    subtitle: 'Lançamento e Acompanhamento de Vendas Diretas de Madeira e Biomassa',
    icon: '🛍️',
  },
  Produtos: {
    title: 'Catálogo de Produtos',
    subtitle: 'Gerenciamento de Produtos Dinâmicos, Preços de Referência e Status',
    icon: '🏷️',
  },
};

export const Header: React.FC<HeaderProps> = ({
  activeTable,
  searchTerm,
  onSearchChange,
  onAddRecord,
  onExportCSV,
  onSyncMetrics,
  onOpenAIFill,
  klabinBalance,
  customLogo,
  theme = 'dark',
  onToggleTheme,
}) => {
  const currentInfo = tableTitles[activeTable];
  const logoSrc = customLogo || DEFAULT_COMPANY_LOGO;

  return (
    <header className="mac-toolbar sticky top-0 z-10 px-6 py-3 border-b border-white/[0.07] select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        {/* Title & Brand Section */}
        <div className="flex items-center space-x-3">
          <div className="shrink-0 flex items-center justify-center p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <img
              src={logoSrc}
              alt="Madeireira Sol Nascente"
              className="max-h-8 h-8 w-auto object-contain rounded-md"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-300 tracking-tight">Madeireira Sol Nascente</span>
              <span className="text-slate-600 font-light">/</span>
              <span className="text-xs font-semibold text-slate-100 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <span className="text-sm">{currentInfo.icon}</span>
                <span>{currentInfo.title}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Section / Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Theme Toggle Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 hover:text-slate-200 transition-all active:scale-[0.96]"
              title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro (padrão)'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
              ) : (
                <Moon className="w-4 h-4 text-blue-400" strokeWidth={1.75} />
              )}
            </button>
          )}

          {/* Klabin Balance Quick Widget */}
          <div className="hidden lg:flex items-center space-x-2 glass-pill px-3 py-1.5 rounded-xl text-xs font-medium border border-white/[0.08] shadow-2xs">
            <span className="text-slate-400 font-medium">Saldo Livre Klabin:</span>
            <span className={`font-semibold font-mono tabular-nums ${klabinBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(klabinBalance)}
            </span>
          </div>

          {/* Table Search Box */}
          {activeTable !== 'Dashboard' && (
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
              <input
                type="text"
                placeholder={`Buscar em ${activeTable}...`}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs mac-input"
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 px-1"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Toolbar Actions */}
          <div className="flex items-center gap-2">
            {onOpenAIFill && activeTable === 'Dashboard' && (
              <button
                onClick={onOpenAIFill}
                className="mac-button-secondary text-xs px-3 py-1.5 flex items-center space-x-1.5 border-blue-500/25 hover:border-blue-500/40 text-blue-300"
                title="Preencher campos automaticamente analisando foto ou PDF com Gemini IA"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Preencher com IA</span>
              </button>
            )}

            {activeTable !== 'Dashboard' && (
              <>
                <button
                  onClick={onExportCSV}
                  className="mac-button-secondary flex items-center space-x-1.5 px-3 py-1.5 text-xs"
                  title="Exportar registros desta tabela para CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                  <span className="hidden sm:inline">CSV</span>
                </button>

                {activeTable === 'Resumo' && onSyncMetrics && (
                  <button
                    onClick={onSyncMetrics}
                    className="mac-button-secondary flex items-center space-x-1.5 px-3 py-1.5 text-xs"
                    title="Recalcular e sincronizar dados com base nas outras tabelas"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                    <span>Sincronizar</span>
                  </button>
                )}

                <button
                  onClick={onAddRecord}
                  className="mac-button-primary flex items-center space-x-1.5 px-3.5 py-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Adicionar</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

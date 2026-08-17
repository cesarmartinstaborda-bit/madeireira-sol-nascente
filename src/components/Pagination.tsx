import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 250, 500],
}) => {
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 pb-2 px-3 border-t border-white/[0.07] text-xs text-slate-400 font-medium select-none">
      {/* Items Count & Page Size Selector */}
      <div className="flex items-center gap-3">
        <span>
          Mostrando <strong className="text-slate-200 font-mono">{formatNumber(startItem)}</strong> a{' '}
          <strong className="text-slate-200 font-mono">{formatNumber(endItem)}</strong> de{' '}
          <strong className="text-blue-400 font-mono">{formatNumber(totalItems)}</strong> registros
        </span>

        <div className="flex items-center gap-1.5 ml-2">
          <label htmlFor="pageSizeSelect" className="text-slate-400 text-[11px]">Exibir:</label>
          <select
            id="pageSizeSelect"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="mac-input py-0.5 px-2 text-xs font-semibold"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} linhas
              </option>
            ))}
            <option value={999999}>Todos ({formatNumber(totalItems)})</option>
          </select>
        </div>
      </div>

      {/* Page Navigation Buttons */}
      {totalPages > 1 && (
        <div className="flex items-center space-x-1.5">
          {/* First Page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-slate-300 disabled:opacity-30 disabled:hover:bg-white/[0.03] disabled:hover:text-slate-400 transition-all"
            title="Primeira Página"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-slate-300 disabled:opacity-30 disabled:hover:bg-white/[0.03] disabled:hover:text-slate-400 transition-all"
            title="Página Anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Current Page Indicator */}
          <div className="px-2.5 py-1 bg-blue-600/15 border border-blue-500/30 text-blue-400 rounded-lg font-mono font-bold text-xs flex items-center gap-1">
            <span>Pág.</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const page = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                onPageChange(page);
              }}
              className="w-9 text-center bg-white/10 border border-blue-500/30 rounded text-blue-300 font-bold p-0.5 focus:ring-1 focus:ring-blue-500/50"
            />
            <span className="text-slate-400 font-normal">de {totalPages}</span>
          </div>

          {/* Next Page */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-slate-300 disabled:opacity-30 disabled:hover:bg-white/[0.03] disabled:hover:text-slate-400 transition-all"
            title="Próxima Página"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-slate-300 disabled:opacity-30 disabled:hover:bg-white/[0.03] disabled:hover:text-slate-400 transition-all"
            title="Última Página"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

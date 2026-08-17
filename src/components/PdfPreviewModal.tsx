import React from 'react';
import { VendaRecord, ClientRecord } from '../types';
import { formatBRL, formatNumber, formatDate } from '../utils/formatters';
import { generateClientPdf } from '../utils/generateClientPdf';
import { DEFAULT_COMPANY_LOGO } from '../utils/logoAsset';
import { Download, Printer, X, FileText } from 'lucide-react';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientRecord | { name: string; contact?: string; notes?: string };
  vendas: VendaRecord[];
  companyLogo?: string;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  client,
  vendas,
  companyLogo = DEFAULT_COMPANY_LOGO,
}) => {
  if (!isOpen) return null;

  // Filter strictly PENDING sales
  const pendingVendas = vendas.filter((v) => v.status === 'PENDING');

  const totalTickets = pendingVendas.length;
  const totalWeight = pendingVendas.reduce((acc, v) => acc + (Number(v.quantity) || 0), 0);
  const totalAmount = pendingVendas.reduce((acc, v) => acc + (Number(v.totalValue) || 0), 0);

  const logoSrc = companyLogo || DEFAULT_COMPANY_LOGO;

  const handleDownloadPdf = () => {
    const doc = generateClientPdf({
      client,
      vendas: pendingVendas,
      companyLogo: logoSrc,
    });
    const sanitizedClientName = client.name.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Relatorio_${sanitizedClientName}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const todayStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto animate-in fade-in zoom-in-95 duration-150">
      <div className="relative w-full max-w-4xl mac-hud overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Modal Header Controls */}
        <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 tracking-tight">
                RELATÓRIO — {client.name}
              </h2>
              <p className="text-[11px] text-slate-400">
                Visualização do documento oficial de entregas e conferência
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadPdf}
              className="mac-button-primary text-xs px-3.5 py-1.5"
              title="Baixar em formato PDF"
            >
              <Download className="w-4 h-4" />
              <span>Baixar PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="mac-button-secondary text-xs px-3 py-1.5"
              title="Imprimir relatório"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body - Printable A4 Document Sheet */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-slate-900/60 flex justify-center">
          <div
            id="printable-a4-document"
            className="bg-white text-slate-900 w-full max-w-[210mm] min-h-[280mm] p-8 sm:p-10 shadow-2xl rounded-sm flex flex-col justify-between select-text text-xs border border-slate-200"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            <div>
              {/* DOCUMENT HEADER */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-300">
                <div className="flex items-center space-x-4">
                  <img
                    src={logoSrc}
                    alt="Madeireira Sol Nascente"
                    className="h-14 w-auto object-contain max-h-14"
                  />
                  <div>
                    <h1 className="text-lg font-bold text-[#1B4332] tracking-tight uppercase">
                      MADEIREIRA SOL NASCENTE
                    </h1>
                  </div>
                </div>
              </div>

              {/* DOCUMENT SUBTITLE & EMISSION */}
              <div className="py-2.5 mt-3 border-b border-slate-200 flex items-center justify-between font-bold text-xs">
                <span className="text-[#1B4332] text-sm uppercase">RELATÓRIO</span>
                <span className="font-normal text-slate-500 text-[11px]">Data de Emissão: {todayStr}</span>
              </div>

              {/* CLIENT INFORMATION BOX */}
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-sm">
                <p className="text-xs font-bold text-slate-900 uppercase">
                  CLIENTE: {client.name}
                </p>
              </div>

              {/* ENXUTO 7-COLUMN TABLE */}
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-[#1B4332] text-white font-bold text-[11px]">
                      <th className="py-2 px-2.5 border border-[#1B4332] text-center w-24">Data</th>
                      <th className="py-2 px-2.5 border border-[#1B4332] text-center w-28">Ticket</th>
                      <th className="py-2 px-2.5 border border-[#1B4332] text-center w-24">Placa</th>
                      <th className="py-2 px-2.5 border border-[#1B4332]">Produto</th>
                      <th className="py-2 px-2.5 border border-[#1B4332] text-right w-28">
                        Peso Líq. (ton)
                      </th>
                      <th className="py-2 px-2.5 border border-[#1B4332] text-right w-32">
                        Preço/Ton (R$)
                      </th>
                      <th className="py-2 px-2.5 border border-[#1B4332] text-right w-36">
                        Valor Total (R$)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {pendingVendas.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                          Nenhum lançamento pendente encontrado para este cliente.
                        </td>
                      </tr>
                    ) : (
                      pendingVendas.map((venda) => {
                        const ticketNo = venda.id ? `TK-${venda.id.slice(-6).toUpperCase()}` : 'PES-001';
                        const placaStr = venda.notes && venda.notes.toLowerCase().includes('placa') ? venda.notes : '-';

                        return (
                          <tr key={venda.id} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2.5 border border-slate-300 text-center font-mono">
                              {formatDate(venda.date)}
                            </td>
                            <td className="py-1.5 px-2.5 border border-slate-300 text-center font-mono text-slate-700">
                              {ticketNo}
                            </td>
                            <td className="py-1.5 px-2.5 border border-slate-300 text-center font-mono text-slate-600">
                              {placaStr}
                            </td>
                            <td className="py-1.5 px-2.5 border border-slate-300 font-medium text-slate-800">
                              {venda.product || 'Eucalipto'}
                            </td>
                            <td className="py-1.5 px-2.5 border border-slate-300 text-right font-mono">
                              {formatNumber(venda.quantity)}
                            </td>
                            <td className="py-1.5 px-2.5 border border-slate-300 text-right font-mono text-slate-700">
                              {formatBRL(venda.unitPrice)}
                            </td>
                            <td className="py-1.5 px-2.5 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                              {formatBRL(venda.totalValue)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {/* DISCRETE TOTAL ROW */}
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-400">
                      <td className="py-2 px-2.5 border border-slate-300 text-center">TOTAL</td>
                      <td className="py-2 px-2.5 border border-slate-300 text-center font-mono">{totalTickets} ticket(s)</td>
                      <td className="py-2 px-2.5 border border-slate-300 text-center">-</td>
                      <td className="py-2 px-2.5 border border-slate-300">-</td>
                      <td className="py-2 px-2.5 border border-slate-300 text-right font-mono">{formatNumber(totalWeight)}</td>
                      <td className="py-2 px-2.5 border border-slate-300 text-right">-</td>
                      <td className="py-2 px-2.5 border border-slate-300 text-right font-mono text-[#1B4332]">{formatBRL(totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* FOOTER NOTE */}
            <div className="mt-8 pt-4 border-t border-slate-200">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm space-y-1 text-slate-700">
                <p className="text-xs">Documento emitido para conferência de vendas e entregas realizadas.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

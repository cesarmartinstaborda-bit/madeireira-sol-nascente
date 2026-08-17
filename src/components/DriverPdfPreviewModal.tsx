import React from 'react';
import { CargaRecord } from '../types';
import { formatBRL, formatNumber, formatDate } from '../utils/formatters';
import { generateDriverPdf } from '../utils/generateDriverPdf';
import { DEFAULT_COMPANY_LOGO } from '../utils/logoAsset';
import { Download, Printer, X, FileText } from 'lucide-react';

interface DriverPdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverPlate: string;
  cargas: CargaRecord[];
  companyLogo?: string;
}

export const DriverPdfPreviewModal: React.FC<DriverPdfPreviewModalProps> = ({
  isOpen,
  onClose,
  driverPlate,
  cargas,
  companyLogo = DEFAULT_COMPANY_LOGO,
}) => {
  if (!isOpen) return null;

  // Filter pending freight items
  const pendingCargas = cargas.filter((c) => {
    const isPayable = c.freightPayable !== 'NO';
    const isPending = c.freightStatus !== 'PAID';
    return isPayable && isPending;
  });

  const totalTrips = pendingCargas.length;
  const totalTons = pendingCargas.reduce((acc, c) => acc + (Number(c.quantityTons) || 0), 0);
  const totalFreightCost = pendingCargas.reduce((acc, c) => {
    const cost = c.freightCost !== undefined ? Number(c.freightCost) : (Number(c.quantityTons) || 0) * 15;
    return acc + cost;
  }, 0);

  const logoSrc = companyLogo || DEFAULT_COMPANY_LOGO;

  const handleDownloadPdf = () => {
    const doc = generateDriverPdf({
      driverPlate,
      cargas: pendingCargas,
      companyLogo: logoSrc,
    });
    const sanitizedName = driverPlate.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Relatorio_Frete_${sanitizedName}_${new Date().toISOString().slice(0, 10)}.pdf`);
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
        {/* MODAL HEADER */}
        <div className="p-4 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-500/15 text-blue-400 rounded-xl border border-blue-500/25">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 tracking-tight">
                RELATÓRIO DE FRETES — {driverPlate}
              </h2>
              <p className="text-[11px] text-slate-400">
                Visualização do documento oficial de fretes a pagar
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
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] rounded-lg transition-colors ml-2"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE A4 CONTENT PREVIEW */}
        <div className="p-6 md:p-10 overflow-y-auto bg-slate-900/60 flex-1 print:bg-white print:p-0 print:overflow-visible">
          <div
            id="driver-pdf-content"
            className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white p-8 md:p-12 shadow-2xl border border-slate-300 rounded-sm text-slate-900 flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none"
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
                <span className="text-[#1B4332] text-sm uppercase">RELATÓRIO DE FRETES</span>
                <span className="font-normal text-slate-500 text-[11px]">Data de Emissão: {todayStr}</span>
              </div>

              {/* DRIVER / VEHICLE INFORMATION BOX */}
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-sm">
                <p className="text-xs font-bold text-slate-900 uppercase">
                  VEÍCULO / MOTORISTA: {driverPlate}
                </p>
              </div>

              {/* 6-COLUMN TABLE */}
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-[#1B4332] text-white font-bold text-[11px]">
                      <th className="py-2 px-2.5 border border-[#1B4332] text-center w-24">Data</th>
                      <th className="py-2 px-2.5 border border-[#1B4332] text-center w-28">Nº NF / Ticket</th>
                      <th className="py-2 px-2.5 border border-[#1B4332]">Fornecedor / Origem</th>
                      <th className="py-2 px-2.5 border border-[#1B4332]">Produto</th>
                      <th className="py-2 px-2.5 border border-[#1B4332] text-right w-28">
                        Qtd (ton)
                      </th>
                      <th className="py-2 px-2.5 border border-[#1B4332] text-right w-36">
                        Custo Frete (R$)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {pendingCargas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">
                          Nenhum frete pendente registrado para este motorista.
                        </td>
                      </tr>
                    ) : (
                      pendingCargas.map((carga) => {
                        const cost = carga.freightCost !== undefined ? Number(carga.freightCost) : (Number(carga.quantityTons) || 0) * 15;

                        return (
                          <tr key={carga.id} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2.5 border border-slate-300 text-center font-mono">
                              {formatDate(carga.date)}
                            </td>
                            <td className="py-1.5 px-2.5 border border-slate-300 text-center font-mono text-slate-700">
                              {carga.invoiceNumber || '-'}
                            </td>
                            <td className="py-1.5 px-2.5 border border-slate-300 text-slate-800">
                              {carga.supplier || '-'}
                            </td>
                            <td className="py-1.5 px-2.5 border border-slate-300 font-medium text-slate-800">
                              {carga.product || 'Madeira'}
                            </td>
                            <td className="py-1.5 px-2.5 border border-slate-300 text-right font-mono">
                              {formatNumber(carga.quantityTons)}
                            </td>
                            <td className="py-1.5 px-2.5 border border-slate-300 text-right font-mono font-semibold text-slate-900">
                              {formatBRL(cost)}
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
                      <td className="py-2 px-2.5 border border-slate-300 text-center font-mono">{totalTrips} carga(s)</td>
                      <td className="py-2 px-2.5 border border-slate-300">-</td>
                      <td className="py-2 px-2.5 border border-slate-300">-</td>
                      <td className="py-2 px-2.5 border border-slate-300 text-right font-mono">{formatNumber(totalTons)}</td>
                      <td className="py-2 px-2.5 border border-slate-300 text-right font-mono text-[#1B4332]">{formatBRL(totalFreightCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* FOOTER NOTE */}
            <div className="mt-8 pt-4 border-t border-slate-200">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm space-y-1 text-slate-700">
                <p className="text-xs">Documento emitido para conferência de fretes prestados.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

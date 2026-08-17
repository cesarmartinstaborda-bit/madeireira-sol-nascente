import React, { useRef, useState } from 'react';
import { TableType, KlabinDatabase } from '../types';
import { validateAndSanitizeBackupJSON } from '../utils/storage';
import { DEFAULT_COMPANY_LOGO } from '../utils/logoAsset';
import {
  Truck,
  Building2,
  LayoutDashboard,
  TreePine,
  Download,
  Upload,
  RotateCcw,
  FileSpreadsheet,
  Settings,
  Users,
} from 'lucide-react';

interface SidebarProps {
  activeTable: TableType;
  onSelectTable: (table: TableType) => void;
  counts: {
    Cargas: number;
    Depositos_Klabin: number;
    Resumo: number;
    Caixa: number;
    Clientes?: number;
    Vendas?: number;
    Produtos?: number;
    Motoristas?: number;
  };
  customLogo?: string;
  onUpdateCustomLogo?: (logoBase64: string | undefined) => void;
  onResetData: () => void;
  onExportBackup: () => void;
  onImportBackup: (importedData: KlabinDatabase) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTable,
  onSelectTable,
  counts,
  customLogo,
  onUpdateCustomLogo,
  onResetData,
  onExportBackup,
  onImportBackup,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState(false);

  const logoSrc = customLogo || DEFAULT_COMPANY_LOGO;

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Por favor selecione uma imagem com tamanho inferior a 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64 && onUpdateCustomLogo) {
        onUpdateCustomLogo(base64);
        setLogoError(false);
      }
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const result = validateAndSanitizeBackupJSON(parsed);
        if (!result.isValid || !result.sanitizedDb) {
          alert(`Erro na validação do Backup JSON: ${result.errorMessage || 'Formato inválido.'}`);
          return;
        }
        onImportBackup(result.sanitizedDb);
      } catch (err) {
        alert('Erro ao ler arquivo de backup JSON: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const navItems: {
    id: TableType;
    label: string;
    icon: React.ReactNode;
    count?: number;
    hasDividerAbove?: boolean;
  }[] = [
    {
      id: 'Dashboard',
      label: 'Painel Consolidado',
      icon: <LayoutDashboard className="w-4 h-4" strokeWidth={1.75} />,
    },
    {
      id: 'Klabin',
      label: 'Klabin',
      icon: <Building2 className="w-4 h-4" strokeWidth={1.75} />,
      count: (counts.Cargas || 0) + (counts.Depositos_Klabin || 0),
    },
    {
      id: 'Clientes_Produtos',
      label: 'Clientes & Produtos',
      icon: <Users className="w-4 h-4" strokeWidth={1.75} />,
      count: (counts.Clientes || 0) + (counts.Produtos || 0),
      hasDividerAbove: true,
    },
    {
      id: 'Motoristas',
      label: 'Gestão de Motoristas',
      icon: <Truck className="w-4 h-4" strokeWidth={1.75} />,
      count: counts.Motoristas || counts.Cargas,
      hasDividerAbove: true,
    },
    {
      id: 'Configuracoes',
      label: 'Configurações e Ajustes',
      icon: <Settings className="w-4 h-4" strokeWidth={1.75} />,
      count: counts.Cargas,
      hasDividerAbove: true,
    },
  ];

  return (
    <aside className="w-64 mac-sidebar flex flex-col justify-between h-screen sticky top-0 select-none z-20 flex-shrink-0">
      <div className="overflow-y-auto">
        {/* Brand Header */}
        <div className="p-3.5 border-b border-white/[0.07] bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div
              onClick={() => logoInputRef.current?.click()}
              className="relative group cursor-pointer shrink-0 flex items-center justify-center rounded-xl overflow-hidden transition-all hover:ring-2 hover:ring-blue-500/40 active:scale-95 border border-white/10 bg-white/[0.04] p-1 shadow-xs"
              title="Clique para alterar ou carregar a logo (PNG, JPG, SVG)"
            >
              {!logoError && logoSrc ? (
                <img
                  src={logoSrc}
                  alt="Madeireira Sol Nascente"
                  onError={() => setLogoError(true)}
                  className="max-h-8 h-8 w-auto object-contain rounded-lg"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shadow-xs">
                  <TreePine className="w-4.5 h-4.5" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold rounded-xl">
                <Upload className="w-3.5 h-3.5" />
              </div>
            </div>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleLogoFileChange}
              className="hidden"
            />

            <div className="min-w-0 flex-1">
              <span className="font-semibold text-xs text-slate-100 tracking-tight leading-tight block truncate">
                Madeireira Sol Nascente
              </span>
              <span className="text-[10px] text-slate-400 font-medium block truncate mt-0.5">
                Controle Operacional
              </span>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <div className="py-2.5 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive =
              activeTable === item.id ||
              (item.id === 'Clientes_Produtos' &&
                (activeTable === 'Gestao_Clientes' || activeTable === 'Produtos' || activeTable === 'Vendas'));
            return (
              <React.Fragment key={item.id}>
                {item.hasDividerAbove && (
                  <div className="my-2 border-t border-white/[0.06] mx-2" />
                )}
                <button
                  onClick={() => onSelectTable(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all duration-150 group relative ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 font-semibold border border-blue-500/30 shadow-xs'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 transition-all ${
                        isActive
                          ? 'bg-blue-600/25 text-blue-400'
                          : 'bg-white/[0.03] text-slate-400 group-hover:bg-white/[0.07] group-hover:text-slate-200'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <span className="text-xs leading-tight tracking-tight truncate">
                      {item.label}
                    </span>
                  </div>

                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border transition-all ${
                        isActive
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : 'bg-white/[0.04] text-slate-400 border-white/[0.06] group-hover:text-slate-300'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-3 border-t border-white/[0.07] bg-black/25 backdrop-blur-md space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 mb-1">
          <span className="flex items-center gap-1.5 font-medium text-slate-400">
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
            Base de Dados
          </span>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />

        <button
          onClick={onExportBackup}
          className="w-full mac-button-secondary text-xs py-1.5"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span>Exportar Base (JSON)</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full mac-button-secondary text-xs py-1.5"
          title="Importar um arquivo JSON de backup completo para restaurar a base de dados"
        >
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          <span>Importar Backup (JSON)</span>
        </button>

        <button
          onClick={onResetData}
          className="w-full flex items-center justify-center space-x-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] rounded-lg transition-colors"
          title="Restaurar dados originais de demonstração"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Restaurar Exemplo</span>
        </button>
      </div>
    </aside>
  );
};

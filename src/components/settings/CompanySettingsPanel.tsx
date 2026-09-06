import { Building2, CheckCircle2, Save, Trash2, Upload } from 'lucide-react';
import { maskCNPJ } from '../../utils/formatters';
import type { useSettingsController } from './useSettingsController';

type Props = {
  model: Pick<ReturnType<typeof useSettingsController>,
    'activeTab'
    | 'customLogo'
    | 'fileInputRef'
    | 'handleLogoSelect'
    | 'handleRemoveLogo'
    | 'handleSaveCompany'
    | 'companyName'
    | 'setCompanyName'
    | 'companyCnpj'
    | 'setCompanyCnpj'
    | 'companyCity'
    | 'setCompanyCity'
    | 'companyState'
    | 'setCompanyState'
    | 'BRAZILIAN_UFS'
    | 'companyFeedback'
  >;
};

export function CompanySettingsPanel({ model }: Props) {
  const {
    activeTab,
    customLogo,
    fileInputRef,
    handleLogoSelect,
    handleRemoveLogo,
    handleSaveCompany,
    companyName,
    setCompanyName,
    companyCnpj,
    setCompanyCnpj,
    companyCity,
    setCompanyCity,
    companyState,
    setCompanyState,
    BRAZILIAN_UFS,
    companyFeedback,
  } = model;
  return <>{activeTab === 'EMPRESA' && (
        <div className="space-y-6">
          {/* Logo Section */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Identidade Visual da Empresa</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Logotipo exibido no cabeçalho e na navegação lateral
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-1">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-xl bg-[#12151a] border border-[var(--graphite-border-base)] flex items-center justify-center p-2 overflow-hidden shadow-inner">
                  {customLogo ? (
                    <img
                      src={customLogo}
                      alt="Logo da Empresa"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <Building2 className="w-8 h-8 opacity-60" />
                      <span className="text-[9px] uppercase tracking-wider font-bold mt-1 text-slate-400">Padrão</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-[#1a1d24] hover:bg-[#232832] text-white border border-[var(--graphite-border-base)] rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[var(--graphite-accent-blue)]" />
                    <span>{customLogo ? 'Substituir logo' : 'Enviar imagem da logo'}</span>
                  </button>

                  {customLogo && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remover logo</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[var(--graphite-text-secondary)]">
                  Formatos aceitos: PNG, JPG ou WEBP. Tamanho máximo recomendado: 2MB.
                </p>
              </div>
            </div>
          </div>

          {/* Institutional Information Form */}
          <form onSubmit={handleSaveCompany} className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Dados da Empresa</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Informações cadastrais e institucionais
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Nome da Empresa / Razão Social <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: Madeireira Sol Nascente"
                  className="w-full px-3.5 py-2.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  CNPJ <span className="text-slate-500 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={companyCnpj}
                  onChange={(e) => setCompanyCnpj(maskCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  className="w-full px-3.5 py-2.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 md:col-span-2">
                <div className="col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Cidade <span className="text-slate-500 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={companyCity}
                    onChange={(e) => setCompanyCity(e.target.value)}
                    placeholder="Ex: Telêmaco Borba"
                    className="w-full px-3.5 py-2.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white text-xs focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    UF
                  </label>
                  <select
                    value={companyState}
                    onChange={(e) => setCompanyState(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white text-xs font-bold focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                  >
                    {BRAZILIAN_UFS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {companyFeedback && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{companyFeedback}</span>
              </div>
            )}

            <div className="pt-3 border-t border-[var(--graphite-border-subtle)] flex items-center justify-end">
              <button
                type="submit"
                className="mac-button-primary"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar alterações</span>
              </button>
            </div>
          </form>
        </div>
      )}</>;
}

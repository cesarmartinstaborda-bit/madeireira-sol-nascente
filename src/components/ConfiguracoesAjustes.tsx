import React, { useState, useEffect, useRef } from 'react';
import {
  AppSettings,
  CompanySettings,
  KlabinSettings,
  FreightSettings,
  CyclesSettings,
  KlabinDatabase,
  MotoristaRecord,
} from '../types';
import {
  Settings,
  Building2,
  Trees,
  Truck,
  CalendarDays,
  Database,
  Smartphone,
  Save,
  Upload,
  Trash2,
  Wallet,
  CheckCircle2,
  Info,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  Users,
  DollarSign,
  Wifi,
  WifiOff,
  Download,
  Plus,
  RefreshCw,
  FileText,
  Clock,
  HardDrive,
  Globe,
  Laptop,
  LayoutDashboard,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  formatBRL,
  maskCNPJ,
  MONTH_NAMES_BR,
  formatMonthYearBR,
  formatDateTimeBR,
} from '../utils/formatters';
import {
  getAutoBackups,
  createAutoBackup,
  downloadBackupEntry,
  exportDatabaseJSON,
  validateAndSanitizeBackupJSON,
  AutoBackupEntry,
} from '../utils/storage';
import {
  isFirebaseConfigured,
  getFirebaseSyncState,
  testFirebaseConnection,
  FirebaseSyncStatus,
} from '../utils/firebaseSync';
import { GoogleDriveExplorer } from './GoogleDriveExplorer';

export type SettingsSubTab =
  | 'EMPRESA'
  | 'KLABIN'
  | 'FRETES'
  | 'CICLOS'
  | 'DADOS_BACKUP'
  | 'GOOGLE_DRIVE'
  | 'APLICATIVO';

const BRAZILIAN_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export function detectAppEnvironment(): 'Web' | 'Electron' {
  if (typeof window !== 'undefined') {
    const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
    if (userAgent.includes(' electron/') || Boolean((window as any).process?.versions?.electron)) {
      return 'Electron';
    }
  }
  return 'Web';
}

export function checkLocalStorageAvailable(): boolean {
  try {
    const testKey = '__klabin_storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

interface ConfiguracoesAjustesProps {
  appSettings?: AppSettings;
  customLogo?: string;
  klabinBalance: number;
  motoristas?: MotoristaRecord[];
  database?: KlabinDatabase;
  onUpdateAppSettings: (newSettings: Partial<AppSettings>) => void;
  onUpdateCustomLogo: (logoBase64: string | undefined) => void;
  onToggleLockMonth?: (monthKey: string) => void;
  freightRatePerTon?: number;
  onRestoreBackup?: (backupData: KlabinDatabase, backupInfo?: { filename?: string; timestamp?: string }) => void | Promise<void>;
}

export const ConfiguracoesAjustes: React.FC<ConfiguracoesAjustesProps> = ({
  appSettings,
  customLogo,
  klabinBalance,
  motoristas = [],
  database,
  onUpdateAppSettings,
  onUpdateCustomLogo,
  onToggleLockMonth,
  freightRatePerTon = 15,
  onRestoreBackup,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsSubTab>('EMPRESA');

  // ================= EMPRESA LOCAL STATE =================
  const [companyName, setCompanyName] = useState<string>(
    appSettings?.company?.name || appSettings?.companyName || 'Madeireira Sol Nascente'
  );
  const [companyCnpj, setCompanyCnpj] = useState<string>(
    appSettings?.company?.cnpj ? maskCNPJ(appSettings.company.cnpj) : ''
  );
  const [companyCity, setCompanyCity] = useState<string>(appSettings?.company?.city || '');
  const [companyState, setCompanyState] = useState<string>(appSettings?.company?.state || 'PR');
  const [companyFeedback, setCompanyFeedback] = useState<string | null>(null);

  // ================= KLABIN LOCAL STATE =================
  const [defaultDeductFromBalance, setDefaultDeductFromBalance] = useState<boolean>(
    appSettings?.klabin?.defaultDeductFromBalance !== undefined
      ? appSettings.klabin.defaultDeductFromBalance
      : true
  );
  const [klabinFeedback, setKlabinFeedback] = useState<string | null>(null);

  // ================= FRETES LOCAL STATE =================
  const [localFreightRate, setLocalFreightRate] = useState<string>(
    String(appSettings?.freightRatePerTon ?? freightRatePerTon ?? 15)
  );
  const [defaultCargoFreightPayable, setDefaultCargoFreightPayable] = useState<boolean>(
    appSettings?.freight?.defaultCargoFreightPayable !== undefined
      ? appSettings.freight.defaultCargoFreightPayable
      : true
  );
  const [defaultSaleFreightPayable, setDefaultSaleFreightPayable] = useState<boolean>(
    appSettings?.freight?.defaultSaleFreightPayable !== undefined
      ? appSettings.freight.defaultSaleFreightPayable
      : false
  );
  const [freightFeedback, setFreightFeedback] = useState<string | null>(null);

  // ================= CICLOS LOCAL STATE =================
  const currentDate = new Date();
  const [selectedCycleMonth, setSelectedCycleMonth] = useState<string>(
    String(currentDate.getMonth() + 1).padStart(2, '0')
  );
  const [selectedCycleYear, setSelectedCycleYear] = useState<string>(
    String(currentDate.getFullYear())
  );
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    mode: 'LOCK' | 'UNLOCK';
    monthKey: string;
  } | null>(null);
  const [cycleFeedback, setCycleFeedback] = useState<string | null>(null);

  // ================= DADOS & BACKUP LOCAL STATE =================
  const [syncState, setSyncState] = useState<{
    isConfigured: boolean;
    status: FirebaseSyncStatus;
    lastSuccessfulSyncAt: string | null;
  }>(() => getFirebaseSyncState());
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [autoBackups, setAutoBackups] = useState<AutoBackupEntry[]>(() => getAutoBackups());
  const [backupFeedback, setBackupFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreModal, setRestoreModal] = useState<{
    isOpen: boolean;
    title: string;
    sourceDescription: string;
    data: KlabinDatabase;
    summary: {
      cargas: number;
      depositos: number;
      clientes: number;
      vendas: number;
      produtos: number;
      motoristas: number;
    };
    warnings?: string[];
  } | null>(null);

  // ================= APLICATIVO LOCAL STATE =================
  const [startupPreference, setStartupPreference] = useState<'DASHBOARD' | 'LAST_USED'>(() => {
    try {
      const val = localStorage.getItem('app_startup_preference');
      return val === 'LAST_USED' ? 'LAST_USED' : 'DASHBOARD';
    } catch {
      return 'DASHBOARD';
    }
  });
  const [appFeedback, setAppFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize dynamic online/offline events for syncState
  useEffect(() => {
    const handleOnline = () => setSyncState(getFirebaseSyncState());
    const handleOffline = () => setSyncState(getFirebaseSyncState());
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Refresh sync state when activeTab switches to DADOS_BACKUP or APLICATIVO
  useEffect(() => {
    if (activeTab === 'DADOS_BACKUP' || activeTab === 'APLICATIVO') {
      setSyncState(getFirebaseSyncState());
      setAutoBackups(getAutoBackups());
    }
  }, [activeTab]);

  // Synchronize local forms when external appSettings changes
  useEffect(() => {
    if (appSettings?.company) {
      setCompanyName(appSettings.company.name || 'Madeireira Sol Nascente');
      setCompanyCnpj(appSettings.company.cnpj ? maskCNPJ(appSettings.company.cnpj) : '');
      setCompanyCity(appSettings.company.city || '');
      setCompanyState(appSettings.company.state || 'PR');
    } else if (appSettings?.companyName) {
      setCompanyName(appSettings.companyName);
    }

    if (appSettings?.klabin?.defaultDeductFromBalance !== undefined) {
      setDefaultDeductFromBalance(appSettings.klabin.defaultDeductFromBalance);
    }

    if (appSettings?.freightRatePerTon !== undefined) {
      setLocalFreightRate(String(appSettings.freightRatePerTon));
    }

    if (appSettings?.freight?.defaultCargoFreightPayable !== undefined) {
      setDefaultCargoFreightPayable(appSettings.freight.defaultCargoFreightPayable);
    }
    if (appSettings?.freight?.defaultSaleFreightPayable !== undefined) {
      setDefaultSaleFreightPayable(appSettings.freight.defaultSaleFreightPayable);
    }
  }, [appSettings]);

  // Logo Upload
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setCompanyFeedback('O arquivo de imagem deve ter no máximo 2MB.');
      setTimeout(() => setCompanyFeedback(null), 4000);
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setCompanyFeedback('Formato inválido. Selecione um arquivo PNG, JPG ou WEBP.');
      setTimeout(() => setCompanyFeedback(null), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onUpdateCustomLogo(reader.result as string);
      setCompanyFeedback('Logo da empresa atualizado com sucesso.');
      setTimeout(() => setCompanyFeedback(null), 3500);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveLogo = () => {
    onUpdateCustomLogo(undefined);
    setCompanyFeedback('Logo personalizada removida. Logo padrão restaurado.');
    setTimeout(() => setCompanyFeedback(null), 3500);
  };

  // Save Empresa Settings
  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = companyName.trim() || 'Madeireira Sol Nascente';
    const trimmedCnpj = companyCnpj.trim();
    const trimmedCity = companyCity.trim();
    const trimmedState = companyState.trim().toUpperCase();

    const companyData: CompanySettings = {
      name: trimmedName,
      cnpj: trimmedCnpj || undefined,
      city: trimmedCity || undefined,
      state: trimmedState || undefined,
    };

    onUpdateAppSettings({
      company: companyData,
      companyName: trimmedName,
    });

    setCompanyFeedback('Configurações da empresa salvas.');
    setTimeout(() => setCompanyFeedback(null), 3500);
  };

  // Save Klabin Settings
  const handleSaveKlabin = (e: React.FormEvent) => {
    e.preventDefault();

    const klabinData: KlabinSettings = {
      defaultDeductFromBalance,
    };

    onUpdateAppSettings({
      klabin: klabinData,
    });

    setKlabinFeedback('Preferências do módulo Klabin salvas.');
    setTimeout(() => setKlabinFeedback(null), 3500);
  };

  // Save Fretes Settings
  const handleSaveFreight = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedRate = parseFloat(localFreightRate);
    const validRate = !isNaN(parsedRate) && parsedRate > 0 ? parsedRate : 15;

    const freightData: FreightSettings = {
      defaultCargoFreightPayable,
      defaultSaleFreightPayable,
    };

    onUpdateAppSettings({
      freightRatePerTon: validRate,
      freight: freightData,
    });

    setFreightFeedback('Preferências de fretes salvas.');
    setTimeout(() => setFreightFeedback(null), 3500);
  };

  // Cycle Helpers
  const lockedMonths = appSettings?.cycles?.lockedMonths || [];
  const selectedCycleKey = `${selectedCycleYear}-${selectedCycleMonth}`;
  const isSelectedCycleLocked = lockedMonths.includes(selectedCycleKey);

  const handleConfirmCycleAction = () => {
    if (!confirmModal) return;
    const { monthKey } = confirmModal;

    if (onToggleLockMonth) {
      onToggleLockMonth(monthKey);
    } else {
      const isAlreadyLocked = lockedMonths.includes(monthKey);
      const updatedLockedMonths = isAlreadyLocked
        ? lockedMonths.filter((m) => m !== monthKey)
        : [...lockedMonths, monthKey].sort((a, b) => b.localeCompare(a));

      const cyclesData: CyclesSettings = {
        lockedMonths: updatedLockedMonths,
      };

      onUpdateAppSettings({
        cycles: cyclesData,
      });
    }

    const monthFormatted = formatMonthYearBR(monthKey);
    if (confirmModal.mode === 'LOCK') {
      setCycleFeedback(`Ciclo de ${monthFormatted} fechado com sucesso.`);
    } else {
      setCycleFeedback(`Ciclo de ${monthFormatted} reaberto com sucesso.`);
    }
    setTimeout(() => setCycleFeedback(null), 3500);

    setConfirmModal(null);
  };

  // ================= DADOS & BACKUP HANDLERS =================
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    const res = await testFirebaseConnection();
    setIsTestingConnection(false);
    setTestResult({
      success: res.success,
      message: res.message,
    });
    setSyncState(getFirebaseSyncState());
  };

  const handleCreateBackupNow = () => {
    if (!database) {
      setBackupFeedback({ type: 'error', message: 'Dados da aplicação indisponíveis para backup.' });
      setTimeout(() => setBackupFeedback(null), 4000);
      return;
    }

    createAutoBackup(database);
    const updatedList = getAutoBackups();
    setAutoBackups(updatedList);
    setBackupFeedback({ type: 'success', message: 'Backup automático criado com sucesso.' });
    setTimeout(() => setBackupFeedback(null), 4000);
  };

  const handleExportBackupCurrent = () => {
    if (!database) {
      setBackupFeedback({ type: 'error', message: 'Dados da aplicação indisponíveis para exportação.' });
      setTimeout(() => setBackupFeedback(null), 4000);
      return;
    }

    exportDatabaseJSON(database);
    setBackupFeedback({ type: 'success', message: 'Arquivo de backup JSON exportado com sucesso.' });
    setTimeout(() => setBackupFeedback(null), 4000);
  };

  const prepareRestoreModal = (
    title: string,
    sourceDescription: string,
    targetDb: KlabinDatabase,
    warnings?: string[]
  ) => {
    const summary = {
      cargas: (targetDb.Cargas || []).length,
      depositos: (targetDb.Depositos_Klabin || []).length,
      clientes: (targetDb.Clientes || []).length,
      vendas: (targetDb.Vendas || []).length,
      produtos: (targetDb.Produtos || []).length,
      motoristas: (targetDb.Motoristas || []).length,
    };

    setRestoreModal({
      isOpen: true,
      title,
      sourceDescription,
      data: targetDb,
      summary,
      warnings,
    });
  };

  const handleSelectImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setImportError('Tipo de arquivo inválido. Selecione um arquivo de backup com extensão .json.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        setImportError('O arquivo selecionado não contém um JSON válido.');
        return;
      }
      const validation = validateAndSanitizeBackupJSON(parsed);

      if (!validation.isValid || !validation.sanitizedDb) {
        setImportError(validation.errorMessage || 'O arquivo selecionado não contém um backup válido.');
        return;
      }

      prepareRestoreModal(
        'Importar Arquivo de Backup',
        `Arquivo: ${file.name}`,
        validation.sanitizedDb,
        validation.warnings
      );
    };

    reader.onerror = () => {
      setImportError('Falha ao ler o arquivo de backup selecionado.');
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!restoreModal || !onRestoreBackup) return;

    setIsRestoring(true);
    try {
      await onRestoreBackup(restoreModal.data, {
        filename: restoreModal.sourceDescription,
        skipConfirm: true,
      });
      setAutoBackups(getAutoBackups());
      setBackupFeedback({ type: 'success', message: 'Backup restaurado com sucesso.' });
      setTimeout(() => setBackupFeedback(null), 4000);
    } catch (err) {
      console.error(err);
      setBackupFeedback({ type: 'error', message: 'Ocorreu uma falha ao restaurar o backup.' });
    } finally {
      setIsRestoring(false);
      setRestoreModal(null);
    }
  };

  // ================= APLICATIVO HANDLERS =================
  const handleStartupPreferenceChange = (pref: 'DASHBOARD' | 'LAST_USED') => {
    setStartupPreference(pref);
    try {
      localStorage.setItem('app_startup_preference', pref);
      setAppFeedback('Preferência de inicialização salva para este dispositivo.');
      setTimeout(() => setAppFeedback(null), 3500);
    } catch {
      // Ignore
    }
  };

  // Driver metrics
  const activeDriversCount = motoristas.filter((m) => m.status === 'ACTIVE' || !m.status).length;
  const inactiveDriversCount = motoristas.filter((m) => m.status === 'INACTIVE').length;

  const tabs: {
    id: SettingsSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'EMPRESA', label: 'Empresa', icon: Building2 },
    { id: 'KLABIN', label: 'Klabin', icon: Trees },
    { id: 'FRETES', label: 'Fretes', icon: Truck },
    { id: 'CICLOS', label: 'Ciclos', icon: CalendarDays },
    { id: 'DADOS_BACKUP', label: 'Dados & Backup', icon: Database },
    { id: 'GOOGLE_DRIVE', label: 'Google Drive', icon: HardDrive },
    { id: 'APLICATIVO', label: 'Aplicativo', icon: Smartphone },
  ];

  // Year options for cycle selector
  const availableYears = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];

  return (
    <div className="space-y-6">
      {/* Module Title Header */}
      <div className="glass-card-static p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-xl border border-[var(--graphite-border-subtle)]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Configurações e Ajustes</h2>
            <p className="text-xs text-[var(--graphite-text-secondary)] mt-0.5">
              Central de preferências globais, informações institucionais e administração do sistema
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#1a1d24] border border-[var(--graphite-border-subtle)] px-3.5 py-1.5 rounded-lg text-xs text-[var(--graphite-text-secondary)]">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Preferências Globais • Persistência Sincronizada</span>
        </div>
      </div>

      {/* Internal Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)] overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[var(--graphite-surface-2)] text-white shadow-xs border border-[var(--graphite-border-base)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1d24]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--graphite-accent-blue)]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: EMPRESA ================= */}
      {activeTab === 'EMPRESA' && (
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
      )}

      {/* ================= TAB 2: KLABIN ================= */}
      {activeTab === 'KLABIN' && (
        <div className="space-y-6">
          {/* Saldo Livre Klabin Card (READ-ONLY) */}
          <div className="glass-card p-6 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[var(--graphite-surface-2)] text-emerald-400 rounded-lg">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Saldo Livre Klabin</h3>
                  <p className="text-xs text-[var(--graphite-text-secondary)]">
                    Indicador derivado em tempo real
                  </p>
                </div>
              </div>

              <span className="text-[10px] bg-[#1c2027] text-slate-300 border border-[var(--graphite-border-subtle)] px-2.5 py-1 rounded-full font-semibold">
                Somente Leitura • Calculado Automaticamente
              </span>
            </div>

            <div className="py-2 flex items-baseline space-x-3">
              <span
                className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                  klabinBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatBRL(klabinBalance)}
              </span>
            </div>

            <p className="text-xs text-[var(--graphite-text-secondary)] leading-relaxed">
              O Saldo Livre Klabin é calculado automaticamente a partir dos depósitos e das cargas abatidas.
            </p>
          </div>

          {/* Preferences for New Cargoes */}
          <form onSubmit={handleSaveKlabin} className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                <Trees className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Preferências para novas cargas</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Comportamento padrão inicial ao criar novos registros de cargas
                </p>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 p-4 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)]">
              <div className="space-y-1 pr-4">
                <label
                  htmlFor="toggle-deduct-balance"
                  className="text-xs font-bold text-white cursor-pointer select-none"
                >
                  Abater novas cargas do Saldo Klabin por padrão
                </label>
                <p className="text-xs text-[var(--graphite-text-secondary)] leading-relaxed">
                  Quando ativo, o campo "Abater do Saldo Klabin" iniciará marcado como SIM ao abrir o formulário de Nova Carga.
                </p>
              </div>

              <div className="shrink-0 pt-0.5">
                <button
                  type="button"
                  id="toggle-deduct-balance"
                  role="switch"
                  aria-checked={defaultDeductFromBalance}
                  onClick={() => setDefaultDeductFromBalance(!defaultDeductFromBalance)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    defaultDeductFromBalance ? 'bg-[var(--graphite-accent-blue)]' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      defaultDeductFromBalance ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-[#16191f] border border-[var(--graphite-border-subtle)] rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
              <Info className="w-4 h-4 text-[var(--graphite-accent-blue)] shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-semibold text-slate-200">
                  Esta opção define apenas o estado inicial de novas cargas.
                </p>
                <p className="text-[11px] text-[var(--graphite-text-secondary)]">
                  Cargas já cadastradas não são alteradas. Ao editar uma carga existente, o valor salvo naquela carga será sempre preservado.
                </p>
              </div>
            </div>

            {klabinFeedback && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{klabinFeedback}</span>
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
      )}

      {/* ================= TAB 3: FRETES ================= */}
      {activeTab === 'FRETES' && (
        <div className="space-y-6">
          {/* Read-Only Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Tarifa Atual</span>
                <DollarSign className="w-4 h-4 text-[var(--graphite-accent-blue)]" />
              </div>
              <p className="text-xl font-bold font-mono text-white">
                {formatBRL(parseFloat(localFreightRate) || 15)}
                <span className="text-xs text-slate-400 font-normal"> / ton</span>
              </p>
              <p className="text-[10px] text-slate-500">Valor base para novos lançamentos</p>
            </div>

            <div className="glass-card p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Motoristas Ativos</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl font-bold font-mono text-emerald-400">
                {activeDriversCount}
              </p>
              <p className="text-[10px] text-slate-500">Disponíveis para fretes</p>
            </div>

            <div className="glass-card p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Motoristas Inativos</span>
                <Users className="w-4 h-4 text-slate-500" />
              </div>
              <p className="text-xl font-bold font-mono text-slate-300">
                {inactiveDriversCount}
              </p>
              <p className="text-[10px] text-slate-500">Histórico preservado</p>
            </div>
          </div>

          {/* Fretes Settings Form */}
          <form onSubmit={handleSaveFreight} className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Configurações e Tarifas de Frete</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Preferências globais aplicadas na criação de novos registros
                </p>
              </div>
            </div>

            {/* Freight Rate per Ton */}
            <div className="space-y-2 p-4 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)]">
              <label className="block text-xs font-bold text-white">
                Valor padrão do frete por tonelada (R$)
              </label>
              <p className="text-xs text-[var(--graphite-text-secondary)]">
                Utilizado para o cálculo automático do custo de frete (Quantidade em Toneladas × Tarifa) ao selecionar frete a pagar em novos registros.
              </p>
              <div className="max-w-xs pt-1">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={localFreightRate}
                    onChange={(e) => setLocalFreightRate(e.target.value)}
                    placeholder="15.00"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                  />
                </div>
              </div>
            </div>

            {/* Defaults for New Records */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Preferências para novos lançamentos
              </h4>

              {/* Toggle 1: Cargas default freight payable */}
              <div className="flex items-start justify-between gap-4 p-4 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)]">
                <div className="space-y-1 pr-4">
                  <label
                    htmlFor="toggle-cargo-freight"
                    className="text-xs font-bold text-white cursor-pointer select-none"
                  >
                    Frete a pagar por padrão em novas Cargas
                  </label>
                  <p className="text-xs text-[var(--graphite-text-secondary)] leading-relaxed">
                    Quando ativo, o campo "Frete a Pagar" iniciará marcado como SIM ao abrir o formulário de Nova Carga.
                  </p>
                </div>

                <div className="shrink-0 pt-0.5">
                  <button
                    type="button"
                    id="toggle-cargo-freight"
                    role="switch"
                    aria-checked={defaultCargoFreightPayable}
                    onClick={() => setDefaultCargoFreightPayable(!defaultCargoFreightPayable)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      defaultCargoFreightPayable ? 'bg-[var(--graphite-accent-blue)]' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        defaultCargoFreightPayable ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Toggle 2: Sales default freight payable */}
              <div className="flex items-start justify-between gap-4 p-4 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)]">
                <div className="space-y-1 pr-4">
                  <label
                    htmlFor="toggle-sale-freight"
                    className="text-xs font-bold text-white cursor-pointer select-none"
                  >
                    Frete a pagar por padrão em novas Vendas
                  </label>
                  <p className="text-xs text-[var(--graphite-text-secondary)] leading-relaxed">
                    Quando ativo, o campo "Frete a Pagar" iniciará marcado como SIM ao abrir o formulário de Nova Venda.
                  </p>
                </div>

                <div className="shrink-0 pt-0.5">
                  <button
                    type="button"
                    id="toggle-sale-freight"
                    role="switch"
                    aria-checked={defaultSaleFreightPayable}
                    onClick={() => setDefaultSaleFreightPayable(!defaultSaleFreightPayable)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      defaultSaleFreightPayable ? 'bg-[var(--graphite-accent-blue)]' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        defaultSaleFreightPayable ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Explanatory note */}
            <div className="p-3.5 bg-[#16191f] border border-[var(--graphite-border-subtle)] rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
              <Info className="w-4 h-4 text-[var(--graphite-accent-blue)] shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-semibold text-slate-200">
                  Esta opção define apenas o estado inicial ao cadastrar novos registros.
                </p>
                <p className="text-[11px] text-[var(--graphite-text-secondary)]">
                  Registros e fretes já lançados continuam com os valores salvos. A gestão operacional e a quitação de fretes continuam disponíveis em Gestão de Motoristas → Fretes.
                </p>
              </div>
            </div>

            {freightFeedback && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{freightFeedback}</span>
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
      )}

      {/* ================= TAB 4: CICLOS ================= */}
      {activeTab === 'CICLOS' && (
        <div className="space-y-6">
          {/* Cycle Manager Card */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Administração de Fechamento de Ciclo</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Bloqueie períodos mensais para impedir inclusões, edições ou exclusões acidentais
                </p>
              </div>
            </div>

            {/* Cycle Selector & Status Box */}
            <div className="p-5 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Selecionar Período
                  </h4>
                  <p className="text-xs text-[var(--graphite-text-secondary)]">
                    Escolha o mês e ano para consultar o estado ou alterar o fechamento
                  </p>
                </div>

                {/* Status Badge for Selected Month */}
                <div>
                  {isSelectedCycleLocked ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>FECHADO</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ABERTO</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Selectors and Action Button */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 items-end">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Mês
                  </label>
                  <select
                    value={selectedCycleMonth}
                    onChange={(e) => setSelectedCycleMonth(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white text-xs font-medium focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                  >
                    {MONTH_NAMES_BR.map((name, idx) => {
                      const monthVal = String(idx + 1).padStart(2, '0');
                      return (
                        <option key={monthVal} value={monthVal}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Ano
                  </label>
                  <select
                    value={selectedCycleYear}
                    onChange={(e) => setSelectedCycleYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#12151a] border border-[var(--graphite-border-base)] rounded-xl text-white text-xs font-medium focus:outline-none focus:border-[var(--graphite-accent-blue)]"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  {isSelectedCycleLocked ? (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmModal({
                          isOpen: true,
                          mode: 'UNLOCK',
                          monthKey: selectedCycleKey,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-[#1a1d24] hover:bg-[#232832] text-amber-300 hover:text-amber-200 border border-amber-800/80 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>Reabrir ciclo</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmModal({
                          isOpen: true,
                          mode: 'LOCK',
                          monthKey: selectedCycleKey,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Fechar ciclo</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* List of currently locked months */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Períodos Fechados</span>
                  <span className="px-2 py-0.5 bg-[#1c2027] border border-[var(--graphite-border-subtle)] text-slate-300 rounded-full text-[10px] font-mono">
                    {lockedMonths.length}
                  </span>
                </h4>
              </div>

              {lockedMonths.length === 0 ? (
                <div className="p-6 bg-[#14171d] rounded-xl border border-[var(--graphite-border-subtle)] text-center text-xs text-slate-400">
                  Nenhum ciclo fechado no momento. Todos os períodos estão abertos para lançamento.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {lockedMonths
                    .slice()
                    .sort((a, b) => b.localeCompare(a))
                    .map((mKey) => (
                      <div
                        key={mKey}
                        className="p-3 bg-[#14171d] border border-amber-900/40 rounded-xl flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-xs font-semibold text-white truncate">
                            {formatMonthYearBR(mKey)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setConfirmModal({
                              isOpen: true,
                              mode: 'UNLOCK',
                              monthKey: mKey,
                            })
                          }
                          className="px-2.5 py-1 bg-[#1a1d24] hover:bg-amber-950/50 text-amber-300 border border-amber-800/60 rounded-lg text-[11px] font-semibold transition-colors shrink-0"
                        >
                          Reabrir
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Informative Security / Audit Note */}
            <div className="p-3.5 bg-[#16191f] border border-[var(--graphite-border-subtle)] rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-semibold text-slate-200">
                  O que acontece ao fechar um ciclo mensal?
                </p>
                <p className="text-[11px] text-[var(--graphite-text-secondary)]">
                  O fechamento bloqueia a criação, edição e exclusão de Cargas, Depósitos Klabin, Vendas e quitação de Fretes pertencentes àquele mês. Cadastros de Clientes, Produtos e Motoristas continuam disponíveis. O estado de fechamento é sincronizado para todos os dispositivos.
                </p>
              </div>
            </div>

            {cycleFeedback && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{cycleFeedback}</span>
              </div>
            )}
          </div>

          {/* Confirmation Modal */}
          {confirmModal && confirmModal.isOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="glass-card p-6 max-w-md w-full border border-[var(--graphite-border-subtle)] space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
                  <div
                    className={`p-2 rounded-lg ${
                      confirmModal.mode === 'LOCK'
                        ? 'bg-amber-950/80 text-amber-400'
                        : 'bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)]'
                    }`}
                  >
                    {confirmModal.mode === 'LOCK' ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      <Unlock className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {confirmModal.mode === 'LOCK'
                        ? `Fechar ${formatMonthYearBR(confirmModal.monthKey)}?`
                        : `Reabrir ${formatMonthYearBR(confirmModal.monthKey)}?`}
                    </h3>
                    <p className="text-xs text-[var(--graphite-text-secondary)]">
                      Confirmação de alteração de ciclo
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {confirmModal.mode === 'LOCK'
                    ? 'Após o fechamento, registros desse período não poderão ser editados ou excluídos até que o ciclo seja reaberto.'
                    : 'As movimentações desse período voltarão a permitir alterações, inclusões e exclusões.'}
                </p>

                <div className="pt-3 border-t border-[var(--graphite-border-subtle)] flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setConfirmModal(null)}
                    className="px-3.5 py-2 bg-[#1a1d24] hover:bg-[#232832] text-slate-300 border border-[var(--graphite-border-base)] rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCycleAction}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                      confirmModal.mode === 'LOCK'
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'mac-button-primary'
                    }`}
                  >
                    {confirmModal.mode === 'LOCK' ? 'Fechar ciclo' : 'Reabrir ciclo'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 5: DADOS & BACKUP ================= */}
      {activeTab === 'DADOS_BACKUP' && (
        <div className="space-y-6">
          {/* Feedback messages */}
          {backupFeedback && (
            <div
              className={`p-4 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in slide-in-from-top-1 ${
                backupFeedback.type === 'success'
                  ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/60'
                  : backupFeedback.type === 'error'
                  ? 'bg-rose-950/50 text-rose-300 border border-rose-800/60'
                  : 'bg-amber-950/50 text-amber-300 border border-amber-800/60'
              }`}
            >
              {backupFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : backupFeedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{backupFeedback.message}</span>
            </div>
          )}

          {/* SECTION 1: SINCRONIZAÇÃO */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Sincronização de Dados</h3>
                  <p className="text-xs text-[var(--graphite-text-secondary)]">
                    Estado do serviço de persistência e banco remoto
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="px-3.5 py-2 bg-[#1a1d24] hover:bg-[#232832] disabled:opacity-50 text-white border border-[var(--graphite-border-base)] rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[var(--graphite-accent-blue)] ${isTestingConnection ? 'animate-spin' : ''}`} />
                <span>{isTestingConnection ? 'Testando...' : 'Testar conexão'}</span>
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium flex items-center space-x-2 ${
                  testResult.success
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50'
                    : 'bg-rose-950/40 text-rose-300 border border-rose-800/50'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Firebase Status */}
              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-2">
                <div className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider">
                  Firebase Firestore
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                      syncState.isConfigured
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                        : 'bg-amber-950/60 text-amber-300 border-amber-800/70'
                    }`}
                  >
                    {syncState.isConfigured ? 'Configurado' : 'Não configurado'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  {syncState.isConfigured
                    ? 'Ambiente possui projeto Firebase configurado.'
                    : 'A aplicação está funcionando com armazenamento local neste dispositivo.'}
                </p>
              </div>

              {/* Card 2: Estado da Sincronização */}
              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-2">
                <div className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider">
                  Estado da Sincronização
                </div>
                <div className="flex items-center space-x-2">
                  {!syncState.isConfigured ? (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      <WifiOff className="w-3 h-3 text-slate-400" />
                      <span>Não configurado</span>
                    </span>
                  ) : syncState.status === 'CONNECTED' ? (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/70">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span>Conectada</span>
                    </span>
                  ) : syncState.status === 'OFFLINE' ? (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/60 text-amber-300 border border-amber-800/70">
                      <WifiOff className="w-3 h-3 text-amber-400" />
                      <span>Offline</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950/60 text-rose-300 border border-rose-800/70">
                      <XCircle className="w-3 h-3 text-rose-400" />
                      <span>Erro</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  {!syncState.isConfigured
                    ? 'Operando em modo local seguro neste navegador.'
                    : syncState.status === 'CONNECTED'
                    ? 'Sincronização em tempo real ativa e operando normalmente.'
                    : syncState.status === 'OFFLINE'
                    ? 'Sem conexão com a internet. A aplicação continua operando com armazenamento local.'
                    : 'Falha na conexão com o serviço Firestore.'}
                </p>
              </div>

              {/* Card 3: Última Sincronização Bem-Sucedida */}
              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-2">
                <div className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider">
                  Última Sincronização
                </div>
                <div className="flex items-center space-x-2 text-white font-mono text-xs font-bold pt-0.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--graphite-accent-blue)] shrink-0" />
                  <span>{formatDateTimeBR(syncState.lastSuccessfulSyncAt)}</span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Registro da última comunicação confirmada com o servidor.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: BACKUPS AUTOMÁTICOS */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-white">Backups Automáticos</h3>
                    <span className="px-2 py-0.5 bg-[#1a1d24] text-slate-300 border border-[var(--graphite-border-subtle)] rounded-md text-[11px] font-bold font-mono">
                      {autoBackups.length} / 5
                    </span>
                  </div>
                  <p className="text-xs text-[var(--graphite-text-secondary)]">
                    Histórico rotativo de cópias de segurança locais salvas automaticamente
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateBackupNow}
                  className="px-3.5 py-2 bg-[#1a1d24] hover:bg-[#232832] text-white border border-[var(--graphite-border-base)] rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Criar backup agora</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportBackupCurrent}
                  className="px-3.5 py-2 mac-button-primary rounded-xl text-xs font-bold flex items-center space-x-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar backup atual</span>
                </button>
              </div>
            </div>

            {/* Backups List */}
            {autoBackups.length === 0 ? (
              <div className="p-6 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] text-center text-xs text-[var(--graphite-text-secondary)]">
                Nenhum backup automático registrado até o momento.
              </div>
            ) : (
              <div className="space-y-2">
                {autoBackups.map((b, idx) => (
                  <div
                    key={b.id || idx}
                    className="p-3.5 bg-[#12151a] hover:bg-[#161a21] rounded-xl border border-[var(--graphite-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white font-mono">
                          {formatDateTimeBR(b.timestamp)}
                        </div>
                        <div className="text-[11px] text-[var(--graphite-text-secondary)] flex items-center space-x-2">
                          <span>{b.origin || 'Backup Automático'}</span>
                          <span>•</span>
                          <span>{b.filename || `madeireira_auto_backup_${idx + 1}.json`}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => downloadBackupEntry(b)}
                        className="px-3 py-1.5 bg-[#1a1d24] hover:bg-[#232832] text-slate-200 border border-[var(--graphite-border-base)] rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-[var(--graphite-accent-blue)]" />
                        <span>Baixar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          prepareRestoreModal(
                            'Restaurar Backup Automático',
                            `Cópia de ${formatDateTimeBR(b.timestamp)}`,
                            b.data
                          )
                        }
                        className="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Restaurar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: IMPORTAÇÃO E RESTAURAÇÃO */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-amber-400 rounded-lg">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Importação e Restauração de Arquivo</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Carregue um arquivo JSON de backup gerado anteriormente para restaurar a base de dados
                </p>
              </div>
            </div>

            {importError && (
              <div className="p-3.5 bg-rose-950/50 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <div className="p-6 bg-[#12151a] rounded-xl border border-dashed border-[var(--graphite-border-base)] flex flex-col items-center justify-center text-center space-y-3">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleSelectImportFile}
                className="hidden"
              />

              <div className="p-3 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-xl border border-[var(--graphite-border-subtle)]">
                <FileText className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-white">
                  Selecione um arquivo de backup em formato JSON (.json)
                </p>
                <p className="text-[11px] text-[var(--graphite-text-secondary)] max-w-md">
                  Antes da restauração, o sistema validará o conteúdo do arquivo e apresentará o resumo completo das coleções contidas.
                </p>
              </div>

              <button
                type="button"
                onClick={() => importFileInputRef.current?.click()}
                className="px-4 py-2 bg-[#1a1d24] hover:bg-[#232832] text-white border border-[var(--graphite-border-base)] rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[var(--graphite-accent-blue)]" />
                <span>Selecionar arquivo JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB: GOOGLE DRIVE ================= */}
      {activeTab === 'GOOGLE_DRIVE' && (
        <GoogleDriveExplorer
          database={database || ({} as KlabinDatabase)}
          onRestoreDatabase={(restoredDb) => {
            if (onRestoreBackup) {
              onRestoreBackup(restoredDb, {
                filename: 'Google Drive Cloud Backup',
              });
            }
          }}
          onShowToast={(msg) => {
            setBackupFeedback({ type: 'success', message: msg });
            setTimeout(() => setBackupFeedback(null), 4500);
          }}
        />
      )}

      {/* ================= TAB 6: APLICATIVO ================= */}
      {activeTab === 'APLICATIVO' && (
        <div className="space-y-6">
          {appFeedback && (
            <div className="p-4 bg-emerald-950/50 text-emerald-300 border border-emerald-800/60 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in slide-in-from-top-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{appFeedback}</span>
            </div>
          )}

          {/* CARD 1: INFORMAÇÕES TÉCNICAS E AMBIENTE */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Informações do Aplicativo</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Especificações técnicas e ambiente de execução
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider block">
                  Nome do Sistema
                </span>
                <span className="text-xs font-bold text-white block">
                  {companyName || 'Madeireira Sol Nascente'}
                </span>
              </div>

              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider block">
                  Versão da Aplicação
                </span>
                <span className="text-xs font-bold text-white font-mono block">
                  v0.0.0
                </span>
              </div>

              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider block">
                  Ambiente de Execução
                </span>
                <div className="flex items-center space-x-1.5 pt-0.5">
                  {detectAppEnvironment() === 'Electron' ? (
                    <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-[var(--graphite-accent-blue)]" />
                  )}
                  <span className="text-xs font-bold text-white block">
                    {detectAppEnvironment()}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-[#12151a] rounded-xl border border-[var(--graphite-border-subtle)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--graphite-text-secondary)] uppercase tracking-wider block">
                  Armazenamento Local
                </span>
                <span
                  className={`text-xs font-bold block ${
                    checkLocalStorageAvailable() ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {checkLocalStorageAvailable() ? 'Disponível' : 'Indisponível'}
                </span>
              </div>
            </div>
          </div>

          {/* CARD 2: PREFERÊNCIAS DE INICIALIZAÇÃO */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center space-x-3 border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="p-2 bg-[var(--graphite-surface-2)] text-[var(--graphite-accent-blue)] rounded-lg">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Preferências de Inicialização</h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Defina qual tela deve ser apresentada ao abrir a aplicação neste dispositivo
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Ao abrir o aplicativo:
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleStartupPreferenceChange('DASHBOARD')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-3 ${
                    startupPreference === 'DASHBOARD'
                      ? 'bg-[var(--graphite-surface-2)] border-[var(--graphite-accent-blue)] ring-1 ring-[var(--graphite-accent-blue)]'
                      : 'bg-[#12151a] hover:bg-[#161a21] border-[var(--graphite-border-subtle)]'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      startupPreference === 'DASHBOARD'
                        ? 'bg-[var(--graphite-accent-blue)] text-white'
                        : 'bg-[#1a1d24] text-slate-400'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white">Painel Consolidado (Padrão)</div>
                    <p className="text-[11px] text-[var(--graphite-text-secondary)] leading-relaxed">
                      Inicia sempre no Dashboard com visão geral dos indicadores operacionais e financeiros.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartupPreferenceChange('LAST_USED')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-3 ${
                    startupPreference === 'LAST_USED'
                      ? 'bg-[var(--graphite-surface-2)] border-[var(--graphite-accent-blue)] ring-1 ring-[var(--graphite-accent-blue)]'
                      : 'bg-[#12151a] hover:bg-[#161a21] border-[var(--graphite-border-subtle)]'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      startupPreference === 'LAST_USED'
                        ? 'bg-[var(--graphite-accent-blue)] text-white'
                        : 'bg-[#1a1d24] text-slate-400'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white">Último módulo utilizado</div>
                    <p className="text-[11px] text-[var(--graphite-text-secondary)] leading-relaxed">
                      Reabre automaticamente o último módulo visualizado (Klabin, Clientes, Motoristas ou Ajustes).
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* CARD 3: SOBRE */}
          <div className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-[var(--graphite-surface-2)] text-slate-300 rounded-xl border border-[var(--graphite-border-subtle)]">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {companyName || 'Madeireira Sol Nascente'}
                </h3>
                <p className="text-xs text-[var(--graphite-text-secondary)]">
                  Sistema de Gestão Operacional e Controle Financeiro
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-400 font-mono bg-[#12151a] px-3.5 py-1.5 rounded-lg border border-[var(--graphite-border-subtle)] self-start md:self-auto">
              Versão 0.0.0 • Madeireira V3
            </div>
          </div>
        </div>
      )}

      {/* RESTORE CONFIRMATION MODAL */}
      {restoreModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-[var(--graphite-border-subtle)] pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-950/60 text-amber-400 rounded-xl border border-amber-800/70">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{restoreModal.title}</h3>
                  <p className="text-xs text-[var(--graphite-text-secondary)] font-mono">
                    {restoreModal.sourceDescription}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRestoreModal(null)}
                disabled={isRestoring}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-amber-950/40 text-amber-300 border border-amber-800/50 rounded-xl text-xs leading-relaxed">
                Restaurar este arquivo substituirá os dados atuais pelo conteúdo do backup selecionado.
              </div>

              {restoreModal.warnings && restoreModal.warnings.length > 0 && (
                <div className="p-3 bg-slate-900 text-slate-300 border border-slate-700 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-amber-400">Observações:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {restoreModal.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-bold text-slate-300">Resumo dos dados contidos:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-2.5 bg-[#12151a] rounded-lg border border-[var(--graphite-border-subtle)]">
                    <span className="text-[10px] text-[var(--graphite-text-secondary)] block">Cargas Klabin</span>
                    <span className="text-sm font-bold text-white font-mono">{restoreModal.summary.cargas}</span>
                  </div>
                  <div className="p-2.5 bg-[#12151a] rounded-lg border border-[var(--graphite-border-subtle)]">
                    <span className="text-[10px] text-[var(--graphite-text-secondary)] block">Depósitos Klabin</span>
                    <span className="text-sm font-bold text-white font-mono">{restoreModal.summary.depositos}</span>
                  </div>
                  <div className="p-2.5 bg-[#12151a] rounded-lg border border-[var(--graphite-border-subtle)]">
                    <span className="text-[10px] text-[var(--graphite-text-secondary)] block">Clientes</span>
                    <span className="text-sm font-bold text-white font-mono">{restoreModal.summary.clientes}</span>
                  </div>
                  <div className="p-2.5 bg-[#12151a] rounded-lg border border-[var(--graphite-border-subtle)]">
                    <span className="text-[10px] text-[var(--graphite-text-secondary)] block">Vendas</span>
                    <span className="text-sm font-bold text-white font-mono">{restoreModal.summary.vendas}</span>
                  </div>
                  <div className="p-2.5 bg-[#12151a] rounded-lg border border-[var(--graphite-border-subtle)]">
                    <span className="text-[10px] text-[var(--graphite-text-secondary)] block">Produtos</span>
                    <span className="text-sm font-bold text-white font-mono">{restoreModal.summary.produtos}</span>
                  </div>
                  <div className="p-2.5 bg-[#12151a] rounded-lg border border-[var(--graphite-border-subtle)]">
                    <span className="text-[10px] text-[var(--graphite-text-secondary)] block">Motoristas</span>
                    <span className="text-sm font-bold text-white font-mono">{restoreModal.summary.motoristas}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--graphite-border-subtle)] flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRestoreModal(null)}
                disabled={isRestoring}
                className="px-3.5 py-2 bg-[#1a1d24] hover:bg-[#232832] disabled:opacity-50 text-slate-300 border border-[var(--graphite-border-base)] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-2 cursor-pointer"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <span>Restaurar backup</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

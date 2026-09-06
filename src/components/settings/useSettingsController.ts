import { Building2, CalendarDays, Database, HardDrive, Smartphone, Trees, Truck } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { AppSettings, CompanySettings, CyclesSettings, FreightSettings, KlabinDatabase, KlabinSettings, MotoristaRecord, } from '../../types';
import { formatBRLCurrencyInput, formatMonthYearBR, maskCNPJ, parseBRLCurrency } from '../../utils/formatters';
import { useBackupSettings } from './useBackupSettings';

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

export interface ConfiguracoesAjustesProps {
  appSettings?: AppSettings;
  customLogo?: string;
  klabinBalance: number;
  motoristas?: MotoristaRecord[];
  database?: KlabinDatabase;
  onUpdateAppSettings: (newSettings: Partial<AppSettings>) => void;
  onUpdateCustomLogo: (logoBase64: string | undefined) => void;
  onToggleLockMonth?: (monthKey: string) => void;
  freightRatePerTon?: number;
  onRestoreBackup?: (backupData: KlabinDatabase, backupInfo?: { filename?: string; timestamp?: string; skipConfirm?: boolean }) => void | Promise<void>;
}


/** Keeps state and effects mounted for the same lifetime as ConfiguracoesAjustes. */
export function useSettingsController({
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
}: ConfiguracoesAjustesProps) {
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
    formatBRLCurrencyInput(appSettings?.freightRatePerTon ?? freightRatePerTon ?? 15)
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

  const {
    backupFeedback,
    setBackupFeedback,
    handleTestConnection,
    isTestingConnection,
    testResult,
    syncState,
    autoBackups,
    handleCreateBackupNow,
    handleExportBackupCurrent,
    prepareRestoreModal,
    importError,
    importFileInputRef,
    handleSelectImportFile,
    restoreModal,
    setRestoreModal,
    isRestoring,
    handleConfirmRestore,
  } = useBackupSettings({ database, onRestoreBackup, activeTab });

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
      setLocalFreightRate(formatBRLCurrencyInput(appSettings.freightRatePerTon));
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

    const parsedRate = parseBRLCurrency(localFreightRate);
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


  return {
    tabs,
    activeTab,
    setActiveTab,
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
    klabinBalance,
    handleSaveKlabin,
    defaultDeductFromBalance,
    setDefaultDeductFromBalance,
    klabinFeedback,
    localFreightRate,
    activeDriversCount,
    inactiveDriversCount,
    handleSaveFreight,
    setLocalFreightRate,
    defaultCargoFreightPayable,
    setDefaultCargoFreightPayable,
    defaultSaleFreightPayable,
    setDefaultSaleFreightPayable,
    freightFeedback,
    isSelectedCycleLocked,
    selectedCycleMonth,
    setSelectedCycleMonth,
    selectedCycleYear,
    setSelectedCycleYear,
    availableYears,
    setConfirmModal,
    selectedCycleKey,
    lockedMonths,
    cycleFeedback,
    confirmModal,
    handleConfirmCycleAction,
    backupFeedback,
    handleTestConnection,
    isTestingConnection,
    testResult,
    syncState,
    autoBackups,
    handleCreateBackupNow,
    handleExportBackupCurrent,
    prepareRestoreModal,
    importError,
    importFileInputRef,
    handleSelectImportFile,
    database,
    onRestoreBackup,
    setBackupFeedback,
    appFeedback,
    detectAppEnvironment,
    checkLocalStorageAvailable,
    handleStartupPreferenceChange,
    startupPreference,
    restoreModal,
    setRestoreModal,
    isRestoring,
    handleConfirmRestore,
  };
}

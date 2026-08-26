import React, { useState, useEffect } from 'react';
import { TableType } from '../types';
import { formatBRL } from '../utils/formatters';
import { Download, Wallet, HardDrive } from 'lucide-react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, googleSignOut, getCurrentGoogleUser } from '../utils/googleAuth';
import { GoogleSignInButton } from './GoogleSignInButton';
import defaultLogo from '@/assets/icon.png';

interface HeaderProps {
  activeTable: TableType;
  onExportCSV: () => void;
  klabinBalance: number;
  customLogo?: string;
  companyName?: string;
  onOpenSettingsTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTable,
  onExportCSV,
  klabinBalance,
  customLogo,
  companyName = 'Madeireira Sol Nascente',
  onOpenSettingsTab,
}) => {
  const [googleUser, setGoogleUser] = useState<User | null>(() => getCurrentGoogleUser());
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  useEffect(() => {
    const unsub = initAuth(
      (u, t) => {
        setGoogleUser(u);
        setGoogleToken(t);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.warn('Google Sign In:', err?.message || err);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleSignOut();
      setGoogleUser(null);
      setGoogleToken(null);
    } catch (err) {
      console.warn('Google Sign Out:', err);
    }
  };

  const getTitleAndSubtitle = (): { title: string; subtitle: string } => {
    switch (activeTable) {
      case 'Dashboard':
        return {
          title: 'Painel Consolidado',
          subtitle: 'Visão unificada de saldos, cargas, fretes e movimentações',
        };
      case 'Klabin':
      case 'Cargas':
      case 'Depositos_Klabin':
        return {
          title: 'Módulo Klabin',
          subtitle: 'Controle de Cargas Fornecidas e Depósitos de Adiantamento Klabin S.A.',
        };
      case 'Clientes_Produtos':
      case 'Gestao_Clientes':
      case 'Vendas':
      case 'Produtos':
        return {
          title: 'Clientes & Produtos',
          subtitle: 'Gestão comercial de vendas a terceiros e catálogo de produtos',
        };
      case 'Motoristas':
        return {
          title: 'Gestão de Motoristas',
          subtitle: 'Controle de fretes a pagar, quitações e cadastro de veículos',
        };
      case 'Configuracoes':
        return {
          title: 'Configurações e Ajustes',
          subtitle: 'Cópias de segurança, tarifa padrão de frete e auditoria',
        };
      default:
        return {
          title: 'Painel Geral',
          subtitle: 'Madeireira Sol Nascente - Sistema de Gestão',
        };
    }
  };

  const { title, subtitle } = getTitleAndSubtitle();
  const canExport = activeTable !== 'Dashboard' && activeTable !== 'Configuracoes';

  return (
    <header className="mac-toolbar px-6 py-3.5 sticky top-0 z-10 select-none flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Title & Brand Section */}
      <div className="flex items-center space-x-3">
        {customLogo ? (
          <img
            src={customLogo}
            alt="Logo"
            className="h-8 w-8 object-contain rounded border border-[var(--graphite-border-subtle)] bg-[#1c2027]"
          />
        ) : (
          <img
            src={defaultLogo}
            alt="Logo"
            className="h-8 w-8 object-contain rounded border border-[var(--graphite-border-subtle)] bg-[#1c2027]"
          />
        )}

        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-300">{companyName}</span>
            <span className="text-slate-600 font-normal">/</span>
            <h1 className="text-sm font-bold text-white tracking-tight">{title}</h1>
          </div>
          <p className="text-[11px] text-[var(--graphite-text-secondary)] font-normal mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right Metrics & Actions (No Global Search per Phase 13) */}
      <div className="flex items-center space-x-3">
        {/* Google Drive Status & Connection */}
        <div className="hidden md:flex items-center">
          <GoogleSignInButton
            user={googleUser}
            token={googleToken}
            isLoading={isAuthLoading}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            compact={true}
            buttonText="Google Drive"
          />
        </div>

        {/* Klabin Free Balance Badge */}
        <div className="flex items-center space-x-2.5 bg-[#1a1d24] border border-[var(--graphite-border-subtle)] px-3 py-1.5 rounded-lg shadow-2xs">
          <Wallet className="w-3.5 h-3.5 text-emerald-400" />
          <div className="text-left">
            <span className="text-[9px] font-semibold uppercase text-slate-400 tracking-wider block leading-none">
              Saldo Livre Klabin
            </span>
            <span
              className={`text-xs font-extrabold font-mono leading-tight block mt-0.5 ${
                klabinBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatBRL(klabinBalance)}
            </span>
          </div>
        </div>

        {/* Export CSV Button if applicable */}
        {canExport && (
          <button
            onClick={onExportCSV}
            className="mac-button-secondary"
            title="Exportar dados da tabela para CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        )}
      </div>
    </header>
  );
};

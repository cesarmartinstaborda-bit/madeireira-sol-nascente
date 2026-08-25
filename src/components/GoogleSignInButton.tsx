import React from 'react';
import { User } from 'firebase/auth';
import { LogOut, RefreshCw, CheckCircle2 } from 'lucide-react';

interface GoogleSignInButtonProps {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  compact?: boolean;
  buttonText?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  user,
  token,
  isLoading,
  onSignIn,
  onSignOut,
  compact = false,
  buttonText = 'Conectar com Google Drive',
}) => {
  if (user && token) {
    if (compact) {
      return (
        <div className="flex items-center space-x-2 bg-[#1a1d24] border border-emerald-500/30 px-2.5 py-1.5 rounded-lg shadow-2xs">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Google User'}
              className="w-5 h-5 rounded-full object-cover border border-emerald-400/40"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-emerald-600/30 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'G'}
            </div>
          )}
          <div className="flex flex-col text-left">
            <span className="text-[11px] font-medium text-slate-200 truncate max-w-[100px] leading-tight">
              {user.displayName || user.email?.split('@')[0]}
            </span>
            <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-0.5">
              <CheckCircle2 className="w-2.5 h-2.5" /> Drive Conectado
            </span>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            title="Desconectar conta Google"
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between p-3.5 bg-slate-900/80 border border-emerald-500/30 rounded-xl">
        <div className="flex items-center space-x-3">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Google User'}
              className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400/40 shadow-sm"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-emerald-600/30 text-emerald-400 flex items-center justify-center text-base font-bold border border-emerald-500/30">
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'G'}
            </div>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-white">
                {user.displayName || 'Usuário Google'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Conectado
              </span>
            </div>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 bg-slate-800/80 hover:bg-rose-950/40 border border-slate-700/60 hover:border-rose-700/40 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Desconectar</span>
        </button>
      </div>
    );
  }

  // Google Sign In Button styled as official gsi-material-button with dark/graphite styling
  return (
    <button
      type="button"
      onClick={onSignIn}
      disabled={isLoading}
      className={`relative inline-flex items-center justify-center font-medium transition-all duration-150 select-none ${
        compact
          ? 'px-3 py-1.5 bg-[#1a1d24] hover:bg-[#252a34] text-slate-200 border border-[var(--graphite-border-subtle)] hover:border-slate-600 rounded-lg text-xs shadow-2xs disabled:opacity-50'
          : 'w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded-xl text-sm font-semibold shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-60'
      }`}
    >
      <div className="flex items-center space-x-2.5">
        {isLoading ? (
          <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
        ) : (
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 48 48">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
        )}
        <span className={compact ? 'text-slate-200' : 'text-slate-900'}>
          {isLoading ? 'Autenticando...' : buttonText}
        </span>
      </div>
    </button>
  );
};

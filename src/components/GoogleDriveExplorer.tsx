import { AlertTriangle, ExternalLink, FileBarChart, FileJson, FileSpreadsheet, FileText, FolderSync, HardDrive, RefreshCw, Search, ShieldCheck, Trash2, Upload } from 'lucide-react';
import React from 'react';
import { formatDateTimeBR } from '../utils/formatters';
import type { DriveFileItem } from '../utils/googleDrive';
import { formatDriveFileSize } from '../utils/googleDrive';
import { useDriveExplorer, type GoogleDriveExplorerProps } from './drive/useDriveExplorer';
import { GoogleSignInButton } from './GoogleSignInButton';


const getFileIcon = (file: DriveFileItem) => {
  if (file.name.endsWith('.json') || file.mimeType.includes('json')) {
    return <FileJson className="w-5 h-5 text-amber-400 flex-shrink-0" />;
  }
  if (file.name.endsWith('.csv') || file.mimeType.includes('csv') || file.mimeType.includes('spreadsheet')) {
    return <FileSpreadsheet className="w-5 h-5 text-emerald-400 flex-shrink-0" />;
  }
  return <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />;
};



export const GoogleDriveExplorer: React.FC<GoogleDriveExplorerProps> = (props) => {
  const model = useDriveExplorer(props);
  const {
    user,
    token,
    isAuthLoading,
    handleSignIn,
    handleSignOut,
    handleCreateCloudBackup,
    isBackingUp,
    handleExportCSVsToDrive,
    isExportingCSVs,
    handleGenerateConsolidatedReport,
    isGeneratingReport,
    fileInputRef,
    handleCustomFileUpload,
    isUploadingCustom,
    filteredFiles,
    setActiveFilter,
    activeFilter,
    searchQuery,
    setSearchQuery,
    loadDriveData,
    isLoadingFiles,
    setRestoreConfirmTarget,
    setDeleteConfirmTarget,
    deleteConfirmTarget,
    handleConfirmDelete,
    restoreConfirmTarget,
    handleConfirmRestore,
  } = model;
  return (<div className="space-y-6">
      {/* Google Account Connection Header */}
      <div className="bg-[#1a1d24] border border-[var(--graphite-border-subtle)] rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Integração Google Drive
                </h3>
                <span className="text-[10px] uppercase tracking-wider font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded">
                  Oficial Google Workspace
                </span>
              </div>
              <p className="text-xs text-[var(--graphite-text-secondary)] mt-0.5 max-w-2xl">
                Armazenamento em nuvem de alta segurança. Salve backups automáticos e manuais em JSON, exporte planilhas CSV consolidadas e anexe comprovantes e documentos fiscais na sua pasta dedicada do Google Drive.
              </p>
            </div>
          </div>

          <div className="flex-shrink-0">
            <GoogleSignInButton
              user={user}
              token={token}
              isLoading={isAuthLoading}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
              buttonText="Conectar Google Drive"
            />
          </div>
        </div>
      </div>

      {user && token ? (
        <>
          {/* Quick Action Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Backup to Drive */}
            <button
              type="button"
              onClick={handleCreateCloudBackup}
              disabled={isBackingUp}
              className="flex items-center justify-center space-x-2.5 p-3.5 bg-[#1e232d] hover:bg-[#262c38] active:scale-[0.99] border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-left transition-all group disabled:opacity-50"
            >
              {isBackingUp ? (
                <RefreshCw className="w-5 h-5 text-amber-400 animate-spin flex-shrink-0" />
              ) : (
                <FolderSync className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform flex-shrink-0" />
              )}
              <div>
                <span className="text-xs font-bold text-white block">
                  {isBackingUp ? 'Gerando Cópia...' : 'Salvar Backup JSON'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Cópia completa do banco no Drive
                </span>
              </div>
            </button>

            {/* Export CSVs */}
            <button
              type="button"
              onClick={handleExportCSVsToDrive}
              disabled={isExportingCSVs}
              className="flex items-center justify-center space-x-2.5 p-3.5 bg-[#1e232d] hover:bg-[#262c38] active:scale-[0.99] border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-left transition-all group disabled:opacity-50"
            >
              {isExportingCSVs ? (
                <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin flex-shrink-0" />
              ) : (
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform flex-shrink-0" />
              )}
              <div>
                <span className="text-xs font-bold text-white block">
                  {isExportingCSVs ? 'Exportando Planilhas...' : 'Exportar CSVs Operacionais'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  5 tabelas (Cargas, Fretes, Vendas...)
                </span>
              </div>
            </button>

            {/* Consolidated PDF Report */}
            <button
              type="button"
              onClick={handleGenerateConsolidatedReport}
              disabled={isGeneratingReport}
              className="flex items-center justify-center space-x-2.5 p-3.5 bg-[#1e232d] hover:bg-[#262c38] active:scale-[0.99] border border-purple-500/30 hover:border-purple-500/50 rounded-xl text-left transition-all group disabled:opacity-50"
            >
              {isGeneratingReport ? (
                <RefreshCw className="w-5 h-5 text-purple-400 animate-spin flex-shrink-0" />
              ) : (
                <FileBarChart className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform flex-shrink-0" />
              )}
              <div>
                <span className="text-xs font-bold text-white block">
                  {isGeneratingReport ? 'Gerando Relatório...' : 'Relatório Consolidado PDF'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Resumo executivo + todas as tabelas
                </span>
              </div>
            </button>

            {/* Upload Custom File */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleCustomFileUpload}
                accept=".pdf,.png,.jpg,.jpeg,.json,.csv,.xlsx,.doc,.docx"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingCustom}
                className="w-full h-full flex items-center justify-center space-x-2.5 p-3.5 bg-[#1e232d] hover:bg-[#262c38] active:scale-[0.99] border border-blue-500/30 hover:border-blue-500/50 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                {isUploadingCustom ? (
                  <RefreshCw className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
                ) : (
                  <Upload className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                )}
                <div>
                  <span className="text-xs font-bold text-white block">
                    {isUploadingCustom ? 'Enviando Arquivo...' : 'Upload de Documento'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    NFs, comprovantes, PDFs e fotos
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Drive File Explorer Section */}
          <div className="bg-[#1a1d24] border border-[var(--graphite-border-subtle)] rounded-xl overflow-hidden shadow-xs">
            {/* Header with Search and Filter */}
            <div className="p-4 border-b border-[var(--graphite-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#161920]">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Arquivos em Nuvem
                </span>
                <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
                  {filteredFiles.length} item(ns)
                </span>
                <div className="flex items-center space-x-1 ml-2">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('ALL')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      activeFilter === 'ALL'
                        ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('BACKUPS')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      activeFilter === 'BACKUPS'
                        ? 'bg-amber-600/30 text-amber-400 border border-amber-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Backups JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('DOCS')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      activeFilter === 'DOCS'
                        ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Documentos & CSVs
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar por nome..."
                    className="pl-8 pr-3 py-1.5 bg-slate-900 text-xs text-white placeholder-slate-500 rounded-lg border border-slate-700/70 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
                  />
                </div>

                <button
                  type="button"
                  onClick={loadDriveData}
                  disabled={isLoadingFiles}
                  title="Atualizar lista do Google Drive"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* File List Table */}
            <div className="overflow-x-auto">
              {isLoadingFiles ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                  <p className="text-xs">Sincronizando com sua pasta no Google Drive...</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <HardDrive className="w-8 h-8 text-slate-600 mx-auto mb-2.5" />
                  <p className="text-sm font-semibold text-slate-300">
                    Nenhum arquivo encontrado
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Gere uma nova cópia de segurança em JSON ou envie um documento para começar.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--graphite-border-subtle)] text-[10px] uppercase font-bold text-slate-400 tracking-wider bg-slate-900/50">
                      <th className="py-2.5 px-4">Nome do Arquivo</th>
                      <th className="py-2.5 px-4">Tamanho</th>
                      <th className="py-2.5 px-4">Última Modificação</th>
                      <th className="py-2.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--graphite-border-subtle)] text-xs text-slate-200">
                    {filteredFiles.map((file) => {
                      const isJsonBackup = file.name.endsWith('.json') || file.mimeType.includes('json');

                      return (
                        <tr
                          key={file.id}
                          className="hover:bg-slate-800/40 transition-colors group"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2.5">
                              {getFileIcon(file)}
                              <div className="min-w-0">
                                <span className="font-semibold text-white truncate block max-w-xs sm:max-w-md">
                                  {file.name}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  ID: {file.id.slice(0, 14)}...
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {formatDriveFileSize(file.size)}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {file.modifiedTime ? formatDateTimeBR(file.modifiedTime) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Open on Web */}
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir no Google Drive oficial"
                                  className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors inline-flex"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {/* Restore from JSON Backup */}
                              {isJsonBackup && (
                                <button
                                  type="button"
                                  onClick={() => setRestoreConfirmTarget(file)}
                                  title="Restaurar banco de dados a partir deste backup"
                                  className="flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors"
                                >
                                  <FolderSync className="w-3 h-3" />
                                  <span>Restaurar</span>
                                </button>
                              )}

                              {/* Delete from Drive (Mandatory confirmation) */}
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmTarget(file)}
                                title="Excluir arquivo do Google Drive"
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Unauthenticated Callout */
        <div className="bg-[#1a1d24] border border-dashed border-slate-700/80 rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h4 className="text-sm font-bold text-white">
              Conecte sua Conta Google Drive
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Vincule sua conta para criar cópias de segurança criptografadas em nuvem, exportar relatórios diretamente para planilhas e gerenciar recibos fiscais com total comodidade e segurança.
            </p>
          </div>
          <div className="pt-2">
            <GoogleSignInButton
              user={user}
              token={token}
              isLoading={isAuthLoading}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
              buttonText="Fazer Login com o Google"
            />
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Modal for Destructive Delete Operation */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e232d] border border-rose-500/40 rounded-xl max-w-md w-full p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h4 className="text-base font-bold text-white">Confirmar Exclusão no Google Drive</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir permanentemente o arquivo{' '}
              <strong className="text-rose-300 font-semibold">{deleteConfirmTarget.name}</strong>{' '}
              do seu Google Drive? Esta ação não poderá ser desfeita.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir Arquivo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Modal for Database Restore */}
      {restoreConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e232d] border border-amber-500/40 rounded-xl max-w-md w-full p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-amber-400">
              <FolderSync className="w-6 h-6 flex-shrink-0" />
              <h4 className="text-base font-bold text-white">Restaurar Banco de Dados</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Você está prestes a carregar os dados contidos no arquivo{' '}
              <strong className="text-amber-300 font-semibold">{restoreConfirmTarget.name}</strong>{' '}
              do Google Drive. Os registros atuais serão atualizados com o conteúdo desta cópia.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRestoreConfirmTarget(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Confirmar Restauração</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>);
};

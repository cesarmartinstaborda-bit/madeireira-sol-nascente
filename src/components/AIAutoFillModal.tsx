import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Table as TableIcon,
  HelpCircle,
  ArrowRight,
  Info,
} from 'lucide-react';
import { processDocumentWithAI, FieldMapping, DocumentParseResult } from '../services/aiService';
import { ALL_TABLE_SCHEMAS, getTableSchema } from '../services/ai/tableSchemas';
import { TableSchema } from '../services/ai/types';

interface AIAutoFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTableKey?: string;
  onConfirmFill: (tableKey: string, extractedData: Record<string, any>) => void;
}

export const AIAutoFillModal: React.FC<AIAutoFillModalProps> = ({
  isOpen,
  onClose,
  defaultTableKey = 'Cargas',
  onConfirmFill,
}) => {
  const [selectedTableKey, setSelectedTableKey] = useState<string>(defaultTableKey);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<DocumentParseResult | null>(null);
  const [editableValues, setEditableValues] = useState<Record<string, any>>({});
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTableKey(defaultTableKey || 'Cargas');
      setFile(null);
      setPreviewUrl(null);
      setFileBase64(null);
      setParseResult(null);
      setEditableValues({});
      setErrorMessage(null);
    }
  }, [isOpen, defaultTableKey]);

  if (!isOpen) return null;

  const currentSchema: TableSchema = getTableSchema(selectedTableKey);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile) return;

    setErrorMessage(null);
    setParseResult(null);
    setFile(selectedFile);
    setFileMimeType(selectedFile.type || 'application/octet-stream');

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      setFileBase64(resultStr);

      if (selectedFile.type.startsWith('image/')) {
        setPreviewUrl(resultStr);
      } else {
        setPreviewUrl(null);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Erro ao carregar o arquivo localmente.');
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      handleFileSelect(dropped);
    }
  };

  const handleProcessDocument = async () => {
    if (!fileBase64) {
      setErrorMessage('Por favor, selecione uma foto ou PDF do documento.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = await processDocumentWithAI(
        fileBase64,
        fileMimeType,
        selectedTableKey,
        currentSchema.fields,
        file?.name
      );

      setParseResult(result);

      if (result.success) {
        setEditableValues(result.data || {});
      } else {
        setErrorMessage(result.error || 'Não foi possível extrair dados automaticamente do documento.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Ocorreu um erro durante o processamento do documento.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFieldChange = (key: string, value: any) => {
    setEditableValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleConfirm = () => {
    onConfirmFill(selectedTableKey, editableValues);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-150">
      <div className="mac-hud w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Preencher com Gemini IA
                <span className="text-[10px] font-mono uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  gemini-1.5-flash
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Extração inteligente de comprovantes, notas fiscais, recibos e tickets de pesagem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Table Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-2 flex items-center gap-1.5">
              <TableIcon className="w-3.5 h-3.5 text-blue-400" />
              Tabela de Destino
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {Object.entries(ALL_TABLE_SCHEMAS).map(([key, schema]) => {
                const isSelected = selectedTableKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedTableKey(key);
                      setParseResult(null);
                      setEditableValues({});
                    }}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-left flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/40 text-blue-400 shadow-xs'
                        : 'bg-white/[0.03] border-white/[0.08] text-slate-200 hover:bg-white/[0.07]'
                    }`}
                  >
                    <span className="font-semibold truncate">{schema.tableName.split(' ')[0]}</span>
                    <span className="text-[10px] text-slate-400 mt-1 truncate">{key}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload Area */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-6 space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[200px] ${
                  dragOver
                    ? 'border-[#0A84FF] bg-[#0A84FF]/10'
                    : file
                    ? 'border-[#0A84FF]/40 bg-[#3A3A3C]/40'
                    : 'border-[#48484A] bg-[#3A3A3C]/30 hover:bg-[#3A3A3C]/60 hover:border-[#48484A]/80'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                {file ? (
                  <div className="space-y-3 w-full">
                    {previewUrl ? (
                      <div className="relative max-h-36 overflow-hidden rounded-lg border border-[#48484A]/40 mx-auto inline-block">
                        <img src={previewUrl} alt="Preview" className="max-h-36 object-contain" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto text-[#0A84FF]">
                        <FileText className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-[#F5F5F7] truncate max-w-xs mx-auto">{file.name}</p>
                      <p className="text-[10px] text-[#8E8E93]">
                        {(file.size / 1024).toFixed(1)} KB • Clique ou arraste para trocar
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#3A3A3C] border border-[#48484A]/40 flex items-center justify-center mx-auto text-[#8E8E93]">
                      <UploadCloud className="w-6 h-6 text-[#0A84FF]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#F5F5F7]">Arraste uma foto ou PDF do documento</p>
                      <p className="text-[11px] text-[#8E8E93] mt-0.5">Formatos suportados: JPG, PNG, WEBP, PDF</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={!fileBase64 || isProcessing}
                onClick={handleProcessDocument}
                className="w-full mac-button-accent py-2.5 text-xs font-bold flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando documento com Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analisar e Extrair Campos</span>
                  </>
                )}
              </button>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-[#FF453A]/15 border border-[#FF453A]/30 text-[#FF453A] text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Preview and Edit Fields */}
            <div className="md:col-span-6 space-y-4">
              <div className="bg-[#3A3A3C]/40 border border-[#48484A]/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#48484A]/40">
                  <span className="text-xs font-semibold text-[#F5F5F7] flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#0A84FF]" />
                    Campos Extraídos para {currentSchema.tableName.split(' ')[0]}
                  </span>
                  {parseResult && (
                    <span className="text-[10px] text-[#30D158] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {parseResult.mappings.filter((m) => m.status === 'matched').length} de{' '}
                      {currentSchema.fields.length} campos
                    </span>
                  )}
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {currentSchema.fields.map((field) => {
                    const value = editableValues[field.key] ?? '';
                    const mapping = parseResult?.mappings.find((m) => m.key === field.key);
                    const isMatched = mapping?.status === 'matched';

                    return (
                      <div key={field.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-medium text-[#8E8E93] flex items-center gap-1">
                            <span>{field.label}</span>
                            {field.required && <span className="text-[#FF453A]">*</span>}
                          </label>
                          {parseResult && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                                isMatched
                                  ? 'bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/30'
                                  : 'bg-white/5 text-[#8E8E93]'
                              }`}
                            >
                              {isMatched ? 'Detectado' : 'Vazio'}
                            </span>
                          )}
                        </div>

                        {field.type === 'select' && field.options ? (
                          <select
                            value={value}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 mac-input"
                          >
                            <option value="">Selecione...</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'currency' || field.type === 'number' ? (
                          <input
                            type="number"
                            step="any"
                            value={value}
                            placeholder={field.example || '0.00'}
                            onChange={(e) =>
                              handleFieldChange(
                                field.key,
                                e.target.value === '' ? '' : Number(e.target.value)
                              )
                            }
                            className="w-full text-xs px-2.5 py-1.5 mac-input font-mono"
                          />
                        ) : field.type === 'date' ? (
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 mac-input font-mono"
                          />
                        ) : (
                          <input
                            type="text"
                            value={value}
                            placeholder={field.example || ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 mac-input"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {parseResult && parseResult.ignoredData && parseResult.ignoredData.length > 0 && (
                  <div className="pt-2 border-t border-[#48484A]/40">
                    <p className="text-[10px] font-semibold text-[#8E8E93] flex items-center gap-1 mb-1">
                      <Info className="w-3 h-3 text-[#8E8E93]" />
                      Dados ignorados do documento (fora da tabela):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {parseResult.ignoredData.map((item, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] px-1.5 py-0.5 bg-white/5 border border-[#48484A]/40 rounded text-[#8E8E93] truncate max-w-xs"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="mac-button-secondary text-xs px-4 py-2"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!parseResult && Object.keys(editableValues).length === 0}
            onClick={handleConfirm}
            className="mac-button-primary px-5 py-2 text-xs flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmar e Salvar Registro</span>
          </button>
        </div>
      </div>
    </div>
  );
};

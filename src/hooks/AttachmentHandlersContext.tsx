import { createContext } from 'react';
import type { CargaAttachmentHandlers } from './useCargaAttachmentHandlers';

/**
 * Operações de anexo PDF disponibilizadas pelo App às tabelas (clipe da linha). Sem provedor
 * (testes e telas isoladas) o valor é `null` e o indicador de anexos fica só informativo.
 */
export const AttachmentHandlersContext = createContext<CargaAttachmentHandlers | null>(null);

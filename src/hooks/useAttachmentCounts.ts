import { useEffect, useState } from 'react';
import { ATTACHMENTS_CHANGED_EVENT, getAttachmentCounts, isLocalAttachmentsAvailable } from '../utils/cargaAttachments';

/**
 * Quantidade de anexos por carga, lida do armazenamento local deste computador (cargas sem
 * anexo não aparecem). Sem a ponte do Electron (navegador, testes) devolve sempre `{}`, então
 * as tabelas ficam exatamente como eram.
 */
export function useAttachmentCounts(): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isLocalAttachmentsAvailable()) return;
    let active = true;
    let latest = 0;
    const load = () => {
      const request = ++latest; // respostas fora de ordem: só a mais recente vale
      getAttachmentCounts()
        .then((next) => { if (active && request === latest) setCounts(next); })
        .catch(() => { /* indicador é só informativo: falha deixa a tabela como está */ });
    };
    load();
    window.addEventListener(ATTACHMENTS_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(ATTACHMENTS_CHANGED_EVENT, load);
    };
  }, []);

  return counts;
}

'use strict';

/**
 * Anexos PDF das cargas, guardados somente neste computador.
 *
 * Layout em disco (dentro de `userData`, que sobrevive a atualizações do RPM):
 *   <raiz>/<cargaId>/<anexoId>.pdf    arquivo copiado
 *   <raiz>/<cargaId>/<anexoId>.json   metadados (nome original, tamanho, data)
 *
 * A associação carga <-> anexos é a própria pasta da carga; nada vai para o Firestore nem
 * para o banco do app, então outra máquina nunca recebe referência quebrada.
 *
 * Consistência: o `.json` é o "commit" do anexo. O PDF é copiado para um arquivo temporário,
 * conferido e renomeado; só então o `.json` é gravado (também via temporário). Uma falha em
 * qualquer etapa remove o que foi criado, e um PDF sem `.json` (queda de energia no meio da
 * cópia) simplesmente não aparece na lista.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const CARGA_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ATTACHMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

class AttachmentError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'AttachmentError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

// Caracteres de controle, separadores de caminho, reservados do Windows e de direção de texto
// (RLO e afins, usados para disfarçar extensões). Escrito só com ASCII de propósito.
const UNSAFE_NAME_CHARS = new RegExp(
  '[\\u0000-\\u001f\\u007f/\\\\:*?"<>|\\u061c\\u200b-\\u200f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069\\ufeff]',
  'g'
);

function sanitizeFileName(name) {
  const cleaned = String(name || '')
    .replace(UNSAFE_NAME_CHARS, '_')
    .replace(/^\.+/, '')
    .trim();
  const base = cleaned || 'anexo.pdf';
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

function isMissing(error) {
  return Boolean(error) && error.code === 'ENOENT';
}

function createLocalAttachments({ getRootDir, fsModule = fs, randomUUID = crypto.randomUUID, now = () => new Date() }) {
  const fsp = fsModule.promises;

  // Operações que alteram a mesma pasta de carga rodam em fila (ex.: um `rmdir` de "pasta vazia"
  // não pode acontecer entre o `mkdir` e a cópia de outra adição simultânea).
  const tails = new Map();
  function withCargaLock(cargaId, task) {
    const previous = tails.get(cargaId) || Promise.resolve();
    const run = previous.then(task, task);
    const tail = run.catch(() => {});
    tails.set(cargaId, tail);
    tail.then(() => { if (tails.get(cargaId) === tail) tails.delete(cargaId); });
    return run;
  }

  function rootDir() {
    const root = getRootDir();
    if (typeof root !== 'string' || !path.isAbsolute(root)) {
      throw new AttachmentError('UNAVAILABLE', 'A pasta de dados do aplicativo não está disponível.');
    }
    return root;
  }

  function cargaDir(cargaId) {
    if (typeof cargaId !== 'string' || !CARGA_ID_PATTERN.test(cargaId)) {
      throw new AttachmentError('INVALID_ID', 'Identificador de carga inválido.');
    }
    const root = rootDir();
    const dir = path.join(root, cargaId);
    // Cinto e suspensório: o regex já impede separadores, mas o resultado precisa ficar dentro da raiz.
    if (path.dirname(dir) !== root) throw new AttachmentError('INVALID_ID', 'Identificador de carga inválido.');
    return dir;
  }

  function attachmentPaths(cargaId, attachmentId) {
    if (typeof attachmentId !== 'string' || !ATTACHMENT_ID_PATTERN.test(attachmentId)) {
      throw new AttachmentError('INVALID_ID', 'Identificador de anexo inválido.');
    }
    const dir = cargaDir(cargaId);
    return { dir, pdf: path.join(dir, `${attachmentId}.pdf`), meta: path.join(dir, `${attachmentId}.json`) };
  }

  async function readEntry(dir, attachmentId) {
    let raw;
    try {
      raw = await fsp.readFile(path.join(dir, `${attachmentId}.json`), 'utf8');
    } catch {
      return null;
    }
    let meta;
    try {
      meta = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!meta || meta.id !== attachmentId || typeof meta.fileName !== 'string') return null;
    try {
      const stat = await fsp.stat(path.join(dir, `${attachmentId}.pdf`));
      if (!stat.isFile()) return null;
    } catch {
      return null; // PDF sumiu: o anexo não é listado (sem referência fantasma)
    }
    return {
      id: attachmentId,
      fileName: sanitizeFileName(meta.fileName),
      sizeBytes: Number.isFinite(meta.sizeBytes) && meta.sizeBytes >= 0 ? meta.sizeBytes : 0,
      addedAt: typeof meta.addedAt === 'string' ? meta.addedAt : '',
    };
  }

  async function list(cargaId) {
    const dir = cargaDir(cargaId);
    let names;
    try {
      names = await fsp.readdir(dir);
    } catch (error) {
      if (isMissing(error)) return [];
      throw new AttachmentError('LIST_FAILED', 'Não foi possível ler os anexos da carga.', error);
    }
    const entries = [];
    for (const name of names) {
      const match = /^(.+)\.json$/.exec(name);
      if (!match || !ATTACHMENT_ID_PATTERN.test(match[1])) continue;
      const entry = await readEntry(dir, match[1]);
      if (entry) entries.push(entry);
    }
    return entries.sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id));
  }

  /** Quantidade de anexos por carga (só cargas com pelo menos um), para sinalizar nas tabelas. */
  async function summary() {
    let names;
    try {
      names = await fsp.readdir(rootDir());
    } catch (error) {
      if (isMissing(error)) return {};
      throw new AttachmentError('LIST_FAILED', 'Não foi possível ler a pasta de anexos.', error);
    }
    const counts = {};
    for (const name of names) {
      if (!CARGA_ID_PATTERN.test(name)) continue;
      const count = (await list(name).catch(() => [])).length;
      if (count > 0) counts[name] = count;
    }
    return counts;
  }

  async function validateSource(sourcePath) {
    if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath)) {
      throw new AttachmentError('INVALID_FILE', 'Arquivo inválido.');
    }
    if (!/\.pdf$/i.test(sourcePath)) {
      throw new AttachmentError('INVALID_FILE', 'Somente arquivos PDF são aceitos.');
    }
    let stat;
    try {
      stat = await fsp.stat(sourcePath);
    } catch (error) {
      throw new AttachmentError('INVALID_FILE', 'Não foi possível ler o arquivo selecionado.', error);
    }
    if (!stat.isFile()) throw new AttachmentError('INVALID_FILE', 'O item selecionado não é um arquivo.');
    if (stat.size === 0) throw new AttachmentError('INVALID_FILE', 'O arquivo está vazio.');
    if (stat.size > MAX_ATTACHMENT_BYTES) {
      throw new AttachmentError('TOO_LARGE', `O PDF excede o limite de ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`);
    }
    let handle;
    try {
      handle = await fsp.open(sourcePath, 'r');
      const header = Buffer.alloc(5);
      await handle.read(header, 0, 5, 0);
      if (header.toString('latin1') !== '%PDF-') {
        throw new AttachmentError('INVALID_FILE', 'O arquivo não é um PDF válido.');
      }
    } catch (error) {
      if (error instanceof AttachmentError) throw error;
      throw new AttachmentError('INVALID_FILE', 'Não foi possível ler o arquivo selecionado.', error);
    } finally {
      if (handle) await handle.close().catch(() => {});
    }
    return stat.size;
  }

  async function addOne(cargaId, sourcePath) {
    const size = await validateSource(sourcePath);
    const id = randomUUID();
    const { dir, pdf, meta } = attachmentPaths(cargaId, id);
    const tmpPdf = `${pdf}.tmp`;
    const tmpMeta = `${meta}.tmp`;
    const entry = {
      id,
      fileName: sanitizeFileName(path.basename(sourcePath)),
      sizeBytes: size,
      addedAt: now().toISOString(),
    };
    try {
      await fsp.mkdir(dir, { recursive: true, mode: 0o700 });
      await fsp.copyFile(sourcePath, tmpPdf, fs.constants.COPYFILE_EXCL);
      const copied = await fsp.stat(tmpPdf);
      if (copied.size !== size) throw new Error('Tamanho copiado diferente do original.');
      await fsp.rename(tmpPdf, pdf);
      await fsp.writeFile(tmpMeta, JSON.stringify(entry), { mode: 0o600, flag: 'wx' });
      await fsp.rename(tmpMeta, meta); // commit: só agora o anexo existe para o app
    } catch (error) {
      await Promise.all([tmpPdf, pdf, tmpMeta, meta].map((file) => fsp.rm(file, { force: true }).catch(() => {})));
      await fsp.rmdir(dir).catch(() => {}); // remove a pasta se ficou vazia
      throw new AttachmentError('COPY_FAILED', 'Não foi possível copiar o PDF para o armazenamento do aplicativo.', error);
    }
    return entry;
  }

  /** Copia cada arquivo; a falha de um não impede os demais nem altera a carga. */
  async function addFromPaths(cargaId, sourcePaths) {
    cargaDir(cargaId); // valida o id antes de tocar em qualquer arquivo
    return withCargaLock(cargaId, () => addAll(cargaId, sourcePaths));
  }

  async function addAll(cargaId, sourcePaths) {
    const added = [];
    const failed = [];
    for (const sourcePath of Array.isArray(sourcePaths) ? sourcePaths : []) {
      try {
        added.push(await addOne(cargaId, sourcePath));
      } catch (error) {
        failed.push({
          fileName: typeof sourcePath === 'string' ? sanitizeFileName(path.basename(sourcePath)) : '',
          code: error instanceof AttachmentError ? error.code : 'COPY_FAILED',
          message: error instanceof AttachmentError ? error.message : 'Falha ao copiar o PDF.',
        });
      }
    }
    return { added, failed };
  }

  async function resolveFile(cargaId, attachmentId) {
    const { dir } = attachmentPaths(cargaId, attachmentId);
    const entry = await readEntry(dir, attachmentId);
    if (!entry) throw new AttachmentError('NOT_FOUND', 'O anexo não foi encontrado neste computador.');
    return { filePath: path.join(dir, `${attachmentId}.pdf`), fileName: entry.fileName };
  }

  /** Exporta uma cópia para fora do aplicativo; um destino existente só é trocado se a cópia terminar. */
  async function exportTo(cargaId, attachmentId, destinationPath) {
    if (typeof destinationPath !== 'string' || !path.isAbsolute(destinationPath)) {
      throw new AttachmentError('INVALID_FILE', 'Destino inválido.');
    }
    const { filePath } = await resolveFile(cargaId, attachmentId);
    const appended = !/\.pdf$/i.test(destinationPath);
    const target = appended ? `${destinationPath}.pdf` : destinationPath;
    if (path.resolve(target) === path.resolve(filePath)) {
      throw new AttachmentError('INVALID_FILE', 'O destino não pode ser o próprio arquivo do aplicativo.');
    }
    // O diálogo só confirmou sobrescrever o nome digitado; se acrescentamos ".pdf" e já existe um
    // arquivo com esse nome, ele não foi confirmado pelo usuário e não pode ser trocado.
    if (appended && (await fsp.stat(target).then(() => true, () => false))) {
      throw new AttachmentError('EXPORT_FAILED', 'Já existe um arquivo com esse nome. Escolha outro nome para salvar.');
    }
    const partial = `${target}.part`;
    try {
      await fsp.copyFile(filePath, partial);
      await fsp.rename(partial, target);
    } catch (error) {
      await fsp.rm(partial, { force: true }).catch(() => {});
      throw new AttachmentError('EXPORT_FAILED', 'Não foi possível salvar o PDF no local escolhido.', error);
    }
    return target;
  }

  /** Remove o registro primeiro (o anexo some da lista) e depois o arquivo; ausência conta como sucesso. */
  async function remove(cargaId, attachmentId) {
    const { dir, pdf, meta } = attachmentPaths(cargaId, attachmentId);
    return withCargaLock(cargaId, () => removeLocked(dir, pdf, meta));
  }

  async function removeLocked(dir, pdf, meta) {
    try {
      await fsp.rm(meta, { force: true });
    } catch (error) {
      throw new AttachmentError('DELETE_FAILED', 'Não foi possível excluir o anexo.', error);
    }
    try {
      await fsp.rm(pdf, { force: true });
    } catch (error) {
      // O anexo já saiu da lista; o arquivo solto é varrido quando a pasta da carga for removida.
      console.warn('[Anexos] Arquivo PDF não removido (já fora da lista):', error);
    }
    await fsp.rmdir(dir).catch(() => {}); // só remove se ficou vazia
    return true;
  }

  /** Apaga a pasta inteira da carga (anexos e eventuais restos). */
  async function removeForCarga(cargaId) {
    const dir = cargaDir(cargaId);
    return withCargaLock(cargaId, () => removeFolder(dir));
  }

  async function removeFolder(dir) {
    try {
      await fsp.rm(dir, { recursive: true, force: true });
    } catch (error) {
      throw new AttachmentError('DELETE_FAILED', 'Não foi possível apagar a pasta de anexos da carga.', error);
    }
    return true;
  }

  /** Valida o id da carga sem tocar no disco (a IPC o usa antes de abrir o seletor de arquivos). */
  function assertCargaId(cargaId) {
    cargaDir(cargaId);
  }

  return { assertCargaId, list, summary, addFromPaths, resolveFile, exportTo, remove, removeForCarga };
}

module.exports = { createLocalAttachments, AttachmentError, MAX_ATTACHMENT_BYTES, sanitizeFileName };

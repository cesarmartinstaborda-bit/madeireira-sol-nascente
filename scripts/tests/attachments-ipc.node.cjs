const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createLocalAttachments, AttachmentError } = require('../../electron/localAttachments.js');
const { registerAttachmentsIpc, ATTACHMENT_CHANNELS } = require('../../electron/attachmentsIpc.js');

function setup({ pickedPaths = [], saveTo = null, openProblem = '' } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'anexos-ipc-'));
  const handlers = {};
  const calls = { open: [], save: [], shell: [] };
  const authorize = { ok: true };
  const store = createLocalAttachments({ getRootDir: () => path.join(base, 'userData', 'attachments') });
  const dialog = {
    showOpenDialog: async (win, options) => { calls.open.push(options); return pickedPaths ? { canceled: false, filePaths: pickedPaths } : { canceled: true, filePaths: [] }; },
    showSaveDialog: async (win, options) => { calls.save.push(options); return saveTo ? { canceled: false, filePath: saveTo } : { canceled: true }; },
  };
  const shell = { openPath: async (file) => { calls.shell.push(file); return openProblem; } };
  registerAttachmentsIpc({
    ipcMain: { handle: (name, fn) => { handlers[name] = fn; } },
    dialog, shell, store,
    requireMainFrame: () => { if (!authorize.ok) throw new Error('Origem IPC não autorizada.'); },
    getWindow: () => ({ fake: 'window' }),
    getDownloadsDir: () => path.join(base, 'Downloads'),
  });
  const pdf = (name, body = '%PDF-1.4 teste') => { const f = path.join(base, name); fs.writeFileSync(f, body); return f; };
  return { base, handlers, calls, authorize, store, pdf, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

test('registra exatamente os canais de anexos e todos recusam origem não autorizada antes de agir', async () => {
  const s = setup();
  try {
    assert.deepEqual(Object.keys(s.handlers).sort(), [...ATTACHMENT_CHANNELS].sort());
    s.authorize.ok = false;
    for (const [name, fn] of Object.entries(s.handlers)) {
      await assert.rejects(async () => fn({}, 'crg-1', 'x'), /IPC/, name);
    }
    assert.equal(s.calls.open.length + s.calls.save.length + s.calls.shell.length, 0, 'nenhum diálogo/shell antes da validação');
  } finally { s.cleanup(); }
});

test('adicionar: o diálogo é aberto no processo principal (PDF, múltipla seleção) e a cópia é feita lá', async () => {
  const s = setup();
  try {
    const picked = [s.pdf('a.pdf'), s.pdf('b.pdf'), s.pdf('c.txt', 'texto')];
    const h = setup({ pickedPaths: picked });
    const result = await h.handlers['attachments-add']({}, 'crg-1', '/etc/passwd' /* argumento extra é ignorado */);
    assert.equal(result.ok, true);
    assert.equal(result.data.canceled, false);
    assert.deepEqual(result.data.added.map((a) => a.fileName).sort(), ['a.pdf', 'b.pdf']);
    assert.equal(result.data.failed.length, 1);
    assert.deepEqual(h.calls.open[0].filters, [{ name: 'PDF', extensions: ['pdf'] }]);
    assert.ok(h.calls.open[0].properties.includes('multiSelections'));
    const listed = await h.handlers['attachments-list']({}, 'crg-1');
    assert.equal(listed.data.length, 2);
    assert.deepEqual((await h.handlers['attachments-summary']({})).data, { 'crg-1': 2 });
    h.cleanup();
  } finally { s.cleanup(); }
});

test('adicionar cancelado não altera nada; id inválido vira erro no envelope, sem lançar', async () => {
  const s = setup({ pickedPaths: null });
  try {
    assert.deepEqual((await s.handlers['attachments-add']({}, 'crg-1')).data, { canceled: true, added: [], failed: [] });
    const bad = await s.handlers['attachments-add']({}, '../fora');
    assert.deepEqual(bad.ok, false);
    assert.equal(bad.code, 'INVALID_ID');
    const unexpected = await s.handlers['attachments-list']({}, { toString() { throw new Error('x'); } });
    assert.equal(unexpected.ok, false);
  } finally { s.cleanup(); }
});

test('abrir usa o visualizador do sistema; falha vira OPEN_FAILED; anexo inexistente vira NOT_FOUND', async () => {
  const s = setup({ pickedPaths: [] });
  try {
    const src = s.pdf('a.pdf');
    const { added } = await s.store.addFromPaths('crg-1', [src]);
    const ok = await s.handlers['attachments-open']({}, 'crg-1', added[0].id);
    assert.equal(ok.ok, true);
    assert.ok(s.calls.shell[0].endsWith(`${added[0].id}.pdf`));
    assert.equal((await s.handlers['attachments-open']({}, 'crg-1', '11111111-1111-4111-8111-111111111111')).code, 'NOT_FOUND');

    const failing = setup({ openProblem: 'sem aplicativo' });
    const copy = await failing.store.addFromPaths('crg-1', [failing.pdf('a.pdf')]);
    assert.equal((await failing.handlers['attachments-open']({}, 'crg-1', copy.added[0].id)).code, 'OPEN_FAILED');
    failing.cleanup();
  } finally { s.cleanup(); }
});

test('exportar: sugere o nome original em Downloads, grava a cópia ou respeita o cancelamento', async () => {
  const s = setup();
  try {
    const { added } = await s.store.addFromPaths('crg-1', [s.pdf('Romaneio.pdf')]);
    const target = path.join(s.base, 'Downloads');
    fs.mkdirSync(target);

    const canceled = setup({ saveTo: null });
    const c = await canceled.store.addFromPaths('crg-1', [canceled.pdf('a.pdf')]);
    assert.deepEqual((await canceled.handlers['attachments-export']({}, 'crg-1', c.added[0].id)).data, { canceled: true });
    canceled.cleanup();

    const withDest = setup({ saveTo: path.join(target, 'saida.pdf') });
    const w = await withDest.store.addFromPaths('crg-1', [withDest.pdf('Romaneio.pdf', '%PDF-1.4 X')]);
    fs.mkdirSync(path.join(withDest.base, 'Downloads'), { recursive: true });
    const result = await withDest.handlers['attachments-export']({}, 'crg-1', w.added[0].id);
    assert.equal(result.data.canceled, false);
    assert.equal(fs.readFileSync(result.data.path, 'latin1'), '%PDF-1.4 X');
    assert.equal(withDest.calls.save[0].defaultPath, path.join(withDest.base, 'Downloads', 'Romaneio.pdf'));
    assert.equal(added.length, 1);
    withDest.cleanup();
  } finally { s.cleanup(); }
});

test('excluir anexo e excluir carga passam pelo núcleo; falhas voltam como envelope de erro', async () => {
  const s = setup();
  try {
    const { added } = await s.store.addFromPaths('crg-1', [s.pdf('a.pdf'), s.pdf('b.pdf')]);
    assert.deepEqual(await s.handlers['attachments-remove']({}, 'crg-1', added[0].id), { ok: true, data: true });
    assert.equal((await s.store.list('crg-1')).length, 1);
    assert.deepEqual(await s.handlers['attachments-remove-carga']({}, 'crg-1'), { ok: true, data: true });
    assert.equal(fs.existsSync(path.join(s.base, 'userData', 'attachments', 'crg-1')), false);
    const invalid = await s.handlers['attachments-remove']({}, 'crg-1', '../../x');
    assert.deepEqual([invalid.ok, invalid.code], [false, 'INVALID_ID']);
  } finally { s.cleanup(); }
});

test('preload expõe só operações por carga/anexo, sem aceitar caminhos, e usa apenas os canais registrados', async () => {
  const invoked = [];
  let exposed;
  const context = vm.createContext({
    require: (name) => name === 'electron'
      ? { contextBridge: { exposeInMainWorld: (key, api) => { exposed = { key, api }; } }, ipcRenderer: { invoke: (...args) => { invoked.push(args); return Promise.resolve({ ok: true, data: null }); } } }
      : require(name),
  });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../preload.js'), 'utf8'), context);
  assert.equal(exposed.key, 'electron');
  const api = exposed.api.attachments;
  assert.deepEqual(Object.keys(api).sort(), ['add', 'exportCopy', 'list', 'open', 'remove', 'removeForCarga', 'summary']);
  await api.list('c'); await api.summary(); await api.add('c'); await api.open('c', 'a'); await api.exportCopy('c', 'a'); await api.remove('c', 'a'); await api.removeForCarga('c');
  assert.deepEqual(invoked.map(([channel]) => channel).sort(), [...ATTACHMENT_CHANNELS].sort());
  assert.deepEqual(invoked.find(([channel]) => channel === 'attachments-add'), ['attachments-add', 'c']);
  assert.equal(typeof exposed.api.googleSignIn, 'function'); // ponte do Google intacta
});

test('a pasta electron/ vai no pacote (RPM), senão o app instalado perderia os anexos', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
  assert.ok(pkg.build.files.includes('electron/**/*'));
  for (const file of ['localAttachments.js', 'attachmentsIpc.js']) {
    assert.ok(fs.existsSync(path.resolve(__dirname, '../../electron', file)));
  }
  const main = fs.readFileSync(path.resolve(__dirname, '../../electron.js'), 'utf8');
  assert.match(main, /path\.join\(app\.getPath\('userData'\), 'attachments'\)/);
});

test('AttachmentError é a classe usada nos erros do núcleo', async () => {
  const s = setup();
  try {
    await assert.rejects(s.store.list(''), (error) => error instanceof AttachmentError && error.code === 'INVALID_ID');
  } finally { s.cleanup(); }
});

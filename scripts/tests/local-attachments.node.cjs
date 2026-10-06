const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createLocalAttachments,
  AttachmentError,
  MAX_ATTACHMENT_BYTES,
  sanitizeFileName,
} = require('../../electron/localAttachments.js');

// Disco real em diretório temporário: o que importa aqui é o comportamento do sistema de arquivos.
function sandbox(options = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'anexos-test-'));
  const root = path.join(base, 'userData', 'attachments');
  const sources = path.join(base, 'origem');
  fs.mkdirSync(sources, { recursive: true });
  const store = createLocalAttachments({ getRootDir: () => root, ...options });
  const pdf = (name = 'nota.pdf', body = '%PDF-1.4\nconteudo de teste') => {
    const file = path.join(sources, name);
    fs.writeFileSync(file, body);
    return file;
  };
  return { base, root, sources, store, pdf, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

const tree = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).sort() : []);

test('copia o PDF para userData/attachments/<carga>/ com nome interno único e não depende mais do original', async () => {
  const s = sandbox();
  try {
    const source = s.pdf('Romaneio 123.pdf');
    const { added, failed } = await s.store.addFromPaths('crg-1', [source]);
    assert.equal(failed.length, 0);
    assert.equal(added.length, 1);
    const [entry] = added;
    assert.match(entry.id, /^[0-9a-f-]{36}$/);
    assert.equal(entry.fileName, 'Romaneio 123.pdf');
    assert.equal(entry.sizeBytes, fs.statSync(source).size);

    // arquivo e metadados dentro da pasta da carga; o nome em disco é o id, não o nome do usuário
    assert.deepEqual(tree(path.join(s.root, 'crg-1')), [`${entry.id}.json`, `${entry.id}.pdf`]);

    fs.rmSync(source); // o original some
    assert.deepEqual(await s.store.list('crg-1'), [entry]);
    const { filePath } = await s.store.resolveFile('crg-1', entry.id);
    assert.ok(fs.readFileSync(filePath, 'latin1').startsWith('%PDF-'));
  } finally { s.cleanup(); }
});

test('carga sem anexos (ou antiga) lista vazio sem criar nada em disco', async () => {
  const s = sandbox();
  try {
    assert.deepEqual(await s.store.list('crg-antiga'), []);
    assert.deepEqual(await s.store.summary(), {});
    assert.equal(fs.existsSync(s.root), false);
  } finally { s.cleanup(); }
});

test('aceita vários PDFs na mesma carga e a falha de um não afeta os demais', async () => {
  const s = sandbox();
  try {
    const ok1 = s.pdf('a.pdf');
    const ok2 = s.pdf('b.pdf', '%PDF-1.7 outro');
    const fake = s.pdf('falso.pdf', 'MZ nao e pdf');
    const wrongExt = path.join(s.sources, 'foto.png');
    fs.writeFileSync(wrongExt, '%PDF-1.4');
    const { added, failed } = await s.store.addFromPaths('crg-1', [ok1, fake, wrongExt, ok2, path.join(s.sources, 'inexistente.pdf')]);
    assert.deepEqual(added.map((a) => a.fileName).sort(), ['a.pdf', 'b.pdf']);
    assert.equal(failed.length, 3);
    assert.deepEqual(failed.map((f) => f.code), ['INVALID_FILE', 'INVALID_FILE', 'INVALID_FILE']);
    assert.equal((await s.store.list('crg-1')).length, 2);
    assert.equal(tree(path.join(s.root, 'crg-1')).length, 4); // sem restos dos que falharam
  } finally { s.cleanup(); }
});

test('recusa arquivo vazio, gigante, pasta e caminho relativo', async () => {
  const s = sandbox();
  try {
    const empty = s.pdf('vazio.pdf', '');
    const huge = path.join(s.sources, 'grande.pdf');
    fs.writeFileSync(huge, '%PDF-');
    fs.truncateSync(huge, MAX_ATTACHMENT_BYTES + 1);
    const folder = path.join(s.sources, 'pasta.pdf');
    fs.mkdirSync(folder);
    const { added, failed } = await s.store.addFromPaths('crg-1', [empty, huge, folder, 'relativo.pdf']);
    assert.equal(added.length, 0);
    assert.deepEqual(failed.map((f) => f.code), ['INVALID_FILE', 'TOO_LARGE', 'INVALID_FILE', 'INVALID_FILE']);
    assert.equal(fs.existsSync(path.join(s.root, 'crg-1')), false);
  } finally { s.cleanup(); }
});

test('ids que tentam sair da pasta são recusados antes de tocar em qualquer arquivo', async () => {
  const s = sandbox();
  try {
    const source = s.pdf();
    for (const bad of ['..', '.', 'a/b', 'a\\b', '', '../fora', '.oculto', 'x'.repeat(200)]) {
      await assert.rejects(s.store.addFromPaths(bad, [source]), { code: 'INVALID_ID' });
      await assert.rejects(s.store.list(bad), { code: 'INVALID_ID' });
      await assert.rejects(s.store.removeForCarga(bad), { code: 'INVALID_ID' });
    }
    await assert.rejects(s.store.remove('crg-1', '../../x'), { code: 'INVALID_ID' });
    await assert.rejects(s.store.resolveFile('crg-1', 'nao-e-uuid'), { code: 'INVALID_ID' });
    assert.equal(fs.existsSync(s.root), false);
  } finally { s.cleanup(); }
});

test('falha ao copiar não deixa arquivo, metadado nem pasta (nenhum anexo fantasma)', async () => {
  const failing = (method, when) => {
    const real = fs.promises[method];
    return { ...fs, promises: { ...fs.promises, [method]: (...args) => (when(args) ? Promise.reject(new Error(`falha simulada em ${method}`)) : real(...args)) } };
  };
  for (const [method, when] of [
    ['copyFile', () => true],
    ['rename', ([from]) => String(from).endsWith('.pdf.tmp')],
    ['writeFile', () => true],
    ['rename', ([from]) => String(from).endsWith('.json.tmp')],
  ]) {
    const s = sandbox({ fsModule: failing(method, when) });
    try {
      const { added, failed } = await s.store.addFromPaths('crg-1', [s.pdf()]);
      assert.equal(added.length, 0, `${method}: não pode registrar o anexo`);
      assert.equal(failed[0].code, 'COPY_FAILED');
      assert.deepEqual(await s.store.list('crg-1'), []);
      assert.deepEqual(tree(s.root), [], `${method}: sem restos em disco`);
    } finally { s.cleanup(); }
  }
});

test('PDF sem metadado (queda no meio da cópia) e metadado sem PDF não aparecem na lista', async () => {
  const s = sandbox();
  try {
    const { added } = await s.store.addFromPaths('crg-1', [s.pdf('bom.pdf')]);
    const dir = path.join(s.root, 'crg-1');
    fs.writeFileSync(path.join(dir, '11111111-1111-4111-8111-111111111111.pdf'), '%PDF-1.4'); // sem .json
    fs.writeFileSync(
      path.join(dir, '22222222-2222-4222-8222-222222222222.json'),
      JSON.stringify({ id: '22222222-2222-4222-8222-222222222222', fileName: 'fantasma.pdf', sizeBytes: 1, addedAt: 'x' })
    ); // sem .pdf
    fs.writeFileSync(path.join(dir, '33333333-3333-4333-8333-333333333333.json'), '{corrompido'); // lixo
    assert.deepEqual((await s.store.list('crg-1')).map((e) => e.id), [added[0].id]);
    await assert.rejects(s.store.resolveFile('crg-1', '22222222-2222-4222-8222-222222222222'), { code: 'NOT_FOUND' });
  } finally { s.cleanup(); }
});

test('os anexos sobrevivem ao reinício e a uma nova instalação: a pasta de dados é a fonte', async () => {
  const s = sandbox();
  try {
    const { added } = await s.store.addFromPaths('crg-1', [s.pdf()]);
    const reopened = createLocalAttachments({ getRootDir: () => s.root }); // novo processo, mesma userData
    assert.deepEqual(await reopened.list('crg-1'), added);
    assert.deepEqual(await reopened.summary(), { 'crg-1': 1 });
  } finally { s.cleanup(); }
});

test('exporta uma cópia para outro local; destino existente só é trocado se a cópia terminar', async () => {
  const s = sandbox();
  try {
    const { added } = await s.store.addFromPaths('crg-1', [s.pdf('nota.pdf', '%PDF-1.4 ORIGINAL')]);
    const destDir = path.join(s.base, 'Downloads');
    fs.mkdirSync(destDir);

    const out = await s.store.exportTo('crg-1', added[0].id, path.join(destDir, 'copia'));
    assert.equal(out, path.join(destDir, 'copia.pdf')); // acrescenta a extensão
    assert.equal(fs.readFileSync(out, 'latin1'), '%PDF-1.4 ORIGINAL');
    assert.equal((await s.store.list('crg-1')).length, 1); // o anexo continua no app

    fs.writeFileSync(path.join(destDir, 'existente.pdf'), 'ANTIGO');
    const failing = createLocalAttachments({
      getRootDir: () => s.root,
      fsModule: { ...fs, promises: { ...fs.promises, rename: () => Promise.reject(new Error('disco cheio')) } },
    });
    await assert.rejects(failing.exportTo('crg-1', added[0].id, path.join(destDir, 'existente.pdf')), { code: 'EXPORT_FAILED' });
    assert.equal(fs.readFileSync(path.join(destDir, 'existente.pdf'), 'utf8'), 'ANTIGO');
    assert.equal(fs.existsSync(path.join(destDir, 'existente.pdf.part')), false);

    const { filePath } = await s.store.resolveFile('crg-1', added[0].id);
    await assert.rejects(s.store.exportTo('crg-1', added[0].id, filePath), { code: 'INVALID_FILE' });
    await assert.rejects(s.store.exportTo('crg-1', added[0].id, 'relativo.pdf'), { code: 'INVALID_FILE' });
  } finally { s.cleanup(); }
});

test('exclusão individual remove só aquele anexo, é idempotente e limpa a pasta quando esvazia', async () => {
  const s = sandbox();
  try {
    const { added } = await s.store.addFromPaths('crg-1', [s.pdf('a.pdf'), s.pdf('b.pdf')]);
    assert.equal(await s.store.remove('crg-1', added[0].id), true);
    assert.deepEqual((await s.store.list('crg-1')).map((e) => e.id), [added[1].id]);
    assert.equal(await s.store.remove('crg-1', added[0].id), true); // já não existe: sucesso
    await s.store.remove('crg-1', added[1].id);
    assert.equal(fs.existsSync(path.join(s.root, 'crg-1')), false);
  } finally { s.cleanup(); }
});

test('falha ao apagar o registro mantém o anexo intacto (nada de meia exclusão)', async () => {
  const s = sandbox();
  try {
    const { added } = await s.store.addFromPaths('crg-1', [s.pdf()]);
    const failing = createLocalAttachments({
      getRootDir: () => s.root,
      fsModule: { ...fs, promises: { ...fs.promises, rm: () => Promise.reject(new Error('somente leitura')) } },
    });
    await assert.rejects(failing.remove('crg-1', added[0].id), { code: 'DELETE_FAILED' });
    assert.deepEqual(await s.store.list('crg-1'), added);
  } finally { s.cleanup(); }
});

test('excluir a carga apaga a pasta inteira (inclusive restos) sem tocar nas outras cargas', async () => {
  const s = sandbox();
  try {
    await s.store.addFromPaths('crg-1', [s.pdf('a.pdf'), s.pdf('b.pdf')]);
    const other = await s.store.addFromPaths('crg-2', [s.pdf('c.pdf')]);
    fs.writeFileSync(path.join(s.root, 'crg-1', 'resto.pdf.tmp'), 'lixo');

    assert.equal(await s.store.removeForCarga('crg-1'), true);
    assert.equal(fs.existsSync(path.join(s.root, 'crg-1')), false);
    assert.deepEqual(await s.store.list('crg-2'), other.added);
    assert.equal(await s.store.removeForCarga('crg-sem-pasta'), true); // ausência é sucesso
    assert.deepEqual(await s.store.summary(), { 'crg-2': 1 });
  } finally { s.cleanup(); }
});

test('nomes de arquivo do usuário são normalizados e nunca viram caminho', async () => {
  assert.equal(sanitizeFileName('a/b\\c.pdf'), 'a_b_c.pdf');
  const rlo = String.fromCharCode(0x202e); // direção de texto invertida: disfarça extensões
  assert.equal(sanitizeFileName(`..${rlo}fdp.exe`), '_fdp.exe.pdf');
  assert.equal(sanitizeFileName('a:b*c?.pdf'), 'a_b_c_.pdf');
  assert.equal(sanitizeFileName('romaneio'), 'romaneio.pdf');
  assert.equal(sanitizeFileName('   '), 'anexo.pdf');

  const s = sandbox();
  try {
    const odd = s.pdf('nota: "estranha" <1>.pdf');
    const { added } = await s.store.addFromPaths('crg-1', [odd]);
    assert.equal(added[0].fileName, 'nota_ _estranha_ _1_.pdf');
    assert.ok(tree(path.join(s.root, 'crg-1')).every((name) => /^[0-9a-f-]{36}\.(pdf|json)$/.test(name)));
  } finally { s.cleanup(); }
});

test('AttachmentError carrega código e mensagem em português', () => {
  const error = new AttachmentError('TOO_LARGE', 'grande');
  assert.equal(error.code, 'TOO_LARGE');
  assert.ok(error instanceof Error);
});

test('cópia truncada (disco cheio/erro silencioso) é detectada e descartada, sem anexo registrado', async () => {
  const truncating = {
    ...fs,
    promises: {
      ...fs.promises,
      copyFile: async (from, to, mode) => {
        await fs.promises.copyFile(from, to, mode);
        await fs.promises.truncate(to, 3); // grava só 3 bytes
      },
    },
  };
  const s = sandbox({ fsModule: truncating });
  try {
    const { added, failed } = await s.store.addFromPaths('crg-1', [s.pdf()]);
    assert.equal(added.length, 0);
    assert.equal(failed[0].code, 'COPY_FAILED');
    assert.deepEqual(tree(s.root), []);
  } finally { s.cleanup(); }
});

test('exportar sem digitar ".pdf" não sobrescreve em silêncio um arquivo que o diálogo não confirmou', async () => {
  const s = sandbox();
  try {
    const { added } = await s.store.addFromPaths('crg-1', [s.pdf('a.pdf', '%PDF-1.4 NOVO')]);
    const dest = path.join(s.base, 'Downloads');
    fs.mkdirSync(dest);
    fs.writeFileSync(path.join(dest, 'saida.pdf'), 'EXISTENTE');
    await assert.rejects(s.store.exportTo('crg-1', added[0].id, path.join(dest, 'saida')), { code: 'EXPORT_FAILED' });
    assert.equal(fs.readFileSync(path.join(dest, 'saida.pdf'), 'utf8'), 'EXISTENTE');
    // nome completo (o diálogo já confirmou a substituição): continua permitido
    await s.store.exportTo('crg-1', added[0].id, path.join(dest, 'saida.pdf'));
    assert.equal(fs.readFileSync(path.join(dest, 'saida.pdf'), 'latin1'), '%PDF-1.4 NOVO');
  } finally { s.cleanup(); }
});

test('adições e exclusões simultâneas na mesma carga não se atrapalham (sem ENOENT por rmdir concorrente)', async () => {
  const s = sandbox();
  try {
    const first = await s.store.addFromPaths('crg-1', [s.pdf('base.pdf')]);
    const files = Array.from({ length: 6 }, (_, i) => s.pdf(`n${i}.pdf`));
    const results = await Promise.all([
      s.store.remove('crg-1', first.added[0].id), // esvazia a pasta enquanto outras adições começam
      ...files.map((file) => s.store.addFromPaths('crg-1', [file])),
    ]);
    assert.equal(results[0], true);
    assert.ok(results.slice(1).every((r) => r.failed.length === 0 && r.added.length === 1));
    assert.equal((await s.store.list('crg-1')).length, 6);
    await Promise.all([s.store.removeForCarga('crg-1'), s.store.addFromPaths('crg-2', [s.pdf('x.pdf')])]);
    assert.equal(fs.existsSync(path.join(s.root, 'crg-1')), false);
    assert.equal((await s.store.list('crg-2')).length, 1);
  } finally { s.cleanup(); }
});

test('o nome mostrado em falhas também é normalizado (sem caracteres de direção) e cobre invisíveis extras', async () => {
  const rlo = String.fromCharCode(0x202e);
  const zwsp = String.fromCharCode(0x200b);
  const bom = String.fromCharCode(0xfeff);
  assert.equal(sanitizeFileName(`a${zwsp}b${bom}c.pdf`), 'a_b_c.pdf');
  const s = sandbox();
  try {
    const bad = path.join(s.sources, `nota${rlo}fdp.exe`);
    fs.writeFileSync(bad, 'x');
    const { failed } = await s.store.addFromPaths('crg-1', [bad]);
    assert.equal(failed.length, 1);
    assert.ok(!failed[0].fileName.includes(rlo));
  } finally { s.cleanup(); }
});

test('falha no meio do lote: o primeiro PDF fica, o segundo falha sem deixar restos (falha parcial ao adicionar)', async () => {
  let copies = 0;
  const flaky = {
    ...fs,
    promises: {
      ...fs.promises,
      copyFile: (...args) => (++copies === 2 ? Promise.reject(new Error('disco cheio na 2ª cópia')) : fs.promises.copyFile(...args)),
    },
  };
  const s = sandbox({ fsModule: flaky });
  try {
    const { added, failed } = await s.store.addFromPaths('crg-1', [s.pdf('ok1.pdf'), s.pdf('ok2.pdf'), s.pdf('ok3.pdf')]);
    assert.deepEqual(added.map((a) => a.fileName), ['ok1.pdf', 'ok3.pdf']);
    assert.equal(failed.length, 1);
    assert.equal(failed[0].code, 'COPY_FAILED');
    assert.equal(failed[0].fileName, 'ok2.pdf');
    const names = tree(path.join(s.root, 'crg-1'));
    assert.equal(names.length, 4); // 2 anexos x (pdf + json)
    assert.ok(names.every((n) => !n.endsWith('.tmp')));
    assert.equal((await s.store.list('crg-1')).length, 2);
  } finally { s.cleanup(); }
});

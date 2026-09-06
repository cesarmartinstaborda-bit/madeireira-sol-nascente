const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { initializeApp, deleteApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, collection, setDoc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch, onSnapshot, terminate } = require('firebase/firestore');
const root = resolve(__dirname, '../..');
const projectId = 'demo-madeireira-closure';
assert.equal(process.env.GCLOUD_PROJECT, projectId, 'Only the isolated demo project is allowed');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:18080', 'A loopback emulator is mandatory');
const config = JSON.parse(readFileSync(resolve(root, 'firebase-applet-config.json'), 'utf8'));
// The deployment configuration is preexisting local work, outside this commit.
if (existsSync(resolve(root, 'firebase.json'))) {
  const deployment = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
  assert.equal(deployment.firestore.database, config.firestoreDatabaseId, 'Local deploy target must match the app named database');
}
const databases = ['(default)']; // Named database rule loading is unsupported by this CLI emulator.
const entities = ['cargas', 'depositos', 'clientes', 'vendas', 'produtos', 'motoristas'];
const ownerPolicy = readFileSync(resolve(root, 'firestore.rules'), 'utf8').match(/token.email == '([^']+)'/);
const ownerEmail = ownerPolicy?.[1] ?? 'owner@example.invalid';
const claims = { sub: 'owner-test', email: ownerEmail, email_verified: true, firebase: { sign_in_provider: 'google.com' } };
const clients = [];
let environment;
before(async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 18080, rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8') } });
});
after(async () => {
  for (const { db, app } of clients) { await terminate(db); await deleteApp(app); }
  await environment?.cleanup();
});
function client(database, token) {
  const app = initializeApp({ projectId, apiKey: 'demo-key' }, `closure-${clients.length}`);
  const db = getFirestore(app, database);
  connectFirestoreEmulator(db, '127.0.0.1', 18080, token ? { mockUserToken: token } : undefined);
  clients.push({ app, db });
  return db;
}
for (const database of databases) {
  for (const entity of entities) test(`${database}: owner CRUD and list ${entity}`, async () => {
    const db = client(database, claims), ref = doc(db, entity, 'closure-fixture');
    await assertSucceeds(setDoc(ref, { id: 'closure-fixture', date: '2026-09-06', legacyExtra: 'preserved' }));
    await assertSucceeds(getDocs(collection(db, entity)));
    await assertSucceeds(updateDoc(ref, { value: 120.5 }));
    assert.equal((await getDoc(ref)).data().legacyExtra, 'preserved');
    await assertSucceeds(deleteDoc(ref));
  });
  for (const [role, token] of [
    ['anonymous', null],
    ['other Google account', { ...claims, sub: 'other', email: 'other@example.invalid' }],
    ['unverified owner email', { ...claims, email_verified: false }],
    ['password provider', { ...claims, firebase: { sign_in_provider: 'password' } }],
    ['missing claims', { sub: 'no-claims' }],
  ]) test(`${database}: deny ${role} on every collection`, { skip: role === 'other Google account' && !ownerPolicy ? 'Owner email restriction is preexisting local work, outside commit 5.1' : false }, async () => {
    const db = client(database, token);
    for (const entity of [...entities, 'settings']) {
      const ref = doc(db, entity, entity === 'settings' ? 'global' : 'closure-fixture');
      await assertFails(getDoc(ref)); await assertFails(getDocs(collection(db, entity)));
      await assertFails(setDoc(ref, { id: ref.id })); await assertFails(deleteDoc(ref));
    }
  });
  test(`${database}: settings/global works; extra settings writes, settings delete and unknown paths denied`, async () => {
    const db = client(database, claims);
    await assertSucceeds(setDoc(doc(db, 'settings/global'), { appSettings: { freightRatePerTon: 15 } }, { merge: true }));
    await assertSucceeds(getDocs(collection(db, 'settings')));
    await assertFails(setDoc(doc(db, 'settings/unauthorized'), {}));
    await assertFails(deleteDoc(doc(db, 'settings/global')));
    await assertFails(getDoc(doc(db, 'private/fixture')));
    await assertFails(setDoc(doc(db, 'cargas/fixture/nested/fixture'), {}));
  });
  test(`${database}: listener and authoritative restoration batch work for owner`, async () => {
    const db = client(database, claims), orphan = doc(db, 'cargas/old-record');
    await setDoc(orphan, { legacy: true });
    const batch = writeBatch(db); batch.delete(orphan);
    for (const entity of entities) batch.set(doc(db, entity, 'restored'), { id: 'restored', value: 10 }, { merge: true });
    batch.set(doc(db, 'settings/global'), { customLogo: null }, { merge: true });
    await assertSucceeds(batch.commit());
    assert.equal((await getDoc(orphan)).exists(), false);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { stop(); reject(new Error('Listener timeout')); }, 10000);
      const stop = onSnapshot(collection(db, 'cargas'), { includeMetadataChanges: true }, snapshot => {
        if (snapshot.metadata.fromCache) return;
        clearTimeout(timer); stop();
        try { assert(snapshot.docs.some(d => d.id === 'restored')); resolve(); } catch (error) { reject(error); }
      }, error => { clearTimeout(timer); stop(); reject(error); });
    });
  });
}

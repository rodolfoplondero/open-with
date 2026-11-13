const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runOpenExternal } = require('../dist/command.js');
const target = { scheme: 'file', fsPath: 'C:\\My files\\café.txt' };
const app = { id: 'app-id', name: 'Editor', recommended: true };
function setup(overrides = {}, bridgeOverrides = {}) {
  const calls = [];
  const host = {
    platform: 'win32', activeFile: () => target,
    isFile: async () => true, prepareFile: async () => true,
    pick: async apps => { calls.push(['pick', apps]); return { kind: 'app', app: apps[0] }; },
    progress: async task => task(),
    offerNative: async message => { calls.push(['offer', message]); return true; },
    error: async message => { calls.push(['error', message]); },
    ...overrides
  };
  const bridge = {
    list: async file => { calls.push(['list', file]); return [app]; },
    open: async (...args) => { calls.push(['open', ...args]); },
    native: async file => { calls.push(['native', file]); }, ...bridgeOverrides
  };
  return { host, bridge, calls };
}
test('uses the active file and opens the selected application by ID', async () => {
  const { host, bridge, calls } = setup();
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.deepEqual(calls.at(-1), ['open', target.fsPath, app.id]);
});
test('the context menu file takes priority over the active file', async () => {
  const { host, bridge, calls } = setup();
  const selected = { scheme: 'file', fsPath: 'C:\\other.pdf' };
  await runOpenExternal(host, bridge, selected);
  assert.deepEqual(calls[0], ['list', selected.fsPath]);
});
test('cancelling Quick Pick or saving does not open anything', async () => {
  for (const overrides of [{ pick: async () => undefined }, { prepareFile: async () => false }]) {
    const { host, bridge, calls } = setup(overrides);
    assert.equal(await runOpenExternal(host, bridge), 'cancelled');
    assert.ok(!calls.some(c => ['open', 'native'].includes(c[0])));
  }
});
test('rejects unsupported platforms, remote files, untitled documents, folders, and missing files', async () => {
  for (const [overrides, file, status] of [
    [{ platform: 'linux' }, target, 'unsupported'],
    [{}, { scheme: 'vscode-remote', fsPath: '/remote/a.txt' }, 'invalid'],
    [{}, { scheme: 'untitled', fsPath: 'Untitled-1' }, 'invalid'],
    [{ isFile: async () => false }, target, 'invalid'],
    [{ activeFile: () => undefined }, undefined, 'invalid']
  ]) {
    const { host, bridge, calls } = setup(overrides);
    assert.equal(await runOpenExternal(host, bridge, file), status);
    assert.equal(calls.filter(c => ['list', 'open', 'native'].includes(c[0])).length, 0);
    assert.ok(calls.some(c => c[0] === 'error'));
  }
});
test('offers the native dialog when no supported applications exist, including extensionless files', async () => {
  const { host, bridge, calls } = setup({}, { list: async () => [] });
  assert.equal(await runOpenExternal(host, bridge, { scheme: 'file', fsPath: 'C:\\README' }), 'opened');
  assert.deepEqual(calls.at(-1), ['native', 'C:\\README']);
});
test('declining the native dialog does not open anything', async () => {
  const { host, bridge, calls } = setup({ offerNative: async () => false }, { list: async () => [] });
  assert.equal(await runOpenExternal(host, bridge), 'cancelled');
  assert.ok(!calls.some(c => c[0] === 'native'));
});
test('discovery failure offers a fallback and preserves the cause in the message', async () => {
  const { host, bridge, calls } = setup({}, { list: async () => { throw new Error('policy blocked'); } });
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.ok(calls.some(c => c[0] === 'offer' && c[1].includes('policy blocked')));
});
test('selecting the native option in the list opens the dialog', async () => {
  const { host, bridge, calls } = setup({ pick: async () => ({ kind: 'native' }) });
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.deepEqual(calls.at(-1), ['native', target.fsPath]);
});
test('application and dialog launch errors are displayed without reporting success', async () => {
  for (const bridgeOverrides of [
    { open: async () => { throw new Error('handler removed'); } },
    { list: async () => [], native: async () => { throw new Error('dialog failed'); } }
  ]) {
    const { host, bridge, calls } = setup({}, bridgeOverrides);
    assert.equal(await runOpenExternal(host, bridge), 'failed');
    assert.equal(calls.at(-1)[0], 'error');
  }
});
test('an inaccessible file displays an error', async () => {
  const { host, bridge, calls } = setup({ isFile: async () => { throw new Error('EACCES'); } });
  assert.equal(await runOpenExternal(host, bridge), 'failed');
  assert.ok(calls.at(-1)[1].includes('EACCES'));
});

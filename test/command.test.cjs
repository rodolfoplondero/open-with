const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runOpenExternal } = require('../dist/command.js');
const target = { scheme: 'file', fsPath: 'C:\\Meus arquivos\\ação.txt' };
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
test('usa arquivo ativo e abre aplicativo selecionado pelo ID', async () => {
  const { host, bridge, calls } = setup();
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.deepEqual(calls.at(-1), ['open', target.fsPath, app.id]);
});
test('arquivo do menu tem prioridade sobre o arquivo ativo', async () => {
  const { host, bridge, calls } = setup();
  const selected = { scheme: 'file', fsPath: 'C:\\outro.pdf' };
  await runOpenExternal(host, bridge, selected);
  assert.deepEqual(calls[0], ['list', selected.fsPath]);
});
test('cancelar Quick Pick ou salvar não abre nada', async () => {
  for (const overrides of [{ pick: async () => undefined }, { prepareFile: async () => false }]) {
    const { host, bridge, calls } = setup(overrides);
    assert.equal(await runOpenExternal(host, bridge), 'cancelled');
    assert.ok(!calls.some(c => ['open', 'native'].includes(c[0])));
  }
});
test('rejeita plataforma, remoto, untitled, diretório e falta de arquivo', async () => {
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
test('sem associações, inclusive arquivo sem extensão, oferece diálogo nativo', async () => {
  const { host, bridge, calls } = setup({}, { list: async () => [] });
  assert.equal(await runOpenExternal(host, bridge, { scheme: 'file', fsPath: 'C:\\README' }), 'opened');
  assert.deepEqual(calls.at(-1), ['native', 'C:\\README']);
});
test('recusar diálogo nativo não abre nada', async () => {
  const { host, bridge, calls } = setup({ offerNative: async () => false }, { list: async () => [] });
  assert.equal(await runOpenExternal(host, bridge), 'cancelled');
  assert.ok(!calls.some(c => c[0] === 'native'));
});
test('falha de descoberta oferece fallback e mantém causa na mensagem', async () => {
  const { host, bridge, calls } = setup({}, { list: async () => { throw new Error('policy blocked'); } });
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.ok(calls.some(c => c[0] === 'offer' && c[1].includes('policy blocked')));
});
test('selecionar opção nativa na lista abre diálogo', async () => {
  const { host, bridge, calls } = setup({ pick: async () => ({ kind: 'native' }) });
  assert.equal(await runOpenExternal(host, bridge), 'opened');
  assert.deepEqual(calls.at(-1), ['native', target.fsPath]);
});
test('erro ao abrir aplicativo ou diálogo é exibido sem sucesso falso', async () => {
  for (const bridgeOverrides of [
    { open: async () => { throw new Error('handler removido'); } },
    { list: async () => [], native: async () => { throw new Error('dialog failed'); } }
  ]) {
    const { host, bridge, calls } = setup({}, bridgeOverrides);
    assert.equal(await runOpenExternal(host, bridge), 'failed');
    assert.equal(calls.at(-1)[0], 'error');
  }
});
test('arquivo inacessível mostra erro', async () => {
  const { host, bridge, calls } = setup({ isFile: async () => { throw new Error('EACCES'); } });
  assert.equal(await runOpenExternal(host, bridge), 'failed');
  assert.ok(calls.at(-1)[1].includes('EACCES'));
});

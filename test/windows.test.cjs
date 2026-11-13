const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { WindowsBridge, createPowerShellRunner } = require('../dist/windows.js');

test('transporta caminhos Unicode e metacaracteres por JSON, sem shell', async () => {
  let invocation, input = '';
  const fakeSpawn = (exe, args, options) => {
    invocation = { exe, args, options };
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.stdin.on('data', chunk => { input += chunk; });
    child.stdin.on('finish', () => { child.stdout.write('\uFEFF[]'); child.emit('close', 0); });
    return child;
  };
  const filePath = 'C:\\Meus arquivos\\ação & $(calc); [teste] "x".txt';
  const runner = createPowerShellRunner('C:\\Extensão', fakeSpawn);
  assert.equal(await runner({ action: 'list', filePath }), '[]');
  assert.deepEqual(JSON.parse(input), { action: 'list', filePath });
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.windowsHide, true);
  assert.ok(invocation.args.includes('-Sta'));
  assert.ok(!invocation.args.some(arg => arg.includes(filePath)));
});

test('lista somente aplicativos compatíveis recomendados e deduplica IDs', async () => {
  const apps = [
    { id: 'b', name: 'Zeditor', recommended: false },
    { id: 'a', name: 'Editor', recommended: true },
    { id: 'a', name: 'Editor', recommended: true },
    { id: 'c', name: 'Editor', recommended: false }
  ];
  const bridge = new WindowsBridge('/extension', async () => JSON.stringify(apps));
  assert.deepEqual((await bridge.list('C:\\a.txt')).map(x => x.id), ['a']);
});

test('aceita lista vazia e rejeita resposta inválida em vez de ocultar falhas', async () => {
  assert.deepEqual(await new WindowsBridge('', async () => '[]').list('x'), []);
  for (const response of ['{}', 'null', 'oops', '[{"id":"x"}]']) {
    await assert.rejects(new WindowsBridge('', async () => response).list('x'), /resposta/i);
  }
});

test('envia ID do handler como dado e distingue abrir do diálogo nativo', async () => {
  const calls = [];
  const bridge = new WindowsBridge('', async request => { calls.push(request); return '{}'; });
  await bridge.open('C:\\arquivo.txt', 'handler & special');
  await bridge.native('C:\\arquivo.txt');
  assert.deepEqual(calls, [
    { action: 'open', filePath: 'C:\\arquivo.txt', handlerId: 'handler & special' },
    { action: 'native', filePath: 'C:\\arquivo.txt' }
  ]);
});

test('falha do PowerShell é propagada', async () => {
  const bridge = new WindowsBridge('', async () => { throw new Error('timeout'); });
  await assert.rejects(bridge.list('x'), /timeout/);
});

test('transport reporta processo indisponível e código de saída com stderr', async () => {
  for (const mode of ['error', 'close']) {
    const runner = createPowerShellRunner('/extension', () => {
      const child = new EventEmitter();
      child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
      child.stdin.on('finish', () => {
        if (mode === 'error') child.emit('error', new Error('ENOENT'));
        else { child.stderr.write('handler removido'); child.emit('close', 1); }
      });
      return child;
    });
    await assert.rejects(runner({ action: 'list', filePath: 'x' }), mode === 'error' ? /ENOENT/ : /handler removido/);
  }
});

test('limita consulta a 30 segundos e não expira diálogo aguardando usuário', async () => {
  const timeouts = [];
  const runner = createPowerShellRunner('/extension', (_exe, _args, options) => {
    timeouts.push(options.timeout);
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.stdin.on('finish', () => child.emit('close', 0));
    return child;
  });
  await runner({ action: 'list', filePath: 'x' });
  await runner({ action: 'open', filePath: 'x', handlerId: 'a' });
  await runner({ action: 'native', filePath: 'x' });
  assert.deepEqual(timeouts, [30000, 30000, 0]);
});

test('processo terminado por timeout gera erro claro', async () => {
  const runner = createPowerShellRunner('/extension', () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.stdin.on('finish', () => child.emit('close', null, 'SIGTERM'));
    return child;
  });
  await assert.rejects(runner({ action: 'list', filePath: 'x' }), /30 segundos/);
});

test('resposta excessiva interrompe processo e não é aceita', async () => {
  let killed = false;
  const runner = createPowerShellRunner('/extension', () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.kill = () => { killed = true; return true; };
    child.stdin.on('finish', () => child.stdout.write('a'.repeat(4 * 1024 * 1024 + 1)));
    return child;
  });
  await assert.rejects(runner({ action: 'list', filePath: 'x' }), /limite/);
  assert.equal(killed, true);
});


test('programas genéricos não são exibidos como compatíveis', async () => {
  const bridge = new WindowsBridge('', async () => JSON.stringify([
    { id: 'generic.exe', name: 'Programa genérico', recommended: false }
  ]));
  assert.deepEqual(await bridge.list('C:\\imagem.png'), []);
});

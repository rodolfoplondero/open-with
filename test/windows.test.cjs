const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { WindowsBridge, createPowerShellRunner } = require('../dist/windows.js');

test('transports Unicode paths and metacharacters as JSON without a shell', async () => {
  let invocation, input = '';
  const fakeSpawn = (exe, args, options) => {
    invocation = { exe, args, options };
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.stdin.on('data', chunk => { input += chunk; });
    child.stdin.on('finish', () => { child.stdout.write('\uFEFF[]'); child.emit('close', 0); });
    return child;
  };
  const filePath = 'C:\\My files\\café & $(calc); [test] "x".txt';
  const runner = createPowerShellRunner('C:\\Extension café', fakeSpawn);
  assert.equal(await runner({ action: 'list', filePath }), '[]');
  assert.deepEqual(JSON.parse(input), { action: 'list', filePath });
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.windowsHide, true);
  assert.ok(invocation.args.includes('-Sta'));
  assert.ok(!invocation.args.some(arg => arg.includes(filePath)));
});

test('lists only recommended applications and deduplicates IDs', async () => {
  const apps = [
    { id: 'b', name: 'Zeditor', recommended: false },
    { id: 'a', name: 'Editor', recommended: true },
    { id: 'a', name: 'Editor', recommended: true },
    { id: 'c', name: 'Editor', recommended: false }
  ];
  const bridge = new WindowsBridge('/extension', async () => JSON.stringify(apps));
  assert.deepEqual((await bridge.list('C:\\a.txt')).map(x => x.id), ['a']);
});

test('accepts empty lists and rejects invalid responses instead of hiding failures', async () => {
  assert.deepEqual(await new WindowsBridge('', async () => '[]').list('x'), []);
  for (const response of ['{}', 'null', 'oops', '[{"id":"x"}]']) {
    await assert.rejects(new WindowsBridge('', async () => response).list('x'), /response/i);
  }
});

test('sends handler IDs as data and distinguishes opening from the native dialog', async () => {
  const calls = [];
  const bridge = new WindowsBridge('', async request => { calls.push(request); return '{}'; });
  await bridge.open('C:\\file.txt', 'handler & special');
  await bridge.native('C:\\file.txt');
  assert.deepEqual(calls, [
    { action: 'open', filePath: 'C:\\file.txt', handlerId: 'handler & special' },
    { action: 'native', filePath: 'C:\\file.txt' }
  ]);
});

test('propagates PowerShell errors', async () => {
  const bridge = new WindowsBridge('', async () => { throw new Error('timeout'); });
  await assert.rejects(bridge.list('x'), /timeout/);
});

test('transport reports unavailable processes and exit codes with stderr', async () => {
  for (const mode of ['error', 'close']) {
    const runner = createPowerShellRunner('/extension', () => {
      const child = new EventEmitter();
      child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
      child.stdin.on('finish', () => {
        if (mode === 'error') child.emit('error', new Error('ENOENT'));
        else { child.stderr.write('handler removed'); child.emit('close', 1); }
      });
      return child;
    });
    await assert.rejects(runner({ action: 'list', filePath: 'x' }), mode === 'error' ? /ENOENT/ : /handler removed/);
  }
});

test('limits queries to 30 seconds and lets the native dialog wait for user input', async () => {
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

test('a process terminated by timeout produces a clear error', async () => {
  const runner = createPowerShellRunner('/extension', () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.stdin.on('finish', () => child.emit('close', null, 'SIGTERM'));
    return child;
  });
  await assert.rejects(runner({ action: 'list', filePath: 'x' }), /30 seconds/);
});

test('oversized responses terminate the process and are rejected', async () => {
  let killed = false;
  const runner = createPowerShellRunner('/extension', () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.kill = () => { killed = true; return true; };
    child.stdin.on('finish', () => child.stdout.write('a'.repeat(4 * 1024 * 1024 + 1)));
    return child;
  });
  await assert.rejects(runner({ action: 'list', filePath: 'x' }), /limit/);
  assert.equal(killed, true);
});


test('nonrecommended generic programs are not listed as supported', async () => {
  const bridge = new WindowsBridge('', async () => JSON.stringify([
    { id: 'generic.exe', name: 'Generic application', recommended: false }
  ]));
  assert.deepEqual(await bridge.list('C:\\image.png'), []);
});

test('DOCX excludes generic programs even when Windows recommends them', async () => {
  const apps = [
    { id: 'C:\\Windows\\notepad.exe', name: 'Notepad', recommended: true },
    { id: 'C:\\Office\\WINWORD.EXE', name: 'Word', recommended: true },
    { id: 'C:\\Apps\\Code.exe', name: 'Visual Studio Code', recommended: true },
    { id: 'C:\\PowerShell\\pwsh.exe', name: 'PowerShell 7', recommended: true },
    { id: 'ChatGPT', name: 'ChatGPT', recommended: true },
    { id: 'C:\\Apps\\VSLauncher.exe', name: 'Microsoft Visual Studio Version Selector', recommended: true },
    { id: 'C:\\Apps\\UiPath.Studio.exe', name: 'UiPath Studio', recommended: true },
    { id: 'C:\\Apps\\vlc.exe', name: 'VLC media player', recommended: true },
    { id: 'C:\\LibreOffice\\program\\soffice.exe', name: 'LibreOffice', recommended: true }
  ];
  const bridge = new WindowsBridge('', async () => JSON.stringify(apps));
  assert.deepEqual((await bridge.list('C:\\REPORT.DOCX')).map(app => app.name).sort(), ['LibreOffice', 'Word']);
});

test('DOCX without a recognized document editor produces an empty list', async () => {
  const bridge = new WindowsBridge('', async () => JSON.stringify([
    { id: 'C:\\Windows\\notepad.exe', name: 'Word', recommended: true }
  ]));
  assert.deepEqual(await bridge.list('C:\\report.docx'), []);
});

test('DOCX recognizes supported office suites by executable identity', async () => {
  const ids = ['WINWORD.EXE', 'swriter.exe', 'soffice.exe', 'wps.exe', 'DesktopEditors.exe', 'textmaker.exe'];
  const bridge = new WindowsBridge('', async () => JSON.stringify(ids.map(id => ({
    id: `C:\\Apps\\${id}`, name: id, recommended: true
  }))));
  assert.equal((await bridge.list('C:\\report.docx')).length, ids.length);
});

test('DOCX rejects direct opening with a generic handler before launching it', async () => {
  let launched = false;
  const bridge = new WindowsBridge('', async () => { launched = true; return '{}'; });
  await assert.rejects(bridge.open('C:\\report.docx', 'C:\\Windows\\notepad.exe'), /DOCX/);
  assert.equal(launched, false);
});

test('other file types retain their registered recommended handlers', async () => {
  const app = { id: 'C:\\Windows\\notepad.exe', name: 'Notepad', recommended: true };
  const bridge = new WindowsBridge('', async () => JSON.stringify([app]));
  assert.deepEqual(await bridge.list('C:\\notes.txt'), [app]);
});

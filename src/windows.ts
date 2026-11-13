import { spawn, SpawnOptions, ChildProcess } from 'node:child_process';
import * as path from 'node:path';

export interface App { id: string; name: string; recommended: boolean }
export interface BridgeRequest { action: 'list' | 'open' | 'native'; filePath: string; handlerId?: string }
export type Runner = (request: BridgeRequest) => Promise<string>;
type Spawner = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export function createPowerShellRunner(extensionPath: string, spawnProcess: Spawner = spawn): Runner {
  return request => new Promise((resolve, reject) => {
    // Only the packaged script is executable text. File paths and IDs go through stdin.
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const executable = path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const child = spawnProcess(executable, [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Sta', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(extensionPath, 'scripts', 'bridge.ps1')
    ], {
      shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      timeout: request.action === 'native' ? 0 : 30_000
    });
    let stdout = '', stderr = '', length = 0;
    child.on('error', reject);
    child.stdin?.on('error', reject);
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    const collect = (chunk: string, errorStream: boolean) => {
      length += Buffer.byteLength(chunk);
      if (length > 4 * 1024 * 1024) {
        child.kill();
        reject(new Error('A resposta do Windows excedeu o limite permitido.'));
        return;
      }
      if (errorStream) stderr += chunk; else stdout += chunk;
    };
    child.stdout?.on('data', chunk => collect(chunk, false));
    child.stderr?.on('data', chunk => collect(chunk, true));
    child.on('close', (code, signal) => {
      if (code !== 0) {
        reject(new Error(signal
          ? 'A consulta ao Windows foi interrompida ou excedeu 30 segundos.'
          : (stderr.trim() || `O PowerShell encerrou com código ${code}.`)));
      } else resolve(stdout.replace(/^\uFEFF/, '').trim());
    });
    child.stdin?.end(JSON.stringify(request), 'utf8');
  });
}

export class WindowsBridge {
  private readonly run: Runner;
  constructor(extensionPath: string, runner?: Runner) {
    this.run = runner ?? createPowerShellRunner(extensionPath);
  }
  async list(filePath: string): Promise<App[]> {
    let parsed: unknown;
    try { parsed = JSON.parse(await this.run({ action: 'list', filePath })); }
    catch (error) {
      if (error instanceof SyntaxError) throw new Error('Resposta inválida do Windows.');
      throw error;
    }
    if (!Array.isArray(parsed) || parsed.some(item =>
      !item || typeof item.id !== 'string' || !item.id ||
      typeof item.name !== 'string' || !item.name || typeof item.recommended !== 'boolean')) {
      throw new Error('Resposta inválida do Windows.');
    }
    const unique = new Map<string, App>();
    for (const item of parsed as App[]) {
      if (item.recommended && !unique.has(item.id)) unique.set(item.id, item);
    }
    return [...unique.values()].sort((a, b) =>
      Number(b.recommended) - Number(a.recommended) || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id));
  }
  async open(filePath: string, handlerId: string): Promise<void> {
    await this.run({ action: 'open', filePath, handlerId });
  }
  async native(filePath: string): Promise<void> {
    await this.run({ action: 'native', filePath });
  }
}

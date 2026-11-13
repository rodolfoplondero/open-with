import type { App, WindowsBridge } from './windows';

export interface FileTarget { scheme: string; fsPath: string }
export type Choice = { kind: 'app'; app: App } | { kind: 'native' };
export interface Host {
  platform: string;
  activeFile(): FileTarget | undefined;
  isFile(filePath: string): Promise<boolean>;
  prepareFile(target: FileTarget): Promise<boolean>;
  pick(apps: App[], filePath: string): Promise<Choice | undefined>;
  progress<T>(task: () => Promise<T>): Promise<T>;
  offerNative(message: string): Promise<boolean>;
  error(message: string): Promise<void>;
}
export type Status = 'opened' | 'cancelled' | 'unsupported' | 'invalid' | 'failed';
export async function runOpenExternal(
  host: Host, bridge: Pick<WindowsBridge, 'list' | 'open' | 'native'>, target?: FileTarget
): Promise<Status> {
  try {
    if (host.platform !== 'win32') {
      await host.error('Esta extensão está disponível apenas no Windows.');
      return 'unsupported';
    }
    const file = target ?? host.activeFile();
    if (!file || file.scheme !== 'file') {
      await host.error('Selecione um arquivo local salvo no Windows. Arquivos remotos e documentos sem salvar não são compatíveis.');
      return 'invalid';
    }
    if (!await host.isFile(file.fsPath)) {
      await host.error('O item selecionado não é um arquivo acessível. Selecione um arquivo, não uma pasta.');
      return 'invalid';
    }
    if (!await host.prepareFile(file)) return 'cancelled';
    let apps: App[];
    try {
      apps = await host.progress(() => bridge.list(file.fsPath));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (!await host.offerNative(`Não foi possível consultar os aplicativos do Windows: ${detail}`)) return 'cancelled';
      await bridge.native(file.fsPath);
      return 'opened';
    }
    if (apps.length === 0) {
      if (!await host.offerNative('O Windows não informou aplicativos associados a este tipo de arquivo.')) return 'cancelled';
      await bridge.native(file.fsPath);
      return 'opened';
    }
    const choice = await host.pick(apps, file.fsPath);
    if (!choice) return 'cancelled';
    if (choice.kind === 'native') await bridge.native(file.fsPath);
    else await bridge.open(file.fsPath, choice.app.id);
    return 'opened';
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await host.error(`Não foi possível abrir o arquivo: ${detail}`);
    return 'failed';
  }
}

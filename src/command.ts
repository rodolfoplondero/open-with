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
      await host.error('This extension is available on Windows only.');
      return 'unsupported';
    }
    const file = target ?? host.activeFile();
    if (!file || file.scheme !== 'file') {
      await host.error('Select a saved local file on Windows. Remote files and untitled documents are not supported.');
      return 'invalid';
    }
    if (!await host.isFile(file.fsPath)) {
      await host.error('The selected item is not an accessible file. Select a file instead of a folder.');
      return 'invalid';
    }
    if (!await host.prepareFile(file)) return 'cancelled';
    let apps: App[];
    try {
      apps = await host.progress(() => bridge.list(file.fsPath));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (!await host.offerNative(`Could not query Windows applications: ${detail}`)) return 'cancelled';
      await bridge.native(file.fsPath);
      return 'opened';
    }
    if (apps.length === 0) {
      if (!await host.offerNative('No supported applications were found for this file type.')) return 'cancelled';
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
    await host.error(`Could not open the file: ${detail}`);
    return 'failed';
  }
}

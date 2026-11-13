import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { runOpenExternal, Choice, FileTarget, Host } from './command';
import { WindowsBridge } from './windows';

interface AppItem extends vscode.QuickPickItem { choice?: Choice }

export function activate(context: vscode.ExtensionContext): void {
  const bridge = new WindowsBridge(context.extensionPath);
  const host: Host = {
    platform: process.platform,
    activeFile: () => vscode.window.activeTextEditor?.document.uri,
    isFile: async filePath => (await fs.stat(filePath)).isFile(),
    prepareFile: async target => {
      const doc = vscode.workspace.textDocuments.find(document =>
        document.uri.scheme === target.scheme && document.uri.fsPath === target.fsPath);
      if (!doc?.isDirty) return true;
      const save = 'Salvar e abrir';
      const disk = 'Abrir versão salva';
      const choice = await vscode.window.showWarningMessage(
        'Este arquivo tem alterações não salvas. O programa externo abrirá a versão do disco.',
        { modal: true }, save, disk);
      if (choice === save) {
        const saved = await doc.save();
        if (!saved) await vscode.window.showErrorMessage('O arquivo não foi salvo. A abertura foi cancelada.');
        return saved;
      }
      return choice === disk;
    },
    pick: async (apps, filePath) => {
      const items: AppItem[] = apps.map(app => ({
        label: app.name,
        description: app.recommended ? 'Recomendado pelo Windows' : undefined,
        detail: app.id,
        choice: { kind: 'app', app }
      }));
      items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
      items.push({ label: 'Escolher outro aplicativo no Windows…', choice: { kind: 'native' } });
      const chosen = await vscode.window.showQuickPick(items, {
        title: `Abrir ${path.win32.basename(filePath)} com…`,
        placeHolder: 'Pesquise e selecione um programa',
        matchOnDescription: true, matchOnDetail: true, ignoreFocusOut: true
      });
      return chosen?.choice;
    },
    progress: async task => await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification, title: 'Consultando aplicativos do Windows…', cancellable: false
    }, task),
    offerNative: async message => {
      const action = 'Abrir com o Windows…';
      return await vscode.window.showWarningMessage(message, action) === action;
    },
    error: async message => { await vscode.window.showErrorMessage(message); }
  };
  let running = false;
  context.subscriptions.push(vscode.commands.registerCommand('abrirComExterno.open', async (uri?: vscode.Uri) => {
    if (running) return;
    running = true;
    try { await runOpenExternal(host, bridge, uri as FileTarget | undefined); }
    finally { running = false; }
  }));
}

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
      const save = 'Save and Open';
      const disk = 'Open Saved Version';
      const choice = await vscode.window.showWarningMessage(
        'This file has unsaved changes. The external application will open the version on disk.',
        { modal: true }, save, disk);
      if (choice === save) {
        const saved = await doc.save();
        if (!saved) await vscode.window.showErrorMessage('The file was not saved. Opening was cancelled.');
        return saved;
      }
      return choice === disk;
    },
    pick: async (apps, filePath) => {
      const items: AppItem[] = apps.map(app => ({
        label: app.name,
        description: app.recommended ? 'Recommended by Windows' : undefined,
        detail: app.id,
        choice: { kind: 'app', app }
      }));
      items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
      items.push({ label: 'Choose Another Application in Windows…', choice: { kind: 'native' } });
      const chosen = await vscode.window.showQuickPick(items, {
        title: `Open ${path.win32.basename(filePath)} With…`,
        placeHolder: 'Search for and select an application',
        matchOnDescription: true, matchOnDetail: true, ignoreFocusOut: true
      });
      return chosen?.choice;
    },
    progress: async task => await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification, title: 'Querying Windows applications…', cancellable: false
    }, task),
    offerNative: async message => {
      const action = 'Open With Windows…';
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

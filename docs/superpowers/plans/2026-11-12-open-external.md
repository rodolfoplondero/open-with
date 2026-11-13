# Open External Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.
**Goal:** Escolher um aplicativo Windows em lista do VS Code e abrir arquivo local.
**Architecture:** Comando TypeScript separa UI, validação e bridge. JSON por stdin a PowerShell; C# enumera associações Shell e invoca handler por ID.
**Tech Stack:** TypeScript, node:test, PowerShell 5.1, C#, VSCE.
**Spec:** docs/superpowers/specs/2026-11-12-open-external-design.md
## Global Constraints
Windows e arquivos locais; português; nenhuma mudança de associação padrão; entregar fontes e VSIX.
## Review Focus
Metacaracteres e Unicode: teste JSON stdin. Cancelar: nenhuma abertura. Remotos/diretórios/sem arquivo: rejeição. Sem extensão/associação: fallback. Handler removido: erro e checklist Windows.
### Task 1: Bridge Windows
**Files:** src/windows.ts, scripts/bridge.ps1, scripts/Associations.cs, test/windows.test.cjs.
**Interfaces:** WindowsBridge.list(path): Promise<App[]>; open(path,id), native(path): Promise<void>.
- [x] Escrever testes para JSON Unicode, array vazio/unitário, falha, timeout e resposta inválida; executar e observar módulo ausente.
- [x] Implementar bridge sem shell e APIs SHAssocEnumHandlers/IShellItem/IDataObject/IAssocHandler.Invoke.
- [x] Compilar e testar; todos passam.
### Task 2: Comando e integração
**Files:** src/command.ts, src/extension.ts, test/command.test.cjs, package.json, tsconfig.json.
**Interfaces:** runOpenExternal(host, bridge, target?) retorna status; host adapta VS Code.
- [x] Testes de abertura, cancelamento, remoto, plataforma, diretório, falta de arquivo, fallback, falhas e preparação do arquivo; observar módulo ausente.
- [x] Implementar comando, confirmação para documento alterado, Quick Pick e menus.
- [x] Compilar e testar tudo; todos passam.
### Task 3: Entrega
**Files:** README.md, LICENSE, .vscode/launch.json, .vscodeignore.
- [x] Documentar instalação, limites e checklist Windows.
- [x] Revisar e corrigir problemas materiais com testes de regressão.
- [x] Executar npm test e npm run package, inspecionar VSIX e criar ZIP de fontes sem node_modules.

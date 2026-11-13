# Open External Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Choose a Windows application from a VS Code picker and open a local file.
**Architecture:** The TypeScript command separates UI, validation, and the Windows bridge. JSON travels through stdin to PowerShell; C# enumerates Shell associations and invokes a handler by ID.
**Tech Stack:** TypeScript, node:test, PowerShell 5.1, C#, VSCE.
**Spec:** docs/superpowers/specs/2026-11-12-open-external-design.md

## Global constraints
Windows and local files; English UI and documentation; preserve technical identifiers; no changes to default associations; deliver source and VSIX.

## Review focus
Unicode and metacharacters: JSON stdin test. Cancellation: no launch. Remote files, folders, and missing files: reject. Missing extension or supported application: native fallback. Removed handler: error and Windows checklist. DOCX: reject generic programs even when Windows recommends them.

### Task 1: Windows bridge
**Files:** src/windows.ts, scripts/bridge.ps1, scripts/Associations.cs, test/windows.test.cjs.
**Interfaces:** WindowsBridge.list(path): Promise<App[]>; open(path,id), native(path): Promise<void>.
- [x] Write tests for Unicode JSON, empty and single-item arrays, errors, timeouts, and invalid responses; observe failure before implementation.
- [x] Implement transport without a shell and use SHAssocEnumHandlers/IShellItem/IDataObject/IAssocHandler.Invoke.
- [x] Compile and run tests successfully.

### Task 2: Command and integration
**Files:** src/command.ts, src/extension.ts, test/command.test.cjs, package.json, tsconfig.json.
**Interfaces:** runOpenExternal(host, bridge, target?) returns a status; host adapts VS Code.
- [x] Test launching, cancellation, remote files, platform checks, folders, missing files, fallback, failures, and file preparation; observe failure before implementation.
- [x] Implement the command, unsaved-change prompt, Quick Pick, and menus.
- [x] Compile and pass the full suite.

### Task 3: Delivery
**Files:** README.md, LICENSE, .vscode/launch.json, .vscodeignore.
- [x] Document installation, limitations, and the Windows manual checklist.
- [x] Review and fix material issues with regression tests.
- [x] Run npm test and npm run package, inspect the VSIX, and create a source ZIP without node_modules.

### Follow-up: English translation and DOCX compatibility
**Files:** src/compatibility.ts, src/windows.ts, test/windows.test.cjs, extension UI, package metadata, tests, and documentation.
- [x] Reproduce generic DOCX handlers in regression tests; observe failures.
- [x] Filter DOCX by known document-editor executables and recheck direct opening.
- [x] Translate maintained text into English and preserve Unicode-path test coverage.
- [x] Verify the final test suite, package contents, and documented limits.

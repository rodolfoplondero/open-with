# Open With External Application

A **VS Code extension for Windows**: right-click a file, choose **Open With External Application…**, and select an application from a searchable list.

## Install

1. Download `abrir-com-externo-0.1.3.vsix`, or build it from source as described below.
2. In VS Code, open **Extensions** (`Ctrl+Shift+X`).
3. Open the **…** menu, select **Install from VSIX…**, and choose the package.
4. Reload the VS Code window if prompted.

You can also install from a terminal:

```powershell
code --install-extension .\abrir-com-externo-0.1.3.vsix
```

The extension uses Windows PowerShell 5.1 and the Windows Shell APIs. You do not need Node.js or development tools to use the VSIX. Requires VS Code 1.96 or later; intended for Windows 10/11.

## Usage

- In the VS Code Explorer, right-click a **file** and select **Open With External Application…**.
- The command is also available in the editor and editor tab context menus.
- From the Command Palette (`Ctrl+Shift+P`), run **File: Open With External Application…** for the active file.
- Type an application name to filter the list, then press `Enter` to open it. Press `Esc` or click outside the picker to dismiss it without opening an application.
- **Choose Another Application in Windows…** opens the native Windows dialog.
- If no supported applications are found, the extension offers the native dialog.
- For unsaved changes, choose **Save and Open**, **Open Saved Version**, or cancel.

Extension labels and messages are in English. Application names and the native dialog use the language provided by Windows. The technical extension identifier remains `local-tools.abrir-com-externo`, and the command identifier remains `abrirComExterno.open` for compatibility.

## Application discovery and DOCX filtering

The extension queries `SHAssocEnumHandlers` for the file extension using `ASSOC_FILTER_RECOMMENDED`, reads application names through `IAssocHandler`, and opens the file with the selected handler through `IDataObject`. Paths and handler IDs are sent as JSON through PowerShell's standard input, without interpolation into executable commands.

**A Windows recommendation does not prove format support.** Windows can recommend generic applications such as Notepad for a DOCX file even though they do not render a Word document correctly.

For **`.docx` files**, the extension therefore applies an additional conservative filter. It lists only recommended handlers whose executable matches a known document editor:

| Application | Recognized executable |
| --- | --- |
| Microsoft Word | `WINWORD.EXE` |
| LibreOffice / Apache OpenOffice | `swriter.exe`, `soffice.exe` |
| WPS Writer | `wps.exe` |
| ONLYOFFICE Desktop Editors | `DesktopEditors.exe` |
| SoftMaker TextMaker | `textmaker.exe` |

This excludes Notepad, PowerShell, Visual Studio Code, ChatGPT, Visual Studio Version Selector, UiPath Studio, VLC, and other generic handlers from the DOCX picker, including handlers that Windows marks as recommended. Matching uses the executable name, not the application's localized display name. The same DOCX check runs before invoking a selected handler.

The DOCX list is intentionally conservative: an unrecognized document editor or a handler that exposes a different identity may be omitted. Use **Choose Another Application in Windows…** to select such an application manually. That explicit native choice is not restricted by the extension's DOCX list. Formatting fidelity depends on the chosen editor and document features; the filter does not inspect the document contents.

Other file types continue to use the recommended handlers registered by Windows, without an additional format-specific editor list. They do not have the stronger DOCX filter. Applications that do not register their formats may be absent. Extensionless files use the native dialog. Available applications depend on the current user's Windows associations. The extension does not change default associations.

## Limitations

- Only accessible local Windows files are supported. Remote files in WSL, SSH, containers, and virtual file systems are not supported.
- Folders and documents that have not been saved to disk are not accepted.
- Removing an application or changing associations while the picker is open may cause an error; run the command again.
- Corporate policies blocking PowerShell or `Add-Type` may prevent discovery and opening. The extension does not bypass Group Policy.
- A completed launch request means Windows accepted the request; the extension does not monitor the external application window or verify that the document rendered correctly.
- The extension makes no network requests and collects no telemetry. The selected application receives the file to open it.

## Development

Requires Node.js 22 or later and npm. Clone the repository or extract the source archive, open the project folder in VS Code, and run:

```sh
npm ci
npm test
npm run package
```

Press `F5` to launch an Extension Development Host. The compiled package is `abrir-com-externo-0.1.3.vsix`. The extension has not been published to the VS Code Marketplace.

### Project structure

- `src/extension.ts`: menus, Quick Pick, and VS Code integration.
- `src/command.ts`: command flow, validation, and fallback.
- `src/windows.ts`: JSON transport and response validation.
- `src/compatibility.ts`: conservative DOCX editor filtering.
- `scripts/bridge.ps1`: PowerShell entry point.
- `scripts/Associations.cs`: Windows COM/Shell APIs.
- `test/`: automated command, transport, and compatibility tests with simulated operating-system boundaries.

## Validation

Automated tests and TypeScript compilation run on Linux. C# compilation and an extensionless-file bridge call have also been checked using PowerShell 7 on Linux. These checks **do not establish that native application discovery and launching work on Windows PowerShell 5.1**.

Before distributing the extension, verify on Windows 10/11:

- Install the VSIX and check menus and the Command Palette.
- Open `.txt`, `.png`, `.pdf`, and another format with multiple registered applications.
- Open a `.docx` file with Word and another supported office suite installed; verify that generic handlers are absent, including Notepad even when Windows recommends it.
- Try a DOCX file with no recognized editor installed and check the fallback message.
- Test traditional and Microsoft Store applications where available, both on first launch and while already running; verify asynchronous activation and DDE-based applications.
- Use paths containing spaces, accented characters, `&`, brackets, and apostrophes.
- Cancel the picker and native dialog without opening the file.
- Try an unknown format and an extensionless file.
- Verify saving changes, opening the saved disk version, and cancelling.
- Remove or change an association while the picker is open and check the error message.
- Check that folders and remote files are rejected.

MIT License.

# Approved design: Open With External Application

A VS Code extension for local Windows files. Explorer and editor context menus and the Command Palette offer “Open With External Application…”. A searchable Quick Pick lists applications associated with the file type by Windows. Selecting an application opens the file in it; when no supported application is found, the extension offers the native dialog. TypeScript, PowerShell 5.1, and Windows Shell APIs through packaged C#. No additional runtime dependencies, network requests, telemetry, or changes to default associations.

Approaches considered: only the native dialog (simpler, selection outside VS Code) versus an integrated picker based on Windows associations (selected by the user). The implementation uses SHAssocEnumHandlers and IAssocHandler.Invoke instead of interpreting Registry command lines. Applications without registered associations may be absent. Remote WSL/SSH files, folders, and untitled documents are excluded.

Deliverables: source code, VSIX, and instructions. Linux automated tests do not replace native Windows Shell verification; include a manual checklist.

Subsequent user requirements: all extension text and documentation are in English; existing technical identifiers remain stable. Windows recommendations alone do not establish DOCX support. DOCX results additionally require a recognized document-editor executable (Word, LibreOffice/OpenOffice, WPS, ONLYOFFICE, or TextMaker); unknown handlers are omitted and can be selected manually through the explicit native fallback. Other formats retain Windows-recommended handler discovery. This conservative DOCX policy does not guarantee rendering fidelity or enumerate every possible editor.

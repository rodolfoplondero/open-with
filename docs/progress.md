# Execution ledger — plan: docs/superpowers/plans/2026-11-12-open-external.md
Design approved in chat. Empty workspace, no existing repository or code to isolate. Implementation inline under existing authorization.
Pre-flight: task 2 consumes WindowsBridge.list/open/native from task 1; signatures agree.
Task 1: complete — windows transport tests RED (missing implementation) → GREEN.
Task 2: complete — command tests RED (missing implementation) → GREEN. npm test: 16 passed.
Compile correction: VS Code withProgress returns Thenable, adapter now async to satisfy Promise port.
Task 3: in progress — docs, packaging and fresh review.
Final independent review: no confirmed critical/important source defects. COM method order and GUIDs, JSON array encoding, paths as data and UI wiring reviewed.
Native platform limitation: process lifetime after IAssocHandler.Invoke needs Windows testing for asynchronous/DDE/packaged apps; manual checklist documents this, no arbitrary sleep added.
Minor deferred: cancellation of native dialog resolves internal status opened; no success toast is shown, so user sees no false confirmation. Status is not exposed as a public contract.
Additional verification: C# compiled via Add-Type; PowerShell parsed and real bridge JSON no-extension path returned [] under PowerShell 7.5.4/Linux. Does not verify Windows PowerShell 5.1 or native Shell.
Final tests: npm test — 19 passed, 0 failed.
Delivery environment limitation: configured /codex/.../output cannot be created: read-only sandbox, permission denied outside sandbox; sudo is not installed. No automatic approval review rejected any operation. Preserve artifacts in workspace fallback.
Task 3: complete pending final archive inspection.

Compatibility correction 0.1.1: ASSOC_FILTER_RECOMMENDED and defensive recommended-only filtering in TypeScript. Regression tests RED (2 failures) → GREEN, 20 tests passed. C# compiled; native Windows execution remains unverified.
Delivery helper corrected to load both System.IO.Compression and System.IO.Compression.FileSystem for Windows PowerShell; tested archive patch reconstruction separately.

Follow-up 0.1.2: all maintained UI text, errors, metadata, tests, and documentation translated into English. Technical extension and command IDs preserved; Unicode test inputs retained.
DOCX reproduction: a screenshot showed generic handlers, including recommended Notepad. Three regression tests failed before the fix. Added a conservative executable allowlist for known DOCX document editors, checked during listing and direct opening. Other file types retain Windows recommendations.
Final independent follow-up review: no material findings. Unknown/alternate DOCX handler identities may be omitted; this limitation and the explicit native fallback are documented. Native Windows application launching remains unverified.
Follow-up verification: 25 automated tests pass; the VSIX includes dist/compatibility.js and English metadata/messages.

Follow-up 0.1.3: the picker kept focus because ignoreFocusOut was true. Set it to false so clicking outside dismisses the picker; existing cancellation handling returns without launching an application.

import * as path from 'node:path';

// Windows recommendations include generic "open any file" applications.
// DOCX therefore uses a conservative list of known document editors, matched
// against the handler executable rather than its localized display name.
const docxEditors = new Set([
  'winword.exe',      // Microsoft Word
  'swriter.exe',      // LibreOffice / Apache OpenOffice Writer
  'soffice.exe',      // LibreOffice / Apache OpenOffice launcher
  'wps.exe',          // WPS Writer
  'desktopeditors.exe', // ONLYOFFICE Desktop Editors
  'textmaker.exe'     // SoftMaker TextMaker
]);

export function isCompatibleHandler(filePath: string, handlerId: string): boolean {
  if (path.win32.extname(filePath).toLowerCase() !== '.docx') return true;
  return docxEditors.has(path.win32.basename(handlerId).toLowerCase());
}

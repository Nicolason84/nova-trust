# Document vault contract — 2026-10-30

Implementation: `document-vault.mjs`. This is a local browser file vault, not a disk scanner or a cloud service. The UI must pass files explicitly selected by the user. All originals are retained byte for byte. Nothing in imported documents is executed, fetched or sent to an AI.

## Integration

```js
import {createDocumentVault, DOCUMENT_LIMITS} from './document-vault.mjs';
const vault = createDocumentVault();
await vault.unlock(localPhrase); // Creates a new vault if none exists; otherwise opens it.
await vault.importFile(file);    // File from an explicit picker/camera action.
const rows = await vault.search(query); // Empty query lists every document.
const original = await vault.retrieve(rows[0].id); // Blob; use a download action.
const detail = await vault.details(rows[0].id);
vault.lock();
```

API: `isUnlocked` getter; `unlock(phrase) → {created, count}`; `lock()`; `importFile(file, {category?, tags?}) → public metadata`; `list()`; `search(query='') → public metadata[]`; `retrieve(id) → Blob`; `details(id) → {document, text, reduction, limitations}`; `updateMetadata(id, {category?, tags?, nameDisplay?}) → public metadata`; `deleteFile(id) → boolean`; `exportBackup() → Blob`; `importBackup(file, backupPhrase) → {imported, skipped}`. All methods except `lock()` and the getter are async. The UI must ask for confirmation before deletion or backup import. Import merges; it never replaces the existing vault. A matching original hash, original filename, MIME type, creation timestamp and user annotations are treated as an already imported document. A distinct name or annotation is preserved as a separate document. Downloaded original files are no longer protected by this vault; an HTML/SVG/script file must be downloaded rather than inserted into the page or executed.

Public metadata: `{id, name, nameDisplay, type, size, category, tags, hash, analysisStatus, addedAt}`. `name` is the original filename; `nameDisplay` is initially `null` and can be changed/reset without altering the original. `category` accepts a bounded user label, such as `caza`, `tauromaquia` or `juridico`; otherwise it is inferred from filename/type only. At most 16 tags of 48 characters are admitted. Category and analysis are deterministic heuristics, not expert conclusions. `analysisStatus` is `TEXT_ANALYZED`, `TEXT_LIMITED`, or `ORIGINAL_ONLY`.

## Storage and limits

AES-256-GCM, 128-bit authentication tags, fresh 12-byte nonces, a 32-byte random vault salt, and PBKDF2-SHA256 with 600,000 iterations. A phrase contains 14–512 characters and is never stored. The non-extractable CryptoKey and decrypted index remain in memory. `lock()` releases references and cancels active transactions as best effort; JavaScript cannot promise full memory erasure. The browser may clear site data; a separate encrypted backup is necessary for recovery. No password recovery service exists.

IndexedDB contains encrypted metadata and encrypted original bytes. Random IDs, format/KDF constants, salt, nonces and ciphertext lengths are necessarily visible. Filenames, types, hashes, categories, extracted text and timestamps are encrypted. The vault uses a distinct database and never touches the older app's data. Cross-tab writes require the browser's Web Locks API; absence is an explicit error, never a silent unsafe fallback. New files and the initial header use atomic IndexedDB `add`, so an ID collision cannot overwrite an existing record. Search refreshes the decrypted index, making other tabs' committed changes visible. Lock cancels operations that are awaiting database opening as well as already active transactions. Protection at rest does not protect documents already unlocked in a compromised same-origin page or operating system.

Per file: 25 MiB. UTF-8 text extraction: 2 MiB, rejecting binary/control-heavy content. CAnnoNico reduction: 10,000 lines. Search indexes at most the first 64 KiB of admitted text per file; original bytes are always retained. Limits are reported in `details().limitations`. Maximum 1,000 files and 32 MiB of encrypted metadata in one vault. JSON encrypted backup: 100 MiB including base64 overhead; a 100 MiB backup cannot contain 100 MiB of source files. Large backups require temporary memory and may be impractical on an iPhone. PDF/Office/image/audio/video content is retained without pretending to perform OCR, transcription, document parsing or semantic analysis.

## CAnnoNico provenance

The reduction logic is adapted from `source-reuse-20261030/cannonico_inputs.js`, version 1.1, SHA-256 `7957e5fe608bd8d881e4a1b1c2fde1b7f126e6b2f96aca80ff8aed4ce7a08676`, source `/Users/nicolasalonso/NOVA_OS/UNIVERSAL_CANNONICO_INPUTS/cannonico_inputs.js`, captured 2026-10-30 according to the adjacent provenance record. The ten source fields, preserved text, classification coverage, unclassified lines and explicit non-promotion are retained. Spanish vocabulary is added. It is actually called for admitted text during import/details; it is not an AI substitute or an assertion that the source code scanned a device.

## Error handling

Errors carry a stable `code` and the same code as their message. Relevant codes: `DOC_LOCKED`, `DOC_PHRASE`, `DOC_AUTH`, `DOC_FORMAT`, `DOC_UNSUPPORTED`, `DOC_LOCKS_UNAVAILABLE`, `DOC_STORAGE`, `DOC_BUSY`, `DOC_STALE`, `DOC_FILE_TOO_LARGE`, `DOC_LIMIT`, `DOC_NOT_FOUND`, `DOC_CANCELLED`. Render a Spanish user explanation; do not display the input phrase, raw decrypted data or internal exception objects.

## Verification scope

Fifteen tests currently pass using `node tests/document-vault.test.mjs`: source reduction and Spanish signals; encrypted storage and byte-exact retrieval; wrong phrase, downgrade and tampering; record binding/nonces; binary/UTF-8/size boundaries; search/line limits; metadata edits; concurrent tabs; locking during import and while a database opening is pending; missing Web Locks; encrypted backup merge/tamper rejection; replaced vault configuration; abandoned late connection closure; and closure on transaction construction failure. Tests use synthetic files, real WebCrypto and `fake-indexeddb` 6.2.6. They do not access real user files or accounts. Passing tests establish the checked code paths, not an independent security audit, browser persistence guarantee or device-wide protection. End-to-end browser validation and clear UI wording remain necessary.

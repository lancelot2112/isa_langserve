# ISA Language Server Client Integration Guide

## Overview

This guide provides comprehensive instructions for integrating the ISA Language Server into any LSP-compatible editor or IDE. The server provides advanced semantic highlighting, real-time validation, and rich language features for ISA definition files.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Server Capabilities](#server-capabilities)
3. [Semantic Highlighting](#semantic-highlighting)
4. [Error and Warning Highlighting](#error-and-warning-highlighting)
5. [Code Folding](#code-folding)
6. [Hover Information](#hover-information)
7. [Configuration](#configuration)
8. [Theme Integration](#theme-integration)
9. [File Type Association](#file-type-association)
10. [Example Implementations](#example-implementations)

---

## Quick Start

### Basic LSP Client Setup

```typescript
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

// 1. Configure server options
const serverOptions: ServerOptions = {
  command: 'node',
  args: ['/path/to/isa-language-server/out/server.js', '--stdio'],
  options: { cwd: workspace.rootPath }
};

// 2. Configure client options
const clientOptions: LanguageClientOptions = {
  documentSelector: [
    { scheme: 'file', language: 'isa' },
    { scheme: 'file', pattern: '**/*.isa' },
    { scheme: 'file', pattern: '**/*.isaext' },
    { scheme: 'file', pattern: '**/*.coredef' },
    { scheme: 'file', pattern: '**/*.sysdef' }
  ],
  synchronize: {
    fileEvents: workspace.createFileSystemWatcher('**/*.{isa,isaext,coredef,sysdef}')
  }
};

// 3. Create and start client
const client = new LanguageClient('isa-language-server', 'ISA Language Server', serverOptions, clientOptions);
client.start();
```

---

## Server Capabilities

The ISA Language Server provides the following LSP capabilities:

### Core Capabilities
- ✅ **Text Document Sync** (incremental)
- ✅ **Diagnostics** (errors and warnings)
- ✅ **Hover** (symbol information)
- ✅ **Semantic Tokens** (advanced highlighting)
- ✅ **Folding Range** (code folding)
- ✅ **Document Symbols** (outline view)

### Capability Registration

```typescript
// The server will register these capabilities during initialization
const serverCapabilities = {
  textDocumentSync: TextDocumentSyncKind.Incremental,
  hoverProvider: true,
  semanticTokensProvider: {
    legend: {
      tokenTypes: [/* dynamic token types */],
      tokenModifiers: [/* token modifiers */]
    },
    range: true,
    full: {
      delta: true
    }
  },
  foldingRangeProvider: true,
  documentSymbolProvider: true,
  diagnosticProvider: {
    interFileDependencies: true,
    workspaceDiagnostics: false
  }
};
```

---

## Semantic Highlighting

### Dynamic Token Types

The ISA Language Server uses **dynamic semantic tokens** that adapt to your file content. Space tags automatically get unique colors:

#### Core Token Types
```typescript
const coreTokenTypes = [
  'directive',           // :param, :space, :bus
  'spaceTag',           // reg, insn, ram (base type)
  'fieldTag',           // GPR, XER, CR
  'subfieldTag',        // rA, rB, AA, BD
  'instructionTag',     // add, sub, branch
  'numericLiteral',     // 0x20, 0b1010, 32
  'bitField',           // @(0-5), @(16-20|11-15)
  'quotedString',       // "description text"
  'comment',            // # comment text
  'fieldReference',     // References to defined fields
  'undefinedReference', // Undefined/invalid references
  'contextBracket'      // {}, () brackets
];
```

#### Dynamic Space-Specific Token Types
```typescript
// Automatically generated based on space tags in your file
const dynamicTokenTypes = [
  'spaceTag.reg',       // Register space tags
  'spaceTag.insn',      // Instruction space tags  
  'spaceTag.ram',       // Memory space tags
  'spaceTag.bus',       // Bus space tags
  // ... up to 10 unique space tags with individual colors
];
```

### Semantic Token Configuration

```typescript
// Configure semantic token provider
const semanticTokensOptions = {
  // Enable semantic tokens
  enableSemanticTokens: true,
  
  // Request full document tokens
  semanticTokens: {
    requests: {
      range: true,
      full: {
        delta: true  // Enable incremental updates
      }
    }
  }
};
```

### Requesting Semantic Tokens

```typescript
// Request semantic tokens for a document
const tokens = await client.sendRequest('textDocument/semanticTokens/full', {
  textDocument: { uri: document.uri }
});

// Handle incremental updates
client.onNotification('textDocument/semanticTokens/delta', (params) => {
  // Apply delta changes to existing tokens
  applySemanticTokenDeltas(params.edits);
});
```

---

## Error and Warning Highlighting

### Diagnostic Categories

The server provides comprehensive diagnostics with specific error codes:

#### Error Types (Severity: Error)
```typescript
const errorCodes = {
  'undefined-field-reference': 'Field or symbol not defined',
  'undefined-space': 'Space tag not defined',
  'undefined-alias': 'Alias target not found',
  'undefined-subfield': 'Subfield not defined in referenced field',
  'invalid-identifier': 'Invalid characters in identifier',
  'invalid-numeric-literal': 'Malformed numeric literal',
  'invalid-addr-value': 'Invalid address value',
  'invalid-word-size': 'Invalid word size',
  'invalid-space-type': 'Invalid space type',
  'invalid-param-format': 'Invalid parameter format',
  'bit-index-out-of-range': 'Bit index outside valid range'
};
```

#### Warning Types (Severity: Warning)
```typescript
const warningCodes = {
  'excess-bits-warning': 'Binary literal has more bits than field size',
  'invalid-space-option': 'Invalid option for space directive',
  'invalid-field-option': 'Invalid option for field directive',
  'invalid-bus-option': 'Invalid option for bus directive',
  'invalid-subfield-option': 'Invalid option for subfield',
  'invalid-instruction-option': 'Invalid option for instruction',
  'invalid-range-option': 'Invalid option for range definition'
};
```

### Diagnostic Handling

```typescript
// Listen for diagnostic updates
client.onNotification('textDocument/publishDiagnostics', (params) => {
  const diagnostics = params.diagnostics;
  
  diagnostics.forEach(diagnostic => {
    const decoration = {
      range: diagnostic.range,
      severity: diagnostic.severity,
      message: diagnostic.message,
      code: diagnostic.code,
      source: 'isa-language-server'
    };
    
    // Apply appropriate styling based on severity
    if (diagnostic.severity === DiagnosticSeverity.Error) {
      // Red underline for errors
      applyErrorDecoration(decoration);
    } else if (diagnostic.severity === DiagnosticSeverity.Warning) {
      // Yellow underline for warnings
      applyWarningDecoration(decoration);
    }
  });
});
```

### Error Display Recommendations

```css
/* Recommended CSS for error highlighting */
.isa-error {
  text-decoration: underline wavy red;
  text-decoration-thickness: 2px;
}

.isa-warning {
  text-decoration: underline wavy orange;
  text-decoration-thickness: 1px;
}

.isa-undefined-reference {
  background-color: rgba(255, 0, 0, 0.1);
  text-decoration: underline wavy red;
}
```

---

## Code Folding

### Folding Range Types

The server provides intelligent folding ranges for ISA language constructs:

#### Context Windows
```isa
:space reg addr=32 word=64 type=register
# ↓ Foldable region starts here
:reg GPR size=32 count=32 name=r%d
:reg XER size=32 reset=0
# ↑ Foldable region ends at next directive
:reg CR size=32

:space insn addr=32 word=32 type=ro
# ↓ Next foldable region
:insn size=32 subfields={...}
```

#### Subcontext Windows
```isa
:reg XER subfields={
    # ↓ Foldable subcontext
    SO @(0) descr="Summary Overflow"
    OV @(1) descr="Overflow"
    CA @(2) descr="Carry"
    # ↑ Foldable subcontext ends
}

:insn add (rD,rA,rB) mask={
    # ↓ Foldable mask definition
    OP=0b011111
    OE=0
    Rc=0
    # ↑ Foldable mask ends
}
```

### Folding Range Request

```typescript
// Request folding ranges
const foldingRanges = await client.sendRequest('textDocument/foldingRange', {
  textDocument: { uri: document.uri }
});

// Handle folding ranges
foldingRanges.forEach(range => {
  createFoldingRegion({
    startLine: range.startLine,
    endLine: range.endLine,
    kind: range.kind, // 'region' or 'comment'
    collapsedText: generateCollapsedText(range)
  });
});
```

### Folding Customization

```typescript
const foldingOptions = {
  // Enable automatic folding
  foldingStrategy: 'auto',
  
  // Fold large subcontexts by default
  foldingMaxLines: 10,
  
  // Custom folding icons
  foldingDecorations: {
    contextWindow: '▼ Context...',
    subfields: '▼ Subfields...',
    mask: '▼ Mask...',
    semantics: '▼ Semantics...'
  }
};
```

---

## Hover Information

### Hover Content Types

The server provides rich hover information for different symbol types:

#### Space Tags
```typescript
// Hover over space tag shows:
{
  contents: {
    kind: 'markdown',
    value: `
**Space:** \`reg\`
- **Type:** register
- **Address Size:** 32 bits  
- **Word Size:** 64 bits
- **Endianness:** big

Contains 3 fields, 32 subfields
    `
  },
  range: { /* space tag range */ }
}
```

#### Field Definitions
```typescript
// Hover over field shows:
{
  contents: {
    kind: 'markdown',
    value: `
**Field:** \`GPR\` (General Purpose Registers)
- **Size:** 32 bits
- **Count:** 32 (r0 - r31)
- **Offset:** 0x100
- **Reset Value:** 0

**Usage:** Referenced by 5 instructions
    `
  }
}
```

#### Bit Fields
```typescript
// Hover over bit field shows:
{
  contents: {
    kind: 'markdown',
    value: `
**Bit Field:** \`@(16-20|11-15)\`
- **Total Bits:** 10 bits
- **Segments:** 
  - Bits 16-20 (5 bits)
  - Bits 11-15 (5 bits)
- **Container Size:** 32 bits
- **Concatenation Order:** MSB first
    `
  }
}
```

#### Numeric Literals
```typescript
// Hover over numeric literal shows:
{
  contents: {
    kind: 'markdown',
    value: `
**Numeric Literal:** \`0x20\`
- **Decimal:** 32
- **Binary:** 0b100000
- **Octal:** 0o40
- **Bit Width:** 6 bits
    `
  }
}
```

### Hover Request Handling

```typescript
// Request hover information
client.onRequest('textDocument/hover', async (params) => {
  return await client.sendRequest('textDocument/hover', {
    textDocument: params.textDocument,
    position: params.position
  });
});
```

---

## Configuration

### Client Configuration

```typescript
const isaLanguageConfig = {
  // Validation settings
  validation: {
    enableSemanticValidation: true,
    enableSyntaxValidation: true,
    enableWarnings: true,
    strictMode: false
  },
  
  // Highlighting settings  
  highlighting: {
    enableSemanticTokens: true,
    uniqueSpaceColors: true,
    maxSpaceColors: 10,
    enableErrorHighlighting: true
  },
  
  // Feature settings
  features: {
    enableHover: true,
    enableFolding: true,
    enableDiagnostics: true,
    enableDocumentSymbols: true
  },
  
  // Performance settings
  performance: {
    validationDelay: 300,  // ms
    tokenUpdateDelay: 100, // ms
    maxFileSize: 1048576   // 1MB
  }
};
```

### Server Configuration

```typescript
// Send configuration to server
client.sendNotification('workspace/didChangeConfiguration', {
  settings: {
    isaLanguageServer: isaLanguageConfig
  }
});
```

---

## Theme Integration

### Default Color Scheme

The server provides a default 10-color HSL palette for space tags:

```typescript
const defaultSpaceColors = [
  { h: 210, s: 70, l: 50 }, // Blue
  { h: 120, s: 70, l: 45 }, // Green  
  { h: 30,  s: 80, l: 55 }, // Orange
  { h: 270, s: 65, l: 55 }, // Purple
  { h: 0,   s: 70, l: 55 }, // Red
  { h: 180, s: 65, l: 45 }, // Cyan
  { h: 60,  s: 75, l: 50 }, // Yellow
  { h: 300, s: 70, l: 60 }, // Magenta
  { h: 150, s: 60, l: 45 }, // Teal
  { h: 330, s: 65, l: 55 }  // Pink
];
```

### Theme File Structure

Create theme files for different editor themes:

```json
// isa-dark-theme.json
{
  "name": "ISA Language Dark Theme",
  "type": "dark",
  "semanticTokenColors": {
    "directive": "#569CD6",
    "spaceTag": "#4EC9B0",
    "fieldTag": "#9CDCFE",
    "subfieldTag": "#DCDCAA",
    "numericLiteral": "#B5CEA8",
    "bitField": "#C586C0",
    "comment": "#6A9955",
    "quotedString": "#CE9178",
    "undefinedReference": "#F44747",
    
    // Dynamic space tag colors
    "spaceTag.reg": "#4FC1FF",
    "spaceTag.insn": "#FFD700",
    "spaceTag.ram": "#98FB98",
    "spaceTag.bus": "#DDA0DD"
  }
}
```

```json
// isa-light-theme.json  
{
  "name": "ISA Language Light Theme",
  "type": "light",
  "semanticTokenColors": {
    "directive": "#0000FF",
    "spaceTag": "#008080",
    "fieldTag": "#001080",
    "subfieldTag": "#795E26",
    "numericLiteral": "#098658",
    "bitField": "#AF00DB",
    "comment": "#008000",
    "quotedString": "#A31515",
    "undefinedReference": "#CD3131"
  }
}
```

### Theme Application

```typescript
// Apply theme based on editor theme
function applyISATheme(editorTheme: 'dark' | 'light') {
  const themeFile = editorTheme === 'dark' 
    ? './themes/isa-dark-theme.json'
    : './themes/isa-light-theme.json';
    
  const theme = require(themeFile);
  
  // Apply semantic token colors
  Object.entries(theme.semanticTokenColors).forEach(([tokenType, color]) => {
    setSemanticTokenColor(tokenType, color);
  });
}
```

---

## File Type Association

### File Extensions

Associate these file extensions with the ISA language:

```typescript
const isaFileAssociations = {
  '*.isa': 'isa',      // Base ISA definition files
  '*.isaext': 'isa',   // ISA extension files
  '*.coredef': 'isa',  // Core definition files (future)
  '*.sysdef': 'isa'    // System definition files (future)
};
```

### Language Registration

```typescript
// Register ISA language
languages.register({
  id: 'isa',
  extensions: ['.isa', '.isaext', '.coredef', '.sysdef'],
  aliases: ['ISA', 'isa'],
  mimetypes: ['text/x-isa'],
  configuration: './language-configuration.json'
});
```

### Language Configuration

```json
// language-configuration.json
{
  "comments": {
    "lineComment": "#"
  },
  "brackets": [
    ["{", "}"],
    ["(", ")"]
  ],
  "autoClosingPairs": [
    {"open": "{", "close": "}"},
    {"open": "(", "close": ")"},
    {"open": "\"", "close": "\""}
  ],
  "surroundingPairs": [
    ["{", "}"],
    ["(", ")"],
    ["\"", "\""]
  ],
  "folding": {
    "markers": {
      "start": "^\\s*:(?:space|reg|insn)\\b|\\{\\s*$",
      "end": "^\\s*:|\\}\\s*$"
    }
  }
}
```

---

## Example Implementations

### VS Code Extension

```typescript
// extension.ts
import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

export function activate(context: vscode.ExtensionContext) {
  // 1. Register language
  const langConfig = vscode.languages.setLanguageConfiguration('isa', {
    comments: { lineComment: '#' },
    brackets: [['(', ')'], ['{', '}']],
    wordPattern: /[a-zA-Z_][a-zA-Z0-9_.-]*/
  });
  
  // 2. Start language server
  const client = createLanguageClient(context);
  client.start();
  
  // 3. Register additional features
  registerCustomCommands(context, client);
  registerSemanticTokenProvider(context);
  
  context.subscriptions.push(langConfig, client);
}

function createLanguageClient(context: vscode.ExtensionContext): LanguageClient {
  const serverModule = context.asAbsolutePath('out/server.js');
  
  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: { execArgv: ['--nolazy', '--inspect=6009'] }}
  };
  
  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'isa' }],
    synchronize: {
      configurationSection: 'isaLanguageServer',
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{isa,isaext,coredef,sysdef}')
    }
  };
  
  return new LanguageClient('isa-language-server', 'ISA Language Server', serverOptions, clientOptions);
}
```

### Neovim LSP Setup

```lua
-- init.lua
local lspconfig = require('lspconfig')

-- Configure ISA language server
lspconfig.isa_language_server = {
  default_config = {
    cmd = {'node', '/path/to/isa-language-server/out/server.js', '--stdio'},
    filetypes = {'isa'},
    root_dir = function(fname)
      return lspconfig.util.find_git_ancestor(fname) or vim.loop.os_homedir()
    end,
    settings = {
      isaLanguageServer = {
        validation = { enableSemanticValidation = true },
        highlighting = { uniqueSpaceColors = true }
      }
    }
  }
}

-- Setup ISA language server
lspconfig.isa_language_server.setup({
  on_attach = function(client, bufnr)
    -- Enable semantic tokens
    if client.server_capabilities.semanticTokensProvider then
      vim.lsp.semantic_tokens.start(bufnr, client.id)
    end
    
    -- Setup keybindings
    local opts = { noremap=true, silent=true, buffer=bufnr }
    vim.keymap.set('n', 'K', vim.lsp.buf.hover, opts)
    vim.keymap.set('n', 'gd', vim.lsp.buf.definition, opts)
  end,
  
  capabilities = require('cmp_nvim_lsp').default_capabilities()
})

-- File type detection
vim.cmd([[
  augroup ISAFileType
    autocmd!
    autocmd BufRead,BufNewFile *.isa,*.isaext,*.coredef,*.sysdef set filetype=isa
  augroup END
]])
```

### Emacs LSP Configuration

```elisp
;; isa-mode.el
(require 'lsp-mode)

(defgroup isa nil
  "ISA language support"
  :group 'languages)

(defcustom isa-language-server-command
  '("node" "/path/to/isa-language-server/out/server.js" "--stdio")
  "Command to start ISA language server"
  :type '(repeat string)
  :group 'isa)

(define-derived-mode isa-mode prog-mode "ISA"
  "Major mode for ISA language files"
  (setq-local comment-start "#")
  (setq-local comment-start-skip "#+ *")
  (setq-local comment-end "")
  
  ;; Font lock setup
  (setq font-lock-defaults
        '((isa-font-lock-keywords) nil nil nil nil)))

;; Register with LSP
(lsp-register-client
 (make-lsp-client
  :new-connection (lsp-stdio-connection (lambda () isa-language-server-command))
  :major-modes '(isa-mode)
  :server-id 'isa-language-server
  :initialization-options (lambda ()
                           '((validation . ((enableSemanticValidation . t)))
                             (highlighting . ((uniqueSpaceColors . t)))))))

;; File associations
(add-to-list 'auto-mode-alist '("\\.isa\\'" . isa-mode))
(add-to-list 'auto-mode-alist '("\\.isaext\\'" . isa-mode))
(add-to-list 'auto-mode-alist '("\\.coredef\\'" . isa-mode))
(add-to-list 'auto-mode-alist '("\\.sysdef\\'" . isa-mode))

(provide 'isa-mode)
```

---

## Troubleshooting

### Common Issues

#### Server Not Starting
```bash
# Check server binary
node /path/to/server.js --stdio

# Check permissions
chmod +x /path/to/server.js

# Check dependencies
npm list --depth=0
```

#### Semantic Tokens Not Working
```typescript
// Verify capability registration
if (!client.capabilities.semanticTokensProvider) {
  console.error('Semantic tokens not supported by server');
}

// Check token legend
const legend = client.capabilities.semanticTokensProvider.legend;
console.log('Available token types:', legend.tokenTypes);
```

#### Diagnostics Not Appearing
```typescript
// Check diagnostic configuration
const config = {
  diagnostics: {
    enable: true,
    enabledRules: ['all']
  }
};

// Verify file is being validated
client.onNotification('textDocument/publishDiagnostics', (params) => {
  console.log('Diagnostics received:', params.diagnostics.length);
});
```

### Performance Tuning

```typescript
const performanceSettings = {
  // Reduce validation frequency for large files
  validationDelay: 500,
  
  // Limit semantic token updates
  semanticTokens: {
    refreshDelay: 200,
    maxFileSize: 500000 // 500KB
  },
  
  // Optimize memory usage
  maxCacheSize: 50,
  gcInterval: 30000 // 30 seconds
};
```

---

This guide provides everything needed to integrate the ISA Language Server into any LSP-compatible editor with full feature support including semantic highlighting, error detection, code folding, and hover information.
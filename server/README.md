# ISA Language Server

A Language Server Protocol (LSP) 3.17.0 implementation for ISA definition files (`.isa`, `.isaext`, `.coredef`, `.sysdef`).

## Features

- **Context-aware tokenization** avoiding regex pattern matching
- **Semantic highlighting** with dynamic space tag coloring
- **Cross-file analysis** for `.isaext` dependencies
- **Bit field validation** with container size checking
- **Real-time diagnostics** with comprehensive error reporting
- **LSP 3.17.0 compliance** with completion, hover, and go-to-definition

## Architecture

- **Parser Module**: Tokenizer, bit field parser, AST building
- **Analysis Module**: Semantic analyzer, symbol table, validation
- **LSP Features**: Diagnostics, completion, hover, definition, semantic tokens
- **Workspace Management**: Multi-file projects and dependency tracking

## Usage

### Start Server
```bash
npm run build
node out/server.js --stdio
```

### Integration
The server implements standard LSP over JSON-RPC 2.0 and can be integrated with any LSP-compatible editor.

## Testing

```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
npm run test:watch    # Watch mode
```

## Development

```bash
npm run build         # Build TypeScript
npm run watch         # Watch mode
npm run clean         # Clean build artifacts
```

## Language Support

### File Types
- `.isa` - Base ISA definitions
- `.isaext` - ISA extensions
- `.coredef` - Core definitions with includes
- `.sysdef` - System definitions with attachments

### Key Features
- **Dynamic Space Coloring**: Each space tag gets unique color
- **Context-Aware Parsing**: Understands directive contexts and subcontexts
- **Bit Field Validation**: Validates `@(...)` specifications against container sizes
- **Cross-Reference Validation**: Ensures all symbol references are valid

## Error Handling

- **Syntax Errors**: Malformed directives, invalid literals
- **Semantic Errors**: Undefined references, bit index out of range
- **Warning Conditions**: Field overlaps, unused definitions
- **Clear Messages**: Line/column positions with suggested fixes
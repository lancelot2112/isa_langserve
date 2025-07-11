# VS Code ISA Language Extension Implementation Plan

## Overview
This VS Code extension provides a rich editing experience for ISA definition files (`.isa`, `.isaext`, `.coredef`, `.sysdef`) by implementing a language client that communicates with our custom language server via JSON-RPC 2.0. The extension relies primarily on semantic tokens from the language server for accurate, context-aware syntax highlighting.

## Technology Stack

### Core Technologies
- **TypeScript 5.0+** - Primary development language
- **VS Code Extension API 1.74+** - Latest stable VS Code extension capabilities
- **vscode-languageclient** - Microsoft's LSP client implementation
- **vscode-languageserver-protocol** - LSP protocol definitions

### Extension Development
- **@types/vscode** - VS Code API type definitions
- **webpack** - Bundle optimization for faster loading
- **esbuild** - Fast TypeScript compilation
- **jest** - Testing framework for extension logic
- **@vscode/test-cli** - Command-line test runner using VS Code environment
- **@vscode/test-electron** - VS Code extension testing utilities

## Architecture Design

### Folder Structure
```
client/
   src/
      extension.ts              # Main extension entry point
      language-client.ts        # LSP client configuration and management
      features/
         semantic-highlighting.ts  # Semantic token handling
         color-scheme.ts           # Dynamic color management for space tags
         file-associations.ts     # File type associations
         workspace-config.ts      # Configuration management
         commands/
             validate-project.ts  # Project validation command
             format-document.ts   # Document formatting command
             debug-parser.ts      # Parser debugging utilities
      providers/
         outline-provider.ts      # Custom outline view
         symbol-provider.ts       # Workspace symbol provider
         task-provider.ts         # Build task integration
      views/
         project-explorer.ts      # Custom project view
         dependency-graph.ts      # Visual dependency explorer
         bit-field-visualizer.ts  # Bit field layout viewer
      diagnostics/
         problem-matcher.ts       # Problem pattern matching
         error-lens.ts            # Inline error display
      utils/
          workspace-utils.ts       # Workspace management utilities
          settings-manager.ts      # Extension settings management
          logger.ts                # Extension logging
   themes/
      isa-semantic-dark.json       # Semantic token theme (dark)
      isa-semantic-light.json      # Semantic token theme (light)
      isa-semantic-hc.json         # High contrast semantic theme
   snippets/
      isa.json                     # Code snippets for .isa files
      isaext.json                  # Snippets for .isaext files
      coredef.json                 # Snippets for .coredef files
      sysdef.json                  # Snippets for .sysdef files
   icons/
      isa-file.svg                 # File icon for .isa files
      extension-file.svg           # File icon for .isaext files
      core-file.svg                # File icon for .coredef files
      system-file.svg              # File icon for .sysdef files
   test/
      suite/
         extension.test.ts
         language-client.test.ts
         integration.test.ts
      fixtures/                    # Test workspace files
   package.json                     # Extension manifest
   webpack.config.js                # Bundle configuration
   tsconfig.json
   .vscodeignore                    # Files to exclude from package
```

## Core Components

### 1. Extension Entry Point (`extension.ts`)
- **Activation**: Extension lifecycle management
- **Language Server**: Start/stop language server process
- **Command Registration**: Register all extension commands
- **Configuration**: Initialize workspace configuration
- **Event Handling**: Handle VS Code events and workspace changes

### 2. Language Client (`language-client.ts`)
- **LSP Configuration**: Configure language server connection with semantic tokens support
- **Server Options**: Language server executable and arguments
- **Client Options**: Document selector and synchronization settings
- **Feature Registration**: Enable semantic tokens, diagnostics, completion, etc.
- **Error Handling**: Handle server crashes and connection issues

### 3. Features Module (`features/`)
- **Semantic Highlighting**: Handle semantic tokens from language server
- **Color Scheme**: Dynamic color assignment for space tags based on server analysis
- **File Associations**: Register file extensions with language ID
- **Workspace Config**: Extension settings and preferences
- **Commands**: Extension-specific commands and functionality

### 4. Providers Module (`providers/`)
- **Outline Provider**: Custom document outline with semantic structure
- **Symbol Provider**: Enhanced workspace symbol search
- **Task Provider**: Integration with VS Code task system for validation

### 5. Views Module (`views/`)
- **Project Explorer**: Custom tree view for ISA project structure
- **Dependency Graph**: Visual representation of file dependencies
- **Bit Field Visualizer**: Interactive bit field layout display

## Key Features Implementation

### 1. Semantic Token-Based Highlighting
- **No TextMate Grammar**: Rely entirely on semantic tokens from language server
- **Dynamic Space Colors**: Each space tag gets unique color assigned by server
- **Context-Aware**: Distinguish between space tags, field names, instruction names
- **Cross-File Awareness**: Highlight undefined references differently
- **Rich Semantics**: Different highlighting for source/target operands, func/imm fields

### 2. Semantic Token Types (from Language Server)
```typescript
// Token types the language server will provide
enum SemanticTokenTypes {
  // Directives
  'directive',           // :param, :space, :bus, etc.
  'spaceDirective',      // :reg, :insn (with space-specific colors)
  
  // Space and field identifiers  
  'spaceTag',            // ram, reg, insn (each gets unique color)
  'fieldTag',            // GPR, PC, XER
  'subfieldTag',         // AA, BD, rA (inherit space color)
  'instructionTag',      // add, sub, b
  
  // Values and literals
  'numericLiteral',      // 0x123, 0b1010, 42
  'bitField',            // @(0-5), @(16-20|11-15)
  'quotedString',        // "description text"
  
  // Operational semantics
  'sourceOperand',       // Fields marked as op=source
  'targetOperand',       // Fields marked as op=target  
  'funcField',           // Fields marked as op=func
  'immField',            // Fields marked as op=imm
  
  // References
  'fieldReference',      // References to defined fields
  'undefinedReference',  // References to undefined symbols
  'aliasReference',      // alias= references
  
  // Context indicators
  'contextBracket',      // {}, () with nesting level colors
  'comment'              // # comments
}
```

### 3. File Type Support
- **File Associations**: Automatic language detection for all file types
- **Custom Icons**: Distinct icons for each file type in explorer
- **File Templates**: Code snippets and templates for new files
- **Workspace Integration**: ISA-aware workspace navigation

### 4. Enhanced Editor Experience
- **Custom Outline**: Semantic document structure in outline view
- **Breadcrumbs**: Context-aware breadcrumb navigation
- **Code Folding**: Fold context windows and subcontexts (from language server)
- **Smart Indentation**: Context-aware indentation rules

### 5. Project Management
- **Project Explorer**: Custom view showing ISA project structure
- **Dependency Visualization**: Graph view of file dependencies
- **Multi-File Validation**: Project-wide validation and error reporting
- **Build Integration**: VS Code task integration for validation scripts

### 6. Developer Tools
- **Bit Field Visualizer**: Interactive bit layout display
- **Parser Debugging**: Tools for debugging parser issues
- **Symbol Inspector**: Detailed symbol information display
- **Configuration UI**: Settings UI for extension preferences

## VS Code Integration

### Extension Manifest (`package.json`)
```json
{
  "name": "isa-language-support",
  "displayName": "ISA Language Support",
  "description": "Language support for ISA definition files",
  "version": "1.0.0",
  "engines": { "vscode": "^1.74.0" },
  "categories": ["Programming Languages", "Other"],
  "activationEvents": [
    "onLanguage:isa",
    "onLanguage:isaext", 
    "onLanguage:coredef",
    "onLanguage:sysdef"
  ],
  "contributes": {
    "languages": [
      {
        "id": "isa",
        "extensions": [".isa"],
        "configuration": "./language-configuration.json"
      },
      {
        "id": "isaext", 
        "extensions": [".isaext"],
        "configuration": "./language-configuration.json"
      },
      {
        "id": "coredef",
        "extensions": [".coredef"], 
        "configuration": "./language-configuration.json"
      },
      {
        "id": "sysdef",
        "extensions": [".sysdef"],
        "configuration": "./language-configuration.json"
      }
    ],
    "semanticTokenScopes": [
      {
        "language": "isa",
        "scopes": {
          "directive": ["keyword.control.directive.isa"],
          "spaceTag": ["entity.name.type.space.isa"],
          "fieldTag": ["entity.name.function.field.isa"],
          "numericLiteral": ["constant.numeric.isa"],
          "bitField": ["constant.other.bitfield.isa"],
          "comment": ["comment.line.isa"]
        }
      }
    ],
    "themes": [
      {
        "label": "ISA Dark",
        "uiTheme": "vs-dark", 
        "path": "./themes/isa-semantic-dark.json"
      }
    ],
    "snippets": [/* code snippets */],
    "commands": [/* extension commands */],
    "views": [/* custom views */],
    "configuration": [/* settings schema */]
  }
}
```

### Language Configuration (No Grammar!)
```json
{
  "comments": {
    "lineComment": "#"
  },
  "brackets": [
    ["{", "}"],
    ["(", ")"]
  ],
  "autoClosingPairs": [
    ["{", "}"],
    ["(", ")"],
    ["\"", "\""]
  ],
  "surroundingPairs": [
    ["{", "}"],
    ["(", ")"],
    ["\"", "\""]
  ],
  "folding": {
    "markers": {
      "start": "^\\s*:",
      "end": "^\\s*:"
    }
  }
}
```

### Semantic Token Themes
Instead of TextMate scopes, we define semantic token styling:
```json
{
  "semanticHighlighting": true,
  "semanticTokenColors": {
    "directive": "#569cd6",
    "spaceTag.ram": "#4ec9b0", 
    "spaceTag.reg": "#c586c0",
    "spaceTag.insn": "#9cdcfe",
    "fieldTag": "#dcdcaa",
    "numericLiteral": "#b5cea8",
    "bitField": "#ce9178",
    "sourceOperand": "#4fc1ff",
    "targetOperand": "#ff6b6b",
    "undefinedReference": {
      "foreground": "#f44747",
      "fontStyle": "underline"
    }
  }
}
```

**IMPORTANT**: Each theme file requires `"semanticHighlighting": true` to enable semantic token coloration.

## Highlighting Strategy

### Primary: Semantic Tokens
- **Rich Context**: Language server provides semantic understanding
- **Dynamic Colors**: Space tags get unique colors assigned at runtime
- **Cross-File Validation**: Undefined references highlighted differently
- **Accurate Parsing**: Same parser used for highlighting and validation

### Fallback: Minimal Basic Highlighting
- **Comments Only**: Basic `#` comment highlighting before server connects
- **No Complex Patterns**: Avoid regex-based highlighting that conflicts
- **Fast Activation**: Immediate basic functionality while server starts

### Color Assignment Strategy
```typescript
// Language server assigns colors dynamically
interface SpaceColorAssignment {
  spaceTag: string;
  color: string; // HSL color assigned by server
  usageLocations: Range[]; // All locations this space is used
}

// Client receives color assignments and applies them
interface SemanticToken {
  line: number;
  char: number; 
  length: number;
  tokenType: string;
  tokenModifiers: string[];
  spaceTag?: string; // For space-specific coloring
}
```

## Testing Strategy

### Unit Tests with @vscode/test-cli
- **Command Line Runner**: Use `vscode-test` command for automated testing
- **VS Code Environment**: Tests run in actual VS Code environment for realistic conditions
- **CI/CD Integration**: Automated test execution in build pipelines
- **Multiple VS Code Versions**: Test against different VS Code versions

### Extension Tests
- **Activation Tests**: Verify extension activation without server
- **Language Client Tests**: Test LSP client configuration and communication
- **Semantic Token Tests**: Verify semantic token handling and color application
- **Command Tests**: Verify all extension commands work correctly

### Integration Tests
- **End-to-End**: Full editing experience with language server
- **Semantic Highlighting**: Test dynamic color assignment
- **Multi-File**: Test project-wide features
- **Performance**: Extension startup and highlighting performance

### Test Scripts
```json
{
  "scripts": {
    "test": "vscode-test",
    "test:watch": "vscode-test --watch",
    "test:coverage": "vscode-test --coverage"
  }
}
```

### User Acceptance Testing
- **Example Files**: Test with provided example files
- **Color Accuracy**: Verify space tags get unique colors as specified
- **Real Projects**: Test with realistic ISA projects
- **Feature Coverage**: Verify all advertised features work

## Configuration and Settings

### Extension Settings
```json
{
  "isaLanguage.server.path": "Path to language server executable",
  "isaLanguage.validation.enabled": "Enable real-time validation",
  "isaLanguage.highlighting.useSemanticTokens": "Use semantic tokens (default: true)",
  "isaLanguage.colorScheme.autoAssign": "Auto-assign space tag colors",
  "isaLanguage.colorScheme.spaceColors": "Manual space tag color overrides",
  "isaLanguage.editor.foldingEnabled": "Enable code folding",
  "isaLanguage.diagnostics.maxProblems": "Maximum problems to show",
  "isaLanguage.trace.server": "Language server trace level"
}
```

### Workspace Configuration
- **Project Settings**: Per-workspace ISA configuration
- **Include Paths**: Search paths for include resolution
- **Validation Rules**: Configurable validation strictness
- **Color Preferences**: Override automatic space tag colors

## Development Guidelines

### Code Quality
- **TypeScript Strict**: Enable strict TypeScript checking
- **ESLint Configuration**: Consistent code style enforcement
- **Extension Best Practices**: Follow VS Code extension guidelines
- **Performance**: Minimize extension startup time and memory usage

### Semantic Token Best Practices
- **Efficient Updates**: Handle incremental semantic token updates
- **Color Management**: Efficient color assignment and caching
- **Fallback Handling**: Graceful degradation when server unavailable
- **Memory Management**: Proper cleanup of token data structures

### User Experience
- **Progressive Enhancement**: Basic functionality without server, rich features with server
- **Responsive UI**: Fast response to user interactions
- **Clear Feedback**: Visual indicators when semantic highlighting is/isn't available
- **Accessibility**: Support for screen readers and high contrast themes

## Extension Commands

### File Management
- `isa.createProject`: Create new ISA project structure
- `isa.validateProject`: Validate entire project
- `isa.formatDocument`: Format current document

### Highlighting & Colors
- `isa.refreshSemanticTokens`: Force refresh of semantic highlighting
- `isa.showColorAssignments`: Display current space tag color assignments
- `isa.resetSpaceColors`: Reset space tag colors to auto-assigned values

### Navigation
- `isa.gotoDefinition`: Enhanced go-to-definition
- `isa.findReferences`: Find all references with context
- `isa.showDependencies`: Show file dependency graph

### Debugging
- `isa.debugParser`: Debug parser for current file
- `isa.showSemanticTokens`: Show semantic token details
- `isa.validateSyntax`: Syntax-only validation

### Visualization
- `isa.showBitFields`: Visualize bit field layouts
- `isa.showSymbolTable`: Display symbol table
- `isa.exportDocumentation`: Generate project documentation
#!/usr/bin/env node
/**
 * ISA Language Server main entry point
 * Implements Language Server Protocol 3.17.0
 */

import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  ServerCapabilities,
  SemanticTokensParams,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  HoverParams,
  Hover,
  DefinitionParams,
  Definition,
  Location,
  DocumentSymbolParams,
  DocumentSymbol,
  SymbolKind,
  FoldingRangeParams,
  FoldingRange,
  FoldingRangeKind,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticAnalyzer } from './analysis/semantic-analyzer';
import { ISALanguageServerConfig } from './parser/types';

// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Server configuration
const defaultSettings: ISALanguageServerConfig = {
  maxProblems: 100,
  enableValidation: true,
  colorScheme: {
    autoAssign: true,
    spaceColors: {},
  },
  includePaths: [],
};

// Document-specific settings cache
const documentSettings: Map<string, Thenable<ISALanguageServerConfig>> = new Map();

// Semantic analyzer instance
let analyzer: SemanticAnalyzer;
try {
  analyzer = new SemanticAnalyzer();
  connection.console.info('Semantic analyzer initialized successfully');
} catch (error) {
  connection.console.error(`Failed to initialize semantic analyzer: ${error}`);
  throw error;
}

// Base semantic token types
const baseTokenTypes = [
  'directive',
  'spaceDirective', 
  'spaceTag',
  'fieldTag',
  'subfieldTag',
  'instructionTag',
  'spaceOptionTag',
  'fieldOptionTag',
  'busOptionTag',
  'subfieldOptionTag',
  'instructionOptionTag',
  'rangeOptionTag',
  'equalsSign',
  'numericLiteral',
  'bitField',
  'quotedString',
  'sourceOperand',
  'targetOperand',
  'funcField',
  'immField',
  'fieldReference',
  'undefinedReference',
  'aliasReference',
  'contextBracket',
  'comment',
];

// Dynamic space-specific token types will be added at runtime
const dynamicSpaceTokenTypes: string[] = [];

// Semantic tokens legend - will be updated dynamically
let semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes: [...baseTokenTypes],
  tokenModifiers: [
    'declaration',
    'definition',
    'readonly',
    'static',
    'deprecated',
    'abstract',
    'async',
    'modification',
    'documentation',
    'defaultLibrary',
  ],
};

// Update semantic tokens legend with discovered space tags
function updateSemanticTokensLegend(spaceTags: string[]): void {
  const newSpaceTokenTypes: string[] = [];
  
  for (const spaceTag of spaceTags) {
    const spaceTokenType = `spaceTag.${spaceTag}`;
    if (!semanticTokensLegend.tokenTypes.includes(spaceTokenType)) {
      newSpaceTokenTypes.push(spaceTokenType);
    }
  }
  
  if (newSpaceTokenTypes.length > 0) {
    semanticTokensLegend.tokenTypes = [...baseTokenTypes, ...dynamicSpaceTokenTypes, ...newSpaceTokenTypes];
    dynamicSpaceTokenTypes.push(...newSpaceTokenTypes);
    connection.console.info(`Added dynamic space token types: ${newSpaceTokenTypes.join(', ')}`);
  }
}

// Store initialization options
let initializationOptions: any = {};

// Server initialization
connection.onInitialize((params: InitializeParams): InitializeResult => {
  // Store initialization options from client
  initializationOptions = params.initializationOptions || {};
  const capabilities: ServerCapabilities = {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    completionProvider: {
      resolveProvider: true,
      triggerCharacters: [':', '@', '.'],
    },
    hoverProvider: true,
    definitionProvider: true,
    referencesProvider: true,
    documentSymbolProvider: true,
    workspaceSymbolProvider: true,
    semanticTokensProvider: {
      legend: semanticTokensLegend,
      range: false,
      full: {
        delta: false,
      },
    },
    foldingRangeProvider: true,
  };

  return {
    capabilities,
    serverInfo: {
      name: 'ISA Language Server',
      version: '1.0.0',
    },
  };
});

connection.onInitialized(() => {
  connection.client.register(DidChangeConfigurationNotification.type, undefined);
});

// Configuration change handler
connection.onDidChangeConfiguration(_change => {
  // Clear settings cache when configuration changes
  documentSettings.clear();
  
  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

// Document change handlers
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

documents.onDidClose(e => {
  documentSettings.delete(e.document.uri);
});

// Validation
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings = await getDocumentSettings(textDocument.uri);
  
  connection.console.info(`Called to validate document: ${textDocument.uri}`);
  if (!settings.enableValidation) {
    connection.console.info(`Validation is disabled`);
    return;
  }

  try {
    const result = analyzer.analyzeFile(textDocument);
    
    // Convert validation errors to LSP diagnostics
    const diagnostics: Diagnostic[] = result.errors.slice(0, settings.maxProblems).map(error => {
      const diagnostic: Diagnostic = {
        severity: error.severity === 'error' ? DiagnosticSeverity.Error :
                  error.severity === 'warning' ? DiagnosticSeverity.Warning :
                  DiagnosticSeverity.Information,
        range: error.location.range,
        message: error.message,
        source: 'isa-language-server',
      };
      
      if (error.code) {
        diagnostic.code = error.code;
      }

      connection.console.info(`Diagnostic ${diagnostic.message} at ${diagnostic.range.start.line}:${diagnostic.range.start.character}`);
      
      return diagnostic;
    });

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  } catch (error) {
    connection.console.error(`Error validating document ${textDocument.uri}: ${error}`);
  }
}

// Semantic tokens provider
connection.onRequest('textDocument/semanticTokens/full', (params: SemanticTokensParams): SemanticTokens => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return { data: [] };
  }

  try {
    const result = analyzer.analyzeFile(document);
    
    // Extract space tags from tokens and update legend dynamically
    const spaceTags = new Set<string>();
    for (const token of result.tokens) {
      if ((token.type === 'spaceTag' || token.type === 'spaceDirective') && token.spaceTag) {
        spaceTags.add(token.spaceTag);
      }
    }
    updateSemanticTokensLegend(Array.from(spaceTags));
    
    const builder = new SemanticTokensBuilder();
    
    // Sort tokens by line and character
    const sortedTokens = result.tokens.sort((a, b) => {
      if (a.location.start.line !== b.location.start.line) {
        return a.location.start.line - b.location.start.line;
      }
      return a.location.start.character - b.location.start.character;
    });

    for (const token of sortedTokens) {
      let tokenTypeName = token.type;
      
      // Use space-specific token type for space tags
      if ((token.type === 'spaceTag' || token.type === 'spaceDirective') && token.spaceTag) {
        const spaceSpecificType = `spaceTag.${token.spaceTag}`;
        if (semanticTokensLegend.tokenTypes.includes(spaceSpecificType)) {
          tokenTypeName = spaceSpecificType as any;
        }
      }
      
      const tokenTypeIndex = semanticTokensLegend.tokenTypes.indexOf(tokenTypeName);
      if (tokenTypeIndex >= 0) {
        const length = token.location.end.character - token.location.start.character;
        builder.push(
          token.location.start.line,
          token.location.start.character,
          length,
          tokenTypeIndex,
          0 // token modifiers (encoded as bit flags)
        );
      }
    }

    return builder.build();
  } catch (error) {
    connection.console.error(`Error generating semantic tokens for ${params.textDocument.uri}: ${error}`);
    return { data: [] };
  }
});

// Completion provider
connection.onCompletion((params: TextDocumentPositionParams): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  try {
    const symbolTable = analyzer.getSymbolTable();
    const completions: CompletionItem[] = [];

    // Get current line context
    const line = document.getText().split('\n')[params.position.line];
    const prefix = line ? line.substring(0, params.position.character) : '';

    // Space tag completions after ':'
    if (prefix.endsWith(':')) {
      const spaceTags = symbolTable.getSpaceTags();
      for (const spaceTag of spaceTags) {
        completions.push({
          label: spaceTag,
          kind: CompletionItemKind.Class,
          detail: `Space: ${spaceTag}`,
          insertText: spaceTag,
        });
      }
    }

    // Field completions in appropriate contexts
    if (prefix.includes(':') && !prefix.endsWith(':')) {
      const spaceMatch = prefix.match(/:(\w+)/);
      if (spaceMatch) {
        const spaceTag = spaceMatch[1];
        if (spaceTag) {
          const fields = symbolTable.getSymbolsInScope(spaceTag);
          for (const field of fields) {
            completions.push({
              label: field.name,
              kind: CompletionItemKind.Field,
              detail: `Field in ${spaceTag}`,
              insertText: field.name,
            });
          }
        }
      }
    }

    return completions;
  } catch (error) {
    connection.console.error(`Error generating completions: ${error}`);
    return [];
  }
});

// Hover provider
connection.onHover((params: HoverParams): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  try {
    const symbolTable = analyzer.getSymbolTable();
    const symbol = symbolTable.findSymbolAtPosition(
      params.textDocument.uri,
      params.position.line,
      params.position.character
    );

    if (symbol) {
      let content = `**${symbol.type}**: ${symbol.name}`;
      
      if (symbol.spaceTag) {
        content += `\n\nSpace: ${symbol.spaceTag}`;
      }

      if (symbol.definition) {
        const def = symbol.definition as any;
        if (def.description) {
          content += `\n\n${def.description}`;
        }
        
        // Add type-specific information
        if (symbol.type === 'field') {
          const fieldDef = def as any;
          if (fieldDef.size) {
            content += `\n\nSize: ${fieldDef.size} bits`;
          }
          if (fieldDef.offset !== undefined) {
            content += `\n\nOffset: 0x${fieldDef.offset.toString(16)}`;
          }
        }
      }

      return {
        contents: {
          kind: 'markdown',
          value: content,
        },
        range: symbol.location.range,
      };
    }

    return null;
  } catch (error) {
    connection.console.error(`Error generating hover: ${error}`);
    return null;
  }
});

// Go to definition provider
connection.onDefinition((params: DefinitionParams): Definition | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  try {
    const symbolTable = analyzer.getSymbolTable();
    const symbol = symbolTable.findSymbolAtPosition(
      params.textDocument.uri,
      params.position.line,
      params.position.character
    );

    if (symbol) {
      return Location.create(symbol.fileUri, symbol.location.range);
    }

    return null;
  } catch (error) {
    connection.console.error(`Error finding definition: ${error}`);
    return null;
  }
});

// Document symbol provider
connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  try {
    const result = analyzer.analyzeFile(document);
    const symbols: DocumentSymbol[] = [];
    
    // Group symbols by space/context
    const spaceGroups = new Map<string, DocumentSymbol[]>();
    
    for (const token of result.tokens) {
      let symbol: DocumentSymbol | null = null;
      
      switch (token.type) {
        case 'spaceTag':
        case 'spaceDirective':
          symbol = {
            name: token.text.replace(':', ''),
            kind: SymbolKind.Namespace,
            range: token.location.range,
            selectionRange: token.location.range,
            children: []
          };
          spaceGroups.set(symbol.name, []);
          symbols.push(symbol);
          break;
          
        case 'fieldTag':
          symbol = {
            name: token.text,
            kind: SymbolKind.Field,
            range: token.location.range,
            selectionRange: token.location.range,
          };
          
          // Add to appropriate space group
          if (token.spaceTag && spaceGroups.has(token.spaceTag)) {
            spaceGroups.get(token.spaceTag)!.push(symbol);
          } else {
            symbols.push(symbol);
          }
          break;
          
        case 'instructionTag':
          symbol = {
            name: token.text,
            kind: SymbolKind.Function,
            range: token.location.range,
            selectionRange: token.location.range,
          };
          
          if (token.spaceTag && spaceGroups.has(token.spaceTag)) {
            spaceGroups.get(token.spaceTag)!.push(symbol);
          } else {
            symbols.push(symbol);
          }
          break;
          
        case 'subfieldTag':
          symbol = {
            name: token.text,
            kind: SymbolKind.Property,
            range: token.location.range,
            selectionRange: token.location.range,
          };
          
          if (token.spaceTag && spaceGroups.has(token.spaceTag)) {
            spaceGroups.get(token.spaceTag)!.push(symbol);
          } else {
            symbols.push(symbol);
          }
          break;
      }
    }
    
    // Assign children to space symbols
    for (const spaceSymbol of symbols) {
      if (spaceSymbol.kind === SymbolKind.Namespace && spaceSymbol.children) {
        const children = spaceGroups.get(spaceSymbol.name);
        if (children) {
          spaceSymbol.children.push(...children);
        }
      }
    }
    
    return symbols;
  } catch (error) {
    connection.console.error(`Error generating document symbols: ${error}`);
    return [];
  }
});

// Folding range provider
connection.onFoldingRanges((params: FoldingRangeParams): FoldingRange[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  try {
    const text = document.getText();
    const lines = text.split('\n');
    const foldingRanges: FoldingRange[] = [];
    
    let inContext = false;
    let contextStartLine = -1;
    let braceDepth = 0;
    let parenDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() || '';
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }
      
      // Context directive (start of foldable region)
      if (line.startsWith(':') && !inContext) {
        inContext = true;
        contextStartLine = i;
      }
      
      // Count braces and parentheses
      for (const char of line) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;
      }
      
      // Multi-line brace blocks
      if (line.includes('{') && braceDepth === 1) {
        const braceStart = i;
        let braceEnd = -1;
        let tempDepth = braceDepth;
        
        // Find matching closing brace
        for (let j = i + 1; j < lines.length && tempDepth > 0; j++) {
          const nextLine = lines[j] || '';
          for (const char of nextLine) {
            if (char === '{') tempDepth++;
            if (char === '}') tempDepth--;
          }
          if (tempDepth === 0) {
            braceEnd = j;
            break;
          }
        }
        
        if (braceEnd > braceStart) {
          foldingRanges.push({
            startLine: braceStart,
            endLine: braceEnd,
            kind: FoldingRangeKind.Region
          });
        }
      }
      
      // Multi-line parentheses blocks
      if (line.includes('(') && parenDepth === 1) {
        const parenStart = i;
        let parenEnd = -1;
        let tempDepth = parenDepth;
        
        // Find matching closing parenthesis
        for (let j = i + 1; j < lines.length && tempDepth > 0; j++) {
          const nextLine = lines[j] || '';
          for (const char of nextLine) {
            if (char === '(') tempDepth++;
            if (char === ')') tempDepth--;
          }
          if (tempDepth === 0) {
            parenEnd = j;
            break;
          }
        }
        
        if (parenEnd > parenStart) {
          foldingRanges.push({
            startLine: parenStart,
            endLine: parenEnd,
            kind: FoldingRangeKind.Region
          });
        }
      }
      
      // End of context (another directive or end of file)
      if (inContext && (line.startsWith(':') && i > contextStartLine)) {
        foldingRanges.push({
          startLine: contextStartLine,
          endLine: i - 1,
          kind: FoldingRangeKind.Region
        });
        inContext = true;
        contextStartLine = i;
      }
    }
    
    // Handle final context if still open
    if (inContext && contextStartLine >= 0) {
      foldingRanges.push({
        startLine: contextStartLine,
        endLine: lines.length - 1,
        kind: FoldingRangeKind.Region
      });
    }
    
    return foldingRanges;
  } catch (error) {
    connection.console.error(`Error generating folding ranges: ${error}`);
    return [];
  }
});

// Custom request handlers
connection.onRequest('isa/refreshSpaceColors', (_params): any => {
  try {
    const symbolTable = analyzer.getSymbolTable();
    const spaceColors = symbolTable.getAllSpaceColors();
    
    // Convert to client format
    const colorAssignments = Array.from(spaceColors.entries()).map(([spaceTag, color]) => ({
      spaceTag,
      color,
      usageCount: symbolTable.getSpaceUsageCount(spaceTag),
      locations: [] // Would include actual locations in full implementation
    }));
    
    // Send notification to client
    connection.sendNotification('isa/spaceColorAssignment', colorAssignments);
    
    return { success: true, assignments: colorAssignments };
  } catch (error) {
    connection.console.error(`Error refreshing space colors: ${error}`);
    return { success: false, error: String(error) };
  }
});

connection.onRequest('isa/getSpaceTagLocations', (params): any => {
  try {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    const result = analyzer.analyzeFile(document);
    const spaceTagLocations = result.tokens
      .filter(token => token.type === 'spaceTag' || token.type === 'spaceDirective')
      .map(token => ({
        spaceTag: token.spaceTag || token.text.replace(':', ''),
        range: token.location.range
      }));

    return spaceTagLocations;
  } catch (error) {
    connection.console.error(`Error getting space tag locations: ${error}`);
    return [];
  }
});

// Helper functions
async function getDocumentSettings(resource: string): Promise<ISALanguageServerConfig> {
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'isaLanguage',
    }).then(config => {
      // Merge workspace config with initialization options and defaults
      const mergedConfig = {
        ...defaultSettings,
        ...initializationOptions,
        ...config
      };
      return mergedConfig;
    });
    connection.console.info(`Loading validationEnabled=${(await result).enableValidation ? 'enabled' : 'disabled'} for ${resource}`);
    documentSettings.set(resource, result);
  }
  return result;
}

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();

// Handle process signals
process.on('SIGTERM', () => {
  connection.console.info('ISA Language Server received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  connection.console.info('ISA Language Server received SIGINT, shutting down...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  connection.console.error(`Uncaught exception in ISA Language Server: ${error.message}`);
  connection.console.error(`Stack: ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  connection.console.error(`Unhandled rejection in ISA Language Server: ${reason}`);
  connection.console.error(`Promise: ${promise}`);
});

connection.console.info('ISA Language Server started successfully');
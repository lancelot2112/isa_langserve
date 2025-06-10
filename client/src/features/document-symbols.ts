/**
 * Document symbols provider for ISA language constructs
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

/**
 * Document symbol information from language server
 */
interface ISADocumentSymbol {
  name: string;
  detail?: string;
  kind: 'space' | 'field' | 'subfield' | 'instruction' | 'directive' | 'alias';
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  selectionRange: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  children?: ISADocumentSymbol[];
  spaceContext?: string;
  deprecated?: boolean;
}

export class ISADocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  private client: LanguageClient;

  constructor(client: LanguageClient) {
    this.client = client;
  }

  async provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.DocumentSymbol[] | vscode.SymbolInformation[]> {
    try {
      // Request document symbols from language server
      const symbols = await this.client.sendRequest<ISADocumentSymbol[]>(
        'textDocument/documentSymbol',
        {
          textDocument: { uri: document.uri.toString() }
        }
      );

      if (!symbols || !Array.isArray(symbols)) {
        return this.provideFallbackSymbols(document);
      }

      return symbols.map(symbol => this.convertToVSCodeSymbol(symbol));
    } catch (error) {
      console.error('Failed to get document symbols from server:', error);
      return this.provideFallbackSymbols(document);
    }
  }

  /**
   * Convert server symbol to VS Code document symbol
   */
  private convertToVSCodeSymbol(symbol: ISADocumentSymbol): vscode.DocumentSymbol {
    console.log(`Converting symbol: ${symbol.name} in ${symbol.spaceContext} (${symbol.kind}) at ${symbol.range.start.line}:${symbol.range.start.character} - ${symbol.range.end.line}:${symbol.range.end.character}`);
    const kind = this.getSymbolKind(symbol.kind);
    console.log(`Mapped kind: ${kind}`);
    const range = new vscode.Range(
      new vscode.Position(symbol.range.start.line, symbol.range.start.character),
      new vscode.Position(symbol.range.end.line, symbol.range.end.character)
    );
    const selectionRange = new vscode.Range(
      new vscode.Position(symbol.selectionRange.start.line, symbol.selectionRange.start.character),
      new vscode.Position(symbol.selectionRange.end.line, symbol.selectionRange.end.character)
    );

    const vsSymbol = new vscode.DocumentSymbol(
      symbol.name,
      symbol.detail || '',
      kind,
      range,
      selectionRange
    );

    // Add children if they exist
    if (symbol.children) {
      vsSymbol.children = symbol.children.map(child => this.convertToVSCodeSymbol(child));
    }

    return vsSymbol;
  }

  /**
   * Map ISA symbol kind to VS Code symbol kind
   */
  private getSymbolKind(kind: string): vscode.SymbolKind {
    switch (kind) {
      case 'space':
        return vscode.SymbolKind.Namespace;
      case 'field':
        return vscode.SymbolKind.Field;
      case 'subfield':
        return vscode.SymbolKind.Property;
      case 'instruction':
        return vscode.SymbolKind.Function;
      case 'directive':
        return vscode.SymbolKind.Key;
      case 'alias':
        return vscode.SymbolKind.Variable;
      default:
        return vscode.SymbolKind.Object;
    }
  }

  /**
   * Provide fallback symbols when server is unavailable
   */
  private provideFallbackSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const symbols: vscode.DocumentSymbol[] = [];
    const lines = document.getText().split('\n');
    
    let currentSpace: vscode.DocumentSymbol | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Parse directives
      if (trimmedLine.startsWith(':')) {
        const directiveMatch = trimmedLine.match(/^:(\w+)\s+(\w+)/);
        if (directiveMatch) {
          const [, directive, name] = directiveMatch;
          
          if (!directive || !name) continue;
          
          const range = new vscode.Range(i, 0, i, line.length);
          const nameIndex = line.indexOf(name);
          const selectionRange = new vscode.Range(
            i, 
            nameIndex >= 0 ? nameIndex : 0, 
            i, 
            nameIndex >= 0 ? nameIndex + name.length : name.length
          );

          if (directive === 'space') {
            // Create a new space symbol
            currentSpace = new vscode.DocumentSymbol(
              name,
              `Space: ${name}`,
              vscode.SymbolKind.Namespace,
              range,
              selectionRange
            );
            symbols.push(currentSpace);
          } else if (['reg', 'insn', 'bus'].includes(directive)) {
            // Create field symbols under current space
            const fieldSymbol = new vscode.DocumentSymbol(
              name,
              `${directive}: ${name}`,
              directive === 'insn' ? vscode.SymbolKind.Function : vscode.SymbolKind.Field,
              range,
              selectionRange
            );

            if (currentSpace) {
              currentSpace.children.push(fieldSymbol);
            } else {
              symbols.push(fieldSymbol);
            }
          }
        }
      }

      // Parse subfield definitions (simplified)
      const subfieldMatch = trimmedLine.match(/^(\w+)\s+@\(/);
      if (subfieldMatch && currentSpace && currentSpace.children.length > 0) {
        const [, name] = subfieldMatch;
        
        if (!name) continue;
        
        const range = new vscode.Range(i, 0, i, line.length);
        const nameIndex = line.indexOf(name);
        const selectionRange = new vscode.Range(
          i,
          nameIndex >= 0 ? nameIndex : 0,
          i,
          nameIndex >= 0 ? nameIndex + name.length : name.length
        );

        const subfieldSymbol = new vscode.DocumentSymbol(
          name,
          `Subfield: ${name}`,
          vscode.SymbolKind.Property,
          range,
          selectionRange
        );

        // Add to the last field in current space
        const lastField = currentSpace.children[currentSpace.children.length - 1];
        if (lastField) {
          lastField.children.push(subfieldSymbol);
        }
      }
    }

    return symbols;
  }

  /**
   * Register the document symbol provider
   */
  static register(client: LanguageClient): vscode.Disposable {
    const documentSelector: vscode.DocumentSelector = [
      { scheme: 'file', language: 'isa' },
      { scheme: 'file', language: 'isaext' },
      { scheme: 'file', language: 'coredef' },
      { scheme: 'file', language: 'sysdef' }
    ];

    const provider = new ISADocumentSymbolProvider(client);
    return vscode.languages.registerDocumentSymbolProvider(documentSelector, provider);
  }
}
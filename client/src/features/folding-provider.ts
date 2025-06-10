/**
 * Code folding provider for ISA language constructs
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

/**
 * Folding range information from language server
 */
interface ISAFoldingRange {
  startLine: number;
  endLine: number;
  kind: 'context' | 'subcontext' | 'comment' | 'space' | 'field' | 'instruction';
  contextType?: string;
  nestingLevel?: number;
}

export class ISAFoldingRangeProvider implements vscode.FoldingRangeProvider {
  private client: LanguageClient;

  constructor(client: LanguageClient) {
    this.client = client;
  }

  async provideFoldingRanges(
    document: vscode.TextDocument,
    _context: vscode.FoldingContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.FoldingRange[]> {
    try {
      // Request folding ranges from language server
      const foldingRanges = await this.client.sendRequest<ISAFoldingRange[]>(
        'textDocument/foldingRange',
        {
          textDocument: { uri: document.uri.toString() }
        }
      );

      if (!foldingRanges || !Array.isArray(foldingRanges)) {
        return this.provideFallbackFolding(document);
      }

      return foldingRanges.map(range => this.convertToVSCodeFoldingRange(range));
    } catch (error) {
      console.error('Failed to get folding ranges from server:', error);
      return this.provideFallbackFolding(document);
    }
  }

  /**
   * Convert server folding range to VS Code folding range
   */
  private convertToVSCodeFoldingRange(range: ISAFoldingRange): vscode.FoldingRange {
    let kind: vscode.FoldingRangeKind | undefined;

    switch (range.kind) {
      case 'comment':
        kind = vscode.FoldingRangeKind.Comment;
        break;
      case 'context':
      case 'subcontext':
      case 'space':
      case 'field':
      case 'instruction':
        kind = vscode.FoldingRangeKind.Region;
        break;
    }

    return new vscode.FoldingRange(range.startLine, range.endLine, kind);
  }

  /**
   * Provide fallback folding when server is unavailable
   */
  private provideFallbackFolding(document: vscode.TextDocument): vscode.FoldingRange[] {
    const ranges: vscode.FoldingRange[] = [];
    const lines = document.getText().split('\n');
    
    // Track context blocks
    const contextStack: { line: number; type: string }[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      if (!lineText) continue;
      
      const line = lineText.trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }

      // Detect context start (directives like :space, :reg, :insn)
      if (line.startsWith(':')) {
        // Close any previous context at the same level
        this.closeContextsAtLevel(ranges, contextStack, 0);
        
        contextStack.push({ line: i, type: 'directive' });
        continue;
      }

      // Detect subcontext start (opening braces)
      if (line.includes('{')) {
        contextStack.push({ line: i, type: 'brace' });
        continue;
      }

      // Detect subcontext end (closing braces)
      if (line.includes('}')) {
        const context = contextStack.pop();
        if (context?.type === 'brace') {
          ranges.push(new vscode.FoldingRange(
            context.line,
            i,
            vscode.FoldingRangeKind.Region
          ));
        }
        continue;
      }
    }

    // Close any remaining contexts
    this.closeContextsAtLevel(ranges, contextStack, -1);

    return ranges;
  }

  /**
   * Close contexts at or above the specified nesting level
   */
  private closeContextsAtLevel(
    ranges: vscode.FoldingRange[],
    contextStack: { line: number; type: string }[],
    level: number
  ): void {
    while (contextStack.length > level) {
      const context = contextStack.pop();
      if (context) {
        // Find the end line (next directive or end of document)
        const endLine = this.findContextEndLine(contextStack, context.line);
        if (endLine > context.line) {
          ranges.push(new vscode.FoldingRange(
            context.line,
            endLine,
            vscode.FoldingRangeKind.Region
          ));
        }
      }
    }
  }

  /**
   * Find the end line for a context
   */
  private findContextEndLine(
    _contextStack: { line: number; type: string }[],
    startLine: number
  ): number {
    // For now, assume context ends at the next directive or end of file
    // This is a simplified implementation - the server provides more accurate ranges
    return startLine + 1;
  }

  /**
   * Register the folding range provider
   */
  static register(client: LanguageClient): vscode.Disposable {
    const documentSelector: vscode.DocumentSelector = [
      { scheme: 'file', language: 'isa' },
      { scheme: 'file', language: 'isaext' },
      { scheme: 'file', language: 'coredef' },
      { scheme: 'file', language: 'sysdef' }
    ];

    const provider = new ISAFoldingRangeProvider(client);
    return vscode.languages.registerFoldingRangeProvider(documentSelector, provider);
  }
}
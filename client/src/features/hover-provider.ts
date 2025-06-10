/**
 * Hover information provider for ISA language constructs
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

/**
 * Hover information for ISA symbols
 */
interface ISAHoverInfo {
  symbolType: 'space' | 'field' | 'subfield' | 'instruction' | 'numeric' | 'bitfield';
  name: string;
  description?: string;
  size?: number;
  type?: string;
  endianness?: string;
  usageCount?: number;
  bitRange?: string;
  value?: string;
  formatConversions?: { [format: string]: string };
  contextInfo?: string;
}

export class ISAHoverProvider implements vscode.HoverProvider {
  private client: LanguageClient;

  constructor(client: LanguageClient) {
    this.client = client;
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    try {
      // Request hover information from language server
      const hoverInfo = await this.client.sendRequest<ISAHoverInfo>('textDocument/hover', {
        textDocument: { uri: document.uri.toString() },
        position: { line: position.line, character: position.character }
      });

      if (!hoverInfo) {
        return undefined;
      }

      const markdownContent = this.formatHoverContent(hoverInfo);
      if (!markdownContent) {
        return undefined;
      }

      return new vscode.Hover(
        new vscode.MarkdownString(markdownContent),
        this.getHoverRange(document, position, hoverInfo.name)
      );
    } catch (error) {
      console.error('Failed to get hover information:', error);
      return undefined;
    }
  }

  /**
   * Format hover content as markdown
   */
  private formatHoverContent(info: ISAHoverInfo): string | undefined {
    if (!info || !info.symbolType || !info.name) return undefined;

    const sections: string[] = [];

    // Title section
    sections.push(`**${info.symbolType.toUpperCase()}**: \`${info.name}\``);

    // Description
    if (info.description) {
      sections.push(`${info.description}`);
    }

    // Type-specific information
    switch (info.symbolType) {
      case 'space':
        sections.push(this.formatSpaceInfo(info));
        break;
      case 'field':
      case 'subfield':
        sections.push(this.formatFieldInfo(info));
        break;
      case 'instruction':
        sections.push(this.formatInstructionInfo(info));
        break;
      case 'numeric':
        sections.push(this.formatNumericInfo(info));
        break;
      case 'bitfield':
        sections.push(this.formatBitFieldInfo(info));
        break;
    }

    // Usage statistics
    if (info.usageCount !== undefined) {
      sections.push(`**Usage**: Referenced ${info.usageCount} time${info.usageCount !== 1 ? 's' : ''}`);
    }

    // Context information
    if (info.contextInfo) {
      sections.push(`**Context**: ${info.contextInfo}`);
    }

    return sections.filter(s => s.trim()).join('\n\n');
  }

  /**
   * Format space-specific information
   */
  private formatSpaceInfo(info: ISAHoverInfo): string {
    const details: string[] = [];
    
    if (info.size !== undefined) {
      details.push(`**Size**: ${info.size} bits`);
    }
    
    if (info.type) {
      details.push(`**Type**: ${info.type}`);
    }
    
    if (info.endianness) {
      details.push(`**Endianness**: ${info.endianness}`);
    }

    return details.join('\n');
  }

  /**
   * Format field-specific information
   */
  private formatFieldInfo(info: ISAHoverInfo): string {
    const details: string[] = [];
    
    if (info.size !== undefined) {
      details.push(`**Size**: ${info.size} bits`);
    }
    
    if (info.bitRange) {
      details.push(`**Bit Range**: ${info.bitRange}`);
    }
    
    if (info.type) {
      details.push(`**Type**: ${info.type}`);
    }

    return details.join('\n');
  }

  /**
   * Format instruction-specific information
   */
  private formatInstructionInfo(info: ISAHoverInfo): string {
    const details: string[] = [];
    
    if (info.size !== undefined) {
      details.push(`**Instruction Size**: ${info.size} bits`);
    }
    
    if (info.type) {
      details.push(`**Format**: ${info.type}`);
    }

    return details.join('\n');
  }

  /**
   * Format numeric literal information
   */
  private formatNumericInfo(info: ISAHoverInfo): string {
    const details: string[] = [];
    
    if (info.value) {
      details.push(`**Value**: ${info.value}`);
    }

    if (info.formatConversions) {
      details.push('**Conversions**:');
      for (const [format, value] of Object.entries(info.formatConversions)) {
        details.push(`- ${format}: \`${value}\``);
      }
    }

    return details.join('\n');
  }

  /**
   * Format bit field information
   */
  private formatBitFieldInfo(info: ISAHoverInfo): string {
    const details: string[] = [];
    
    if (info.bitRange) {
      details.push(`**Bit Specification**: ${info.bitRange}`);
    }
    
    if (info.size !== undefined) {
      details.push(`**Field Width**: ${info.size} bits`);
    }

    return details.join('\n');
  }

  /**
   * Get the range for the hover
   */
  private getHoverRange(
    document: vscode.TextDocument,
    position: vscode.Position,
    symbolName: string
  ): vscode.Range | undefined {
    if (!symbolName) {
      return document.getWordRangeAtPosition(position);
    }

    const line = document.lineAt(position.line);
    const text = line.text;
    
    // Find the symbol at the position
    const wordRange = document.getWordRangeAtPosition(position);
    if (wordRange) {
      return wordRange;
    }

    // Fallback: try to find the symbol name around the position
    const startIndex = Math.max(0, position.character - symbolName.length);
    const endIndex = Math.min(text.length, position.character + symbolName.length);
    const substring = text.substring(startIndex, endIndex);
    
    const symbolIndex = substring.indexOf(symbolName);
    if (symbolIndex !== -1) {
      const actualStart = startIndex + symbolIndex;
      const actualEnd = actualStart + symbolName.length;
      return new vscode.Range(
        new vscode.Position(position.line, actualStart),
        new vscode.Position(position.line, actualEnd)
      );
    }

    return undefined;
  }

  /**
   * Register the hover provider
   */
  static register(client: LanguageClient): vscode.Disposable {
    const documentSelector: vscode.DocumentSelector = [
      { scheme: 'file', language: 'isa' },
      { scheme: 'file', language: 'isaext' },
      { scheme: 'file', language: 'coredef' },
      { scheme: 'file', language: 'sysdef' }
    ];

    const provider = new ISAHoverProvider(client);
    return vscode.languages.registerHoverProvider(documentSelector, provider);
  }
}
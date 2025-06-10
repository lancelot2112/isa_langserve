/**
 * Semantic highlighting management for ISA language
 */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';

/**
 * Semantic token types matching the language server
 */
export enum SemanticTokenTypes {
  DIRECTIVE = 'directive',
  SPACE_DIRECTIVE = 'spaceDirective',
  SPACE_TAG = 'spaceTag',
  FIELD_TAG = 'fieldTag',
  SUBFIELD_TAG = 'subfieldTag',
  INSTRUCTION_TAG = 'instructionTag',
  SPACE_OPTION_TAG = 'spaceOptionTag',
  FIELD_OPTION_TAG = 'fieldOptionTag',
  BUS_OPTION_TAG = 'busOptionTag',
  SUBFIELD_OPTION_TAG = 'subfieldOptionTag',
  INSTRUCTION_OPTION_TAG = 'instructionOptionTag',
  RANGE_OPTION_TAG = 'rangeOptionTag',
  EQUALS_SIGN = 'equalsSign',
  NUMERIC_LITERAL = 'numericLiteral',
  BIT_FIELD = 'bitField',
  QUOTED_STRING = 'quotedString',
  SOURCE_OPERAND = 'sourceOperand',
  TARGET_OPERAND = 'targetOperand',
  FUNC_FIELD = 'funcField',
  IMM_FIELD = 'immField',
  FIELD_REFERENCE = 'fieldReference',
  UNDEFINED_REFERENCE = 'undefinedReference',
  ALIAS_REFERENCE = 'aliasReference',
  CONTEXT_BRACKET = 'contextBracket',
  COMMENT = 'comment'
}

/**
 * Semantic token modifiers
 */
export enum SemanticTokenModifiers {
  DECLARATION = 'declaration',
  DEFINITION = 'definition',
  READONLY = 'readonly',
  STATIC = 'static',
  DEPRECATED = 'deprecated',
  ABSTRACT = 'abstract',
  ASYNC = 'async',
  MODIFICATION = 'modification',
  DOCUMENTATION = 'documentation',
  DEFAULT_LIBRARY = 'defaultLibrary'
}

/**
 * Space color assignment from language server
 */
interface SpaceColorAssignment {
  spaceTag: string;
  color: string;
  usageCount: number;
  locations: vscode.Range[];
}

/**
 * Enhanced semantic token with space-specific information
 * (Currently unused but reserved for future enhancement)
 */
// interface EnhancedSemanticToken {
//   line: number;
//   char: number;
//   length: number;
//   tokenType: string;
//   tokenModifiers: string[];
//   spaceTag?: string;
//   contextInfo?: string;
// }

/**
 * Dynamic color scheme for space tags
 */
interface DynamicColorScheme {
  spaceColors: Map<string, string>;
  colorPalette: string[];
  nextColorIndex: number;
}

export class SemanticHighlighting {
  private client: LanguageClient;
  private legend: vscode.SemanticTokensLegend;
  private spaceColors: Map<string, string> = new Map();
  private disposables: vscode.Disposable[] = [];
  private colorScheme: DynamicColorScheme;
  private decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();

  constructor(client: LanguageClient) {
    this.client = client;
    this.legend = this.createSemanticTokensLegend();
    this.colorScheme = this.initializeColorScheme();
    this.registerSemanticTokensProvider();
    this.registerColorAssignmentHandler();
    this.registerDynamicColorHandler();
  }

  /**
   * Create semantic tokens legend
   */
  private createSemanticTokensLegend(): vscode.SemanticTokensLegend {
    const tokenTypes = Object.values(SemanticTokenTypes);
    const tokenModifiers = Object.values(SemanticTokenModifiers);
    
    console.log('Created semantic tokens legend with types:', tokenTypes);
    
    return new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
  }

  /**
   * Register semantic tokens provider
   */
  private registerSemanticTokensProvider(): void {
    const documentSelector: vscode.DocumentSelector = [
      { scheme: 'file', language: 'isa' },
      { scheme: 'file', language: 'isaext' },
      { scheme: 'file', language: 'coredef' },
      { scheme: 'file', language: 'sysdef' }
    ];

    const provider = vscode.languages.registerDocumentSemanticTokensProvider(
      documentSelector,
      {
        provideDocumentSemanticTokens: async (document: vscode.TextDocument): Promise<vscode.SemanticTokens> => {
          return this.provideSemanticTokens(document);
        }
      },
      this.legend
    );

    this.disposables.push(provider);
  }

  /**
   * Register handler for space color assignments from language server
   */
  private registerColorAssignmentHandler(): void {
    this.client.onNotification('isa/spaceColorAssignment', (params: SpaceColorAssignment[]) => {
      console.log('Received space color assignments:', params);
      
      // Update space color mappings
      for (const assignment of params) {
        this.spaceColors.set(assignment.spaceTag, assignment.color);
      }
      
      // Trigger semantic token refresh for all visible documents
      this.refreshVisibleDocuments();
    });
  }

  /**
   * Provide semantic tokens for a document
   */
  private async provideSemanticTokens(document: vscode.TextDocument): Promise<vscode.SemanticTokens> {
    try {
      // Request semantic tokens from language server
      const response = await this.client.sendRequest('textDocument/semanticTokens/full', {
        textDocument: { uri: document.uri.toString() }
      });

      if (response && typeof response === 'object' && 'data' in response) {
        const semanticTokens = response as { data: number[] };
        return new vscode.SemanticTokens(new Uint32Array(semanticTokens.data));
      }

      console.warn('Invalid semantic tokens response from server');
      return new vscode.SemanticTokens(new Uint32Array([]));
    } catch (error) {
      console.error('Failed to get semantic tokens:', error);
      return new vscode.SemanticTokens(new Uint32Array([]));
    }
  }

  /**
   * Refresh semantic tokens for all visible documents
   */
  private refreshVisibleDocuments(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const document = editor.document;
      if (this.isISADocument(document)) {
        // Trigger semantic token refresh
        vscode.commands.executeCommand('editor.action.semanticHighlighting.refresh');
      }
    }
  }

  /**
   * Check if document is an ISA document
   */
  private isISADocument(document: vscode.TextDocument): boolean {
    return ['isa', 'isaext', 'coredef', 'sysdef'].includes(document.languageId);
  }

  /**
   * Get space color for a space tag
   */
  getSpaceColor(spaceTag: string): string | undefined {
    return this.spaceColors.get(spaceTag);
  }

  /**
   * Get all space color assignments
   */
  getSpaceColors(): Map<string, string> {
    return new Map(this.spaceColors);
  }

  /**
   * Refresh semantic highlighting
   */
  async refresh(): Promise<void> {
    try {
      // Request fresh color assignments from server
      await this.client.sendRequest('isa/refreshSpaceColors', {});
      
      // Refresh all visible documents
      this.refreshVisibleDocuments();
      
      console.log('Semantic highlighting refreshed');
    } catch (error) {
      console.error('Failed to refresh semantic highlighting:', error);
      throw error;
    }
  }

  /**
   * Apply custom coloring for space tags
   */
  async applySpaceTagColoring(document: vscode.TextDocument): Promise<void> {
    try {
      // Get space tag locations from server
      const spaceTagLocations = await this.client.sendRequest('isa/getSpaceTagLocations', {
        textDocument: { uri: document.uri.toString() }
      });

      if (!spaceTagLocations || !Array.isArray(spaceTagLocations)) {
        return;
      }

      // Create decorations for each space tag
      const decorationTypes = new Map<string, vscode.TextEditorDecorationType>();
      
      for (const location of spaceTagLocations as any[]) {
        const spaceTag = location.spaceTag;
        const color = this.spaceColors.get(spaceTag);
        
        if (color && !decorationTypes.has(spaceTag)) {
          const decorationType = vscode.window.createTextEditorDecorationType({
            color: color,
            fontWeight: 'bold'
          });
          decorationTypes.set(spaceTag, decorationType);
        }
      }

      // Apply decorations to active editors
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document === document) {
          for (const [spaceTag, decorationType] of decorationTypes) {
            const ranges = (spaceTagLocations as any[])
              .filter(loc => loc.spaceTag === spaceTag)
              .map(loc => new vscode.Range(
                new vscode.Position(loc.range.start.line, loc.range.start.character),
                new vscode.Position(loc.range.end.line, loc.range.end.character)
              ));
            
            editor.setDecorations(decorationType, ranges);
          }
        }
      }
    } catch (error) {
      console.error('Failed to apply space tag coloring:', error);
    }
  }

  /**
   * Initialize the dynamic color scheme
   */
  private initializeColorScheme(): DynamicColorScheme {
    // HSL color palette for space tags (as specified in CLIENT-GUIDE.md)
    const colorPalette = [
      'hsl(200, 70%, 60%)',  // Blue
      'hsl(120, 70%, 60%)',  // Green  
      'hsl(300, 70%, 60%)',  // Purple
      'hsl(30, 70%, 60%)',   // Orange
      'hsl(60, 70%, 60%)',   // Yellow
      'hsl(0, 70%, 60%)',    // Red
      'hsl(180, 70%, 60%)',  // Cyan
      'hsl(270, 70%, 60%)',  // Violet
      'hsl(330, 70%, 60%)',  // Pink
      'hsl(150, 70%, 60%)'   // Mint
    ];

    return {
      spaceColors: new Map(),
      colorPalette,
      nextColorIndex: 0
    };
  }

  /**
   * Register handler for dynamic color updates
   */
  private registerDynamicColorHandler(): void {
    this.client.onNotification('isa/dynamicColorUpdate', (params: { 
      spaceTag: string; 
      color: string; 
      tokenPositions: Array<{ line: number; char: number; length: number }> 
    }) => {
      console.log('Received dynamic color update:', params);
      
      // Update color scheme
      this.colorScheme.spaceColors.set(params.spaceTag, params.color);
      
      // Apply decorations to visible editors
      this.applyDynamicColoring(params.spaceTag, params.color, params.tokenPositions);
    });
  }

  /**
   * Apply dynamic coloring to space tags
   */
  private applyDynamicColoring(
    spaceTag: string, 
    color: string, 
    positions: Array<{ line: number; char: number; length: number }>
  ): void {
    // Create or update decoration type for this space tag
    const decorationKey = `spaceTag.${spaceTag}`;
    
    // Dispose old decoration type if it exists
    const oldDecorationType = this.decorationTypes.get(decorationKey);
    if (oldDecorationType) {
      oldDecorationType.dispose();
    }

    // Create new decoration type
    const decorationType = vscode.window.createTextEditorDecorationType({
      color: color,
      fontWeight: 'bold'
    });
    
    this.decorationTypes.set(decorationKey, decorationType);

    // Apply to all visible editors
    for (const editor of vscode.window.visibleTextEditors) {
      if (this.isISADocument(editor.document)) {
        const ranges = positions.map(pos => new vscode.Range(
          new vscode.Position(pos.line, pos.char),
          new vscode.Position(pos.line, pos.char + pos.length)
        ));
        
        editor.setDecorations(decorationType, ranges);
      }
    }
  }

  /**
   * Get next available color for a space tag
   */
  public getNextSpaceColor(spaceTag: string): string {
    // Check if color already assigned
    const existingColor = this.colorScheme.spaceColors.get(spaceTag);
    if (existingColor) {
      return existingColor;
    }

    // Assign next color from palette
    const color = this.colorScheme.colorPalette[this.colorScheme.nextColorIndex];
    if (!color) {
      return 'hsl(0, 70%, 60%)'; // Default color if palette exhausted
    }
    
    this.colorScheme.nextColorIndex = 
      (this.colorScheme.nextColorIndex + 1) % this.colorScheme.colorPalette.length;
    
    this.colorScheme.spaceColors.set(spaceTag, color);
    return color;
  }

  /**
   * Request space color refresh from server
   */
  async requestSpaceColorRefresh(): Promise<void> {
    try {
      await this.client.sendRequest('isa/refreshSpaceColors', {});
      console.log('Requested space color refresh from server');
    } catch (error) {
      console.error('Failed to request space color refresh:', error);
    }
  }

  /**
   * Get all assigned space colors
   */
  getAllSpaceColors(): Map<string, string> {
    return new Map(this.colorScheme.spaceColors);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
    
    // Dispose decoration types
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.decorationTypes.clear();
    
    this.spaceColors.clear();
    this.colorScheme.spaceColors.clear();
  }
}
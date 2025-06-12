/**
 * Symbol table management for ISA language
 */

import { Range } from 'vscode-languageserver';
import { Symbol, SymbolTable, ParseNode, SpaceNode, FieldNode, InstructionNode, BusNode } from '../parser/types';

export class ISASymbolTable implements SymbolTable {
  symbols: Map<string, Symbol> = new Map();
  scopes: Map<string, Set<string>> = new Map();
  
  // File-specific symbol tracking
  private fileSymbols: Map<string, Set<string>> = new Map();
  
  // Space tag color assignment
  private spaceColors: Map<string, string> = new Map();
  private colorIndex: number = 0;
  
  // Default color palette for space tags (HSL colors for good contrast)
  private readonly defaultColors = [
    'hsl(200, 60%, 60%)', // Blue
    'hsl(120, 60%, 60%)', // Green  
    'hsl(300, 60%, 60%)', // Purple
    'hsl(30, 60%, 60%)',  // Orange
    'hsl(180, 60%, 60%)', // Cyan
    'hsl(270, 60%, 60%)', // Violet
    'hsl(60, 60%, 60%)',  // Yellow
    'hsl(0, 60%, 60%)',   // Red
    'hsl(150, 60%, 60%)', // Teal
    'hsl(330, 60%, 60%)', // Pink
  ];

  /**
   * Clear all symbols for a specific file
   */
  clearFileSymbols(fileUri: string): void {
    const fileSymbolKeys = this.fileSymbols.get(fileUri);
    if (fileSymbolKeys) {
      for (const key of fileSymbolKeys) {
        this.symbols.delete(key);
      }
      this.fileSymbols.delete(fileUri);
    }
    
    // Clean up empty scopes
    for (const [spaceTag, fieldSet] of this.scopes.entries()) {
      if (fieldSet.size === 0) {
        this.scopes.delete(spaceTag);
      }
    }
  }

  /**
   * Add a symbol to the table
   */
  addSymbol(symbol: Symbol): void {
    const key = this.createSymbolKey(symbol);
    this.symbols.set(key, symbol);
    
    // Track file association
    if (!this.fileSymbols.has(symbol.fileUri)) {
      this.fileSymbols.set(symbol.fileUri, new Set());
    }
    this.fileSymbols.get(symbol.fileUri)!.add(key);
    
    // Add to appropriate scope
    if (symbol.type === 'space') {
      this.ensureScope(symbol.name);
      this.assignSpaceColor(symbol.name);
    } else if (symbol.spaceTag) {
      this.ensureScope(symbol.spaceTag);
      this.scopes.get(symbol.spaceTag)!.add(symbol.name);
    }
  }

  /**
   * Find a symbol by name and optional scope
   */
  findSymbol(name: string, spaceTag?: string): Symbol | undefined {
    if (spaceTag) {
      const scopedKey = `${spaceTag}.${name}`;
      const symbol = this.symbols.get(scopedKey);
      if (symbol) return symbol;
    }
    
    // Try global lookup
    return this.symbols.get(name);
  }

  /**
   * Get all symbols in a scope
   */
  getSymbolsInScope(spaceTag: string): Symbol[] {
    const fieldNames = this.scopes.get(spaceTag);
    if (!fieldNames) return [];
    
    const symbols: Symbol[] = [];
    for (const fieldName of fieldNames) {
      const symbol = this.symbols.get(`${spaceTag}.${fieldName}`);
      if (symbol) {
        symbols.push(symbol);
      }
    }
    
    return symbols;
  }

  /**
   * Get all space tags
   */
  getSpaceTags(): string[] {
    return Array.from(this.scopes.keys());
  }

  /**
   * Get color assigned to a space tag
   */
  getSpaceColor(spaceTag: string): string | undefined {
    return this.spaceColors.get(spaceTag);
  }

  /**
   * Get all space color assignments
   */
  getAllSpaceColors(): Map<string, string> {
    return new Map(this.spaceColors);
  }

  /**
   * Get usage count for a space tag
   */
  getSpaceUsageCount(spaceTag: string): number {
    const fieldsInScope = this.scopes.get(spaceTag);
    return fieldsInScope ? fieldsInScope.size : 0;
  }

  /**
   * Assign a custom color to a space tag
   */
  setSpaceColor(spaceTag: string, color: string): void {
    this.spaceColors.set(spaceTag, color);
  }

  /**
   * Check if a symbol exists
   */
  hasSymbol(name: string, spaceTag?: string): boolean {
    return this.findSymbol(name, spaceTag) !== undefined;
  }

  /**
   * Check if a space is defined
   */
  hasSpace(spaceTag: string): boolean {
    return this.scopes.has(spaceTag);
  }

  /**
   * Validate space indirection reference ($space->field.subfield)
   */
  validateSpaceIndirection(spaceTag: string, fieldPath: string): { isValid: boolean; error?: string } {
    // Check if the space exists
    if (!this.hasSpace(spaceTag)) {
      return { isValid: false, error: `Undefined space '${spaceTag}'` };
    }

    // Parse the field path (field.subfield)
    const [fieldName, subfieldName] = fieldPath.split('.');
    
    if (!fieldName) {
      return { isValid: false, error: 'Field name is required in space indirection' };
    }

    // Check if the field exists in the space
    const field = this.findSymbol(fieldName, spaceTag);
    if (!field) {
      return { isValid: false, error: `Field '${fieldName}' not found in space '${spaceTag}'` };
    }

    // If a subfield is specified, check if it exists
    if (subfieldName) {
      const subfield = this.findSymbol(subfieldName, spaceTag);
      if (!subfield || subfield.type !== 'subfield') {
        return { isValid: false, error: `Subfield '${subfieldName}' not found in field '${fieldName}' of space '${spaceTag}'` };
      }
    }

    return { isValid: true };
  }

  /**
   * Get all symbols of a specific type
   */
  getSymbolsByType(type: Symbol['type']): Symbol[] {
    return Array.from(this.symbols.values()).filter(symbol => symbol.type === type);
  }

  /**
   * Find symbols by location (for hover, go-to-definition)
   */
  findSymbolAtPosition(fileUri: string, line: number, character: number): Symbol | undefined {
    const fileSymbolKeys = this.fileSymbols.get(fileUri);
    if (!fileSymbolKeys) return undefined;
    
    for (const key of fileSymbolKeys) {
      const symbol = this.symbols.get(key);
      if (symbol && this.isPositionInRange(symbol.location.range, line, character)) {
        return symbol;
      }
    }
    
    return undefined;
  }

  /**
   * Find all references to a symbol
   */
  findReferences(symbolName: string, spaceTag?: string): Symbol[] {
    const references: Symbol[] = [];
    
    for (const symbol of this.symbols.values()) {
      // Check if this symbol references the target symbol
      if (this.symbolReferences(symbol, symbolName, spaceTag)) {
        references.push(symbol);
      }
    }
    
    return references;
  }

  /**
   * Build symbol table from AST nodes
   */
  buildFromAST(nodes: ParseNode[], fileUri: string): void {
    this.clearFileSymbols(fileUri);
    
    for (const node of nodes) {
      this.processNode(node, fileUri);
    }
  }

  private processNode(node: ParseNode, fileUri: string): void {
    switch (node.type) {
      case 'space':
        this.processSpaceNode(node as SpaceNode, fileUri);
        break;
      case 'field':
        this.processFieldNode(node as FieldNode, fileUri);
        break;
      case 'instruction':
        this.processInstructionNode(node as InstructionNode, fileUri);
        break;
      case 'bus':
        this.processBusNode(node as BusNode, fileUri);
        break;
    }
  }

  private processSpaceNode(node: SpaceNode, fileUri: string): void {
    const symbol: Symbol = {
      name: node.tag,
      type: 'space',
      location: node.location,
      fileUri,
      definition: node,
    };
    
    this.addSymbol(symbol);
  }

  private processFieldNode(node: FieldNode, fileUri: string): void {
    if (!node.fieldTag) return; // Skip untagged field definitions
    
    const symbol: Symbol = {
      name: node.fieldTag,
      type: 'field',
      location: node.location,
      fileUri,
      spaceTag: node.spaceTag,
      definition: node,
    };
    
    this.addSymbol(symbol);
    
    // If this field has a count > 1 and a name pattern, create the individual field symbols
    if (node.count && node.count > 1 && node.name && node.name.includes('%d')) {
      for (let i = 0; i < node.count; i++) {
        // Strip quotes from the name pattern if present
        const namePattern = node.name.replace(/^["']|["']$/g, '');
        const fieldName = namePattern.replace('%d', i.toString());
        const arrayFieldSymbol: Symbol = {
          name: fieldName,
          type: 'field',
          location: node.location,
          fileUri,
          spaceTag: node.spaceTag,
          definition: node, // Point to the original array definition
        };
        
        this.addSymbol(arrayFieldSymbol);
      }
    }
    
    // Process subfields
    for (const subfield of node.subfields) {
      const subfieldSymbol: Symbol = {
        name: subfield.tag,
        type: 'subfield',
        location: subfield.location,
        fileUri,
        spaceTag: node.spaceTag,
        definition: subfield,
      };
      
      this.addSymbol(subfieldSymbol);
    }
  }

  private processInstructionNode(node: InstructionNode, fileUri: string): void {
    const symbol: Symbol = {
      name: node.tag,
      type: 'instruction',
      location: node.location,
      fileUri,
      spaceTag: node.spaceTag,
      definition: node,
    };
    
    this.addSymbol(symbol);
  }

  private processBusNode(node: BusNode, fileUri: string): void {
    const symbol: Symbol = {
      name: node.tag,
      type: 'bus',
      location: node.location,
      fileUri,
      definition: node,
    };
    
    this.addSymbol(symbol);
  }

  private createSymbolKey(symbol: Symbol): string {
    if (symbol.spaceTag) {
      return `${symbol.spaceTag}.${symbol.name}`;
    }
    return symbol.name;
  }

  private ensureScope(spaceTag: string): void {
    if (!this.scopes.has(spaceTag)) {
      this.scopes.set(spaceTag, new Set());
    }
  }

  private assignSpaceColor(spaceTag: string): void {
    if (!this.spaceColors.has(spaceTag)) {
      const color = this.defaultColors[this.colorIndex % this.defaultColors.length];
      if (color) {
        this.spaceColors.set(spaceTag, color);
        this.colorIndex++;
      }
    }
  }

  private isPositionInRange(range: Range, line: number, character: number): boolean {
    if (line < range.start.line || line > range.end.line) {
      return false;
    }
    
    if (line === range.start.line && character < range.start.character) {
      return false;
    }
    
    if (line === range.end.line && character > range.end.character) {
      return false;
    }
    
    return true;
  }

  private symbolReferences(symbol: Symbol, targetName: string, _targetSpaceTag?: string): boolean {
    // This is a simplified implementation
    // In a full implementation, we would analyze the symbol's definition
    // to check for references to other symbols
    
    if (symbol.type === 'field' && symbol.definition) {
      const fieldNode = symbol.definition as FieldNode;
      
      // Check alias references
      if (fieldNode.alias) {
        const [aliasName] = fieldNode.alias.split('.');
        if (aliasName === targetName) {
          return true;
        }
      }
      
      // Check subfield operation references
      for (const subfield of fieldNode.subfields) {
        for (const operation of subfield.operations) {
          if (operation.includes(targetName)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Find a subfield within a specific parent field
   * Returns true if the subfield exists as a child of the specified parent field
   */
  findSubfieldInField(parentFieldName: string, subfieldName: string, spaceTag: string): boolean {
    // Find the parent field symbol first
    const parentField = this.findSymbol(parentFieldName, spaceTag);
    
    if (!parentField || parentField.type !== 'field') {
      return false;
    }

    // Get the field definition from the symbol - ensure it's a FieldNode
    const fieldDefinition = parentField.definition as FieldNode;
    
    if (!fieldDefinition || !fieldDefinition.subfields) {
      return false;
    }

    // Check if the subfield exists in the parent field's subfields
    return fieldDefinition.subfields.some((subfield) => subfield.tag === subfieldName);
  }
}
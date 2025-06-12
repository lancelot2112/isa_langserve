/**
 * Semantic analyzer for ISA language files
 * Handles cross-file analysis and dependency resolution
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { 
  ParseNode, 
  FileContext, 
  ValidationError, 
  FieldNode, 
  InstructionNode,
  SpaceNode,
  Token,
  TokenType,
  SourceLocation
} from '../parser/types';
import { ISASymbolTable } from './symbol-table';
import { ISATokenizer } from '../parser/tokenizer';
import { BitFieldParser } from '../parser/bit-field-parser';

export interface AnalysisResult {
  symbols: ISASymbolTable;
  errors: ValidationError[];
  tokens: Token[];
  dependencies: string[]; // Files that this file depends on
}

export class SemanticAnalyzer {
  private symbolTable: ISASymbolTable = new ISASymbolTable();
  private fileContexts: Map<string, FileContext> = new Map();
  
  /**
   * Analyze a single file
   */
  analyzeFile(document: TextDocument): AnalysisResult {
    const uri = document.uri;
    const content = document.getText();
    
    // Tokenize the content
    const tokenizer = new ISATokenizer(content, {
      enableSemanticTokens: true,
      spaceTagColors: {},
    });
    const tokens = tokenizer.tokenize();
    
    // Parse AST (simplified - would use tree-sitter in full implementation)
    const ast = this.parseAST(content, uri);
    
    // Update file context
    const context: FileContext = {
      uri,
      content,
      ast,
      tokens,
      lastModified: Date.now(),
      errors: [],
    };
    this.fileContexts.set(uri, context);
    
    // Build symbol table
    this.symbolTable.buildFromAST(ast, uri);
    
    // Validate semantics
    const errors = this.validateSemantics(ast, uri);
    context.errors = errors;
    
    // Find dependencies
    const dependencies = this.extractDependencies(ast);
    
    // Enhance tokens with semantic information
    const enhancedTokens = this.enhanceTokens(tokens, uri);
    
    return {
      symbols: this.symbolTable,
      errors,
      tokens: enhancedTokens,
      dependencies,
    };
  }

  /**
   * Analyze multiple files with dependency resolution
   */
  analyzeProject(documents: TextDocument[]): Map<string, AnalysisResult> {
    const results = new Map<string, AnalysisResult>();
    
    // First pass: analyze each file individually
    for (const document of documents) {
      const result = this.analyzeFile(document);
      results.set(document.uri, result);
    }
    
    // Second pass: cross-file validation
    for (const [uri, result] of results) {
      const crossFileErrors = this.validateCrossFileReferences(uri, result.dependencies);
      result.errors.push(...crossFileErrors);
    }
    
    return results;
  }

  /**
   * Get symbol table
   */
  getSymbolTable(): ISASymbolTable {
    return this.symbolTable;
  }

  /**
   * Get file context
   */
  getFileContext(uri: string): FileContext | undefined {
    return this.fileContexts.get(uri);
  }

  private parseAST(content: string, uri: string): ParseNode[] {
    // Simplified AST parsing - in full implementation would use tree-sitter
    const nodes: ParseNode[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line || line.startsWith('#')) continue;
      
      // Handle multi-line structures like subfields={}
      if (line.includes('subfields={') && !line.includes('}')) {
        // Collect multi-line subfields definition
        let fullContent = line;
        let j = i + 1;
        while (j < lines.length && !lines[j]?.includes('}')) {
          if (lines[j]?.trim()) {
            fullContent += ' ' + lines[j]?.trim();
          }
          j++;
        }
        if (j < lines.length && lines[j]?.includes('}')) {
          fullContent += ' ' + lines[j]?.trim();
          i = j; // Skip the processed lines
        }
        
        const node = this.parseLine(fullContent, i, uri);
        if (node) {
          nodes.push(node);
        }
      } else {
        // Parse the current line
        const node = this.parseLine(line, i, uri);
        if (node) {
          // Check if this is a field/instruction definition that might be followed by subfields
          if ((node.type === 'field' || node.type === 'instruction') && i + 1 < lines.length) {
            const nextLineIndex = this.findNextNonEmptyLine(lines, i + 1);
            if (nextLineIndex !== -1) {
              const nextLine = lines[nextLineIndex]?.trim();
              // Check if the next non-empty line starts with 'subfields={'
              if (nextLine === 'subfields={' || (nextLine && nextLine.startsWith('subfields={') && !nextLine.includes('}'))) {
                // Found standalone subfields block - collect it
                let subfieldContent = nextLine;
                let j = nextLineIndex + 1;
                
                // If the subfields line doesn't end with }, collect the multi-line block
                if (!nextLine.includes('}')) {
                  while (j < lines.length && !lines[j]?.includes('}')) {
                    if (lines[j]?.trim()) {
                      subfieldContent += ' ' + lines[j]?.trim();
                    }
                    j++;
                  }
                  if (j < lines.length && lines[j]?.includes('}')) {
                    subfieldContent += ' ' + lines[j]?.trim();
                  }
                }
                
                // Parse the subfields and attach them to the node
                if (node.type === 'field') {
                  const fieldNode = node as FieldNode;
                  fieldNode.subfields = this.parseSubfields(subfieldContent);
                  // Update the text to include the subfields
                  fieldNode.text = line + '\n' + subfieldContent;
                } else if (node.type === 'instruction') {
                  // For instructions, subfields are handled differently but similar logic applies
                  const instructionNode = node as InstructionNode;
                  instructionNode.text = line + '\n' + subfieldContent;
                }
                
                // Skip the processed subfields lines
                i = j;
              }
            }
          }
          
          nodes.push(node);
        }
      }
    }
    
    return nodes;
  }
  
  private findNextNonEmptyLine(lines: string[], startIndex: number): number {
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (line && !line.startsWith('#')) {
        return i;
      }
    }
    return -1;
  }

  private parseLine(line: string, lineNumber: number, _uri: string): ParseNode | null {
    // Simplified line parsing
    if (line.startsWith(':space ')) {
      return this.parseSpaceLine(line, lineNumber);
    } else if (line.startsWith(':param ')) {
      return this.parseParamLine(line, lineNumber);
    } else if (line.startsWith(':') && line.includes(' ')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2 && parts[0] && !['param', 'space', 'bus', 'include', 'attach'].includes(parts[0].slice(1))) {
        return this.parseFieldOrInstructionLine(line, lineNumber);
      }
    }
    
    return null;
  }

  private parseParamLine(line: string, lineNumber: number): any {
    // Parse: :param KEY=VALUE
    const content = line.substring(7).trim(); // Remove ':param '
    const parameters: Record<string, string> = {};
    
    // Check if it has valid KEY=VALUE format
    if (content.includes('=')) {
      const [key, value] = content.split('=', 2);
      if (key && value) {
        parameters[key.trim()] = value.trim();
      }
    }
    
    return {
      type: 'directive',
      directiveType: 'param',
      parameters,
      location: {
        start: { line: lineNumber, character: 0 },
        end: { line: lineNumber, character: line.length },
        range: {
          start: { line: lineNumber, character: 0 },
          end: { line: lineNumber, character: line.length },
        },
      },
      text: line,
    };
  }

  private parseSpaceLine(line: string, lineNumber: number): SpaceNode | null {
    // Parse: :space <tag> addr=<bits> word=<bits> type=<type> [options...]
    const parts = line.split(/\s+/);
    if (parts.length < 4) return null;
    
    const tag = parts[1];
    const options: Record<string, string> = {};
    
    for (let i = 2; i < parts.length; i++) {
      const part = parts[i];
      if (part && part.includes('=')) {
        const [key, value] = part.split('=', 2);
        if (key && value) {
          options[key] = value;
        }
      }
    }
    
    // Parse addr - handle invalid values
    let addr = 0;
    if (options.addr) {
      const parsedAddr = parseInt(options.addr);
      if (isNaN(parsedAddr)) {
        // Keep the invalid value to trigger validation error
        addr = NaN;
      } else {
        addr = parsedAddr;
      }
    }
    
    // Parse word - handle invalid values  
    let word = 32; // default
    if (options.word) {
      const parsedWord = parseInt(options.word);
      if (isNaN(parsedWord)) {
        word = NaN;
      } else {
        word = parsedWord;
      }
    }
    
    const spaceType = options.type as 'rw' | 'ro' | 'memio' | 'register' || 'rw';
    
    if (!tag) return null;
    
    return {
      type: 'space',
      tag,
      addr,
      word,
      spaceType,
      align: options.align ? parseInt(options.align) : undefined,
      endian: options.endian as 'big' | 'little' || undefined,
      location: {
        start: { line: lineNumber, character: 0 },
        end: { line: lineNumber, character: line.length },
        range: {
          start: { line: lineNumber, character: 0 },
          end: { line: lineNumber, character: line.length },
        },
      },
      text: line,
    };
  }

  private parseFieldOrInstructionLine(line: string, lineNumber: number): FieldNode | InstructionNode | null {
    // Parse: :<space_tag> <field_tag> [options...] or :<space_tag> <instruction_tag> (operands) [options...]
    const match = line.match(/^:(\w+)\s+(\w+)(.*)$/);
    if (!match) return null;
    
    const spaceTag = match[1];
    const tag = match[2];
    const rest = match[3]?.trim() || '';
    
    const location = {
      start: { line: lineNumber, character: 0 },
      end: { line: lineNumber, character: line.length },
      range: {
        start: { line: lineNumber, character: 0 },
        end: { line: lineNumber, character: line.length },
      },
    };
    
    // Check if this is an instruction (has operand list)
    if (rest.startsWith('(')) {
      const operandMatch = rest.match(/^\(([^)]*)\)/);
      const operands = operandMatch ? operandMatch[1]?.split(',').map(s => s.trim()) || [] : [];
      
      if (!spaceTag || !tag) return null;
      
      return {
        type: 'instruction',
        spaceTag,
        tag,
        operands,
        mask: {}, // Would parse mask from rest of line
        location,
        text: line,
      };
    } else {
      // This is a field - parse options
      if (!spaceTag || !tag) return null;
      
      const fieldNode: FieldNode = {
        type: 'field',
        spaceTag,
        fieldTag: tag,
        subfields: [], // Parse subfields if present
        location,
        text: line,
      };
      
      // Parse field options from rest of line
      const options = this.parseFieldOptions(rest);
      if (options.redirect) {
        fieldNode.alias = options.redirect;
      }
      if (options.count !== undefined) {
        fieldNode.count = options.count;
      }
      if (options.name) {
        fieldNode.name = options.name;
      }
      
      // Parse subfields if present
      if (rest.includes('subfields={')) {
        fieldNode.subfields = this.parseSubfields(rest);
      }
      
      return fieldNode;
    }
  }
  
  private parseFieldOptions(optionsStr: string): {
    redirect?: string;
    count?: number;
    name?: string;
    [key: string]: any;
  } {
    const options: any = {};
    
    // Simple option parsing (would be more robust in full implementation)
    const optionMatches = optionsStr.match(/(\w+)=([^\s]+)/g);
    if (optionMatches) {
      for (const match of optionMatches) {
        const [key, value] = match.split('=');
        if (key && value) {
          if (key === 'count') {
            options.count = parseInt(value);
          } else {
            options[key] = value;
          }
        }
      }
    }
    
    return options;
  }
  
  private parseSubfields(content: string): any[] {
    const subfields: any[] = [];
    
    // Extract content between subfields={ and }
    const match = content.match(/subfields=\{([^}]*)\}/);
    if (!match || !match[1]) return subfields;
    
    const subfieldContent = match[1].trim();
    const lines = subfieldContent.split(/\s+(?=\w+\s+@)/); // Split on subfield definitions
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Parse subfield: name[?postfix] @(bits) [options]
      const subfieldMatch = trimmed.match(/^(\w+)(\?\w+)?\s+@\(([^)]+)\)(.*)$/);
      if (subfieldMatch) {
        const [, baseTag, postfix, bitField] = subfieldMatch;
        if (baseTag && bitField) {
          const location = this.ensureValidRange({
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 1 },
            },
          });
          subfields.push({
            tag: baseTag, // Use base name without postfix for symbol resolution
            postfix: postfix || undefined, // Store postfix separately if present
            bitField: {
              text: `@(${bitField})`,
              location
            },
            operations: [],
            location
          });
        }
      }
    }
    
    return subfields;
  }

  private validateSemantics(ast: ParseNode[], _uri: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const node of ast) {
      switch (node.type) {
        case 'space':
          errors.push(...this.validateSpaceNode(node as SpaceNode));
          break;
        case 'field':
          errors.push(...this.validateFieldNode(node as FieldNode));
          break;
        case 'instruction':
          errors.push(...this.validateInstructionNode(node as InstructionNode));
          break;
        case 'directive':
          errors.push(...this.validateDirectiveNode(node as any));
          break;
      }
    }
    
    // Also validate tokens for invalid numeric literals
    const context = this.fileContexts.get(_uri);
    if (context && context.tokens) {
      errors.push(...this.validateTokens(context.tokens));
    }
    
    // Additional content-based validation for specific patterns
    errors.push(...this.validateContentPatterns(context?.content || '', _uri));
    
    return errors;
  }
  
  private validateContentPatterns(content: string, _uri: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const lines = content.split('\n');
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum] || '';
      
      // Check for binary literal with excess bits in mask assignments
      // Pattern: fieldname=0b... where the binary has more bits than the field definition
      const maskMatch = line.match(/(\w+)=(0b[01]+)/g);
      if (maskMatch) {
        for (const match of maskMatch) {
          const [fieldAssignment] = match.split('=');
          const binaryLiteral = match.split('=')[1];
          
          if (fieldAssignment && binaryLiteral && binaryLiteral.startsWith('0b')) {
            // Find the field definition to check bit size
            const fieldSize = this.findFieldSizeInContent(fieldAssignment, content);
            const binaryBits = binaryLiteral.slice(2).length;
            
            if (fieldSize && binaryBits > fieldSize) {
              const startChar = line.indexOf(binaryLiteral);
              const endChar = startChar + binaryLiteral.length;
              const location = {
                start: { line: lineNum, character: startChar },
                end: { line: lineNum, character: endChar },
                range: {
                  start: { line: lineNum, character: startChar },
                  end: { line: lineNum, character: endChar },
                },
              };
              errors.push({
                message: `Binary literal '${binaryLiteral}' has more bits defined than the field size (${fieldSize} bits)`,
                location: this.ensureValidRange(location),
                severity: 'warning',
                code: 'excess-bits-warning',
              });
            }
          }
        }
      }
      
      // Check for invalid field/subfield identifiers
      // Pattern: identifier @(...) in subfields or field definitions
      // Exclude assignment expressions like OE=0 @(...)
      const identifierMatches = line.matchAll(/(\S+)\s+@\(/g);
      for (const match of identifierMatches) {
        const identifier = match[1];
        if (identifier && !identifier.includes('=') && !this.isValidIdentifier(identifier)) {
          const startChar = match.index || 0;
          const endChar = startChar + identifier.length;
          const location = {
            start: { line: lineNum, character: startChar },
            end: { line: lineNum, character: endChar },
            range: {
              start: { line: lineNum, character: startChar },
              end: { line: lineNum, character: endChar },
            },
          };
          errors.push({
            message: `Invalid identifier: '${identifier}'. Identifiers can only contain letters, numbers, hyphens, underscores, and periods.`,
            location: this.ensureValidRange(location),
            severity: 'error',
            code: 'invalid-identifier',
          });
        }
      }
    }
    
    return errors;
  }
  
  private findFieldSizeInContent(fieldName: string, content: string): number | null {
    // Look for field definition: fieldName @(start-end) or @(bit)
    const fieldPattern = new RegExp(`${fieldName}\\s+@\\((\\d+)(?:-(\\d+))?\\)`, 'g');
    const match = fieldPattern.exec(content);
    
    if (match) {
      const start = parseInt(match[1] || '0');
      const end = match[2] ? parseInt(match[2]) : start;
      return Math.abs(end - start) + 1;
    }
    
    return null;
  }

  private validateTokens(tokens: Token[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // First, process context reference chains (field;subfield patterns)
    errors.push(...this.validateContextReferences(tokens));
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;
      
      // Check for invalid numeric literals marked during tokenization
      if (token.type === TokenType.UNDEFINED_REFERENCE && this.looksLikeInvalidNumeric(token.text)) {
        errors.push({
          message: `Invalid numeric literal: '${token.text}'`,
          location: this.ensureValidRange(token.location),
          severity: 'error',
          code: 'invalid-numeric-literal',
        });
      }
      
      // Check for undefined field references (but skip those that are part of context chains)
      if (token.type === TokenType.FIELD_REFERENCE) {
        // Skip if this is part of a context reference chain
        if (this.isPartOfContextChain(tokens, i)) {
          continue;
        }
        
        // Check if this field reference is valid in the current context
        // Skip very short tokens and common keywords to reduce false positives
        if (token.text.length >= 2 && !this.isCommonKeyword(token.text)) {
          // Reject old field.subfield notation - breaking change
          if (token.text.includes('.')) {
            const [fieldName, subfieldName] = token.text.split('.');
            if (fieldName && subfieldName && token.spaceTag) {
              errors.push({
                message: `Invalid syntax: '${token.text}'. Use context operator syntax: '${fieldName};${subfieldName}'`,
                location: this.ensureValidRange(token.location),
                severity: 'error',
                code: 'invalid-syntax',
              });
            }
          } else {
            // Handle regular field references
            const symbol = this.symbolTable.findSymbol(token.text, token.spaceTag);
            if (!symbol && token.spaceTag && !this.isValidOperandReference(token.text, token.spaceTag)) {
              errors.push({
                message: `Undefined field reference: '${token.text}'`,
                location: this.ensureValidRange(token.location),
                severity: 'error',
                code: 'undefined-field-reference',
              });
            }
          }
        }
      }
      
      // Check bit field tokens for invalid syntax and range errors
      if (token.type === TokenType.BIT_FIELD) {
        const containerSize = this.getContainerSizeForToken(token, tokens);
        const { errors: bitFieldErrors } = BitFieldParser.parseBitField(
          token.text,
          token.location,
          containerSize
        );
        errors.push(...bitFieldErrors);
      }
      
      // Check for numeric literals that might be too large for their context
      if (token.type === TokenType.NUMERIC_LITERAL) {
        const numericValue = this.parseNumericValue(token.text);
        if (numericValue !== null) {
          // Get field size context for this token
          const fieldSize = this.getFieldSizeForToken(token, tokens);
          if (fieldSize && this.exceedsFieldSize(token.text, numericValue, fieldSize)) {
            errors.push({
              message: `Binary literal '${token.text}' has more bits defined than the field size (${fieldSize} bits)`,
              location: this.ensureValidRange(token.location),
              severity: 'warning',
              code: 'excess-bits-warning',
            });
          }
        }
      }
      
      // Check for invalid identifier characters
      if (token.type === TokenType.SUBFIELD_TAG || token.type === TokenType.FIELD_TAG) {
        if (!this.isValidIdentifier(token.text)) {
          errors.push({
            message: `Invalid identifier: '${token.text}'. Identifiers can only contain letters, numbers, hyphens, underscores, and periods.`,
            location: this.ensureValidRange(token.location),
            severity: 'error',
            code: 'invalid-identifier',
          });
        }
      }
      
      // Skip option validation for tokens that are already handled as undefined field references
      // to avoid duplicate error reporting
      if (token.type === TokenType.FIELD_REFERENCE) {
        const symbol = this.symbolTable.findSymbol(token.text, token.spaceTag);
        if (symbol) {
          // Token references a valid symbol, so check if it's in wrong context (option validation)
          const recentContent = this.getRecentTokenContext(tokens, token);
          
          // Space option validation
          if (recentContent.includes(':space ') && this.isInvalidSpaceOption(token.text)) {
            errors.push({
              message: `Invalid space option: '${token.text}'. Valid options are: addr, word, type, align, endian`,
              location: this.ensureValidRange(token.location),
              severity: 'warning',
              code: 'invalid-space-option',
            });
          }
          
          // Field option validation (for field definitions like :reg, :insn fieldname options...)
          // Skip if this is an instruction operand (appears after parentheses)
          const fieldDirectivePattern = /:(\w+)\s+\w+\s/;
          const isInstructionOperand = recentContent.includes('(') && recentContent.includes(')');
          if (fieldDirectivePattern.test(recentContent) && !isInstructionOperand && this.isInvalidFieldOption(token.text)) {
            errors.push({
              message: `Invalid field option: '${token.text}'. Valid options are: offset, size, count, reset, name, descr, alias`,
              location: this.ensureValidRange(token.location),
              severity: 'warning',
              code: 'invalid-field-option',
            });
          }
          
          // Bus option validation
          if (recentContent.includes(':bus ') && this.isInvalidBusOption(token.text)) {
            errors.push({
              message: `Invalid bus option: '${token.text}'. Valid options are: addr, ranges, prio, offset, buslen`,
              location: this.ensureValidRange(token.location),
              severity: 'warning',
              code: 'invalid-bus-option',
            });
          }
          
          // Subfield option validation (within subfields={})
          const inSubfieldsContext = recentContent.includes('subfields={') && !recentContent.includes('}');
          if (inSubfieldsContext && this.isInvalidSubfieldOption(token.text)) {
            errors.push({
              message: `Invalid subfield option: '${token.text}'. Valid options are: op, descr`,
              location: this.ensureValidRange(token.location),
              severity: 'warning',
              code: 'invalid-subfield-option',
            });
          }
          
          // Instruction option validation (for instruction definitions with options like mask=)
          const instructionPattern = /:(\w+)\s+\w+\s*\([^)]*\)\s/;
          if (instructionPattern.test(recentContent) && this.isInvalidInstructionOption(token.text)) {
            errors.push({
              message: `Invalid instruction option: '${token.text}'. Valid options are: mask, descr, semantics`,
              location: this.ensureValidRange(token.location),
              severity: 'warning',
              code: 'invalid-instruction-option',
            });
          }
          
          // Range option validation (within ranges={})
          const inRangesContext = recentContent.includes('ranges={') && !recentContent.includes('}');
          if (inRangesContext && this.isInvalidRangeOption(token.text)) {
            errors.push({
              message: `Invalid range option: '${token.text}'. Valid options are: prio, offset, buslen`,
              location: this.ensureValidRange(token.location),
              severity: 'warning',
              code: 'invalid-range-option',
            });
          }
        }
        // If symbol is undefined, the undefined field reference error was already added above
      }
    }
    
    return errors;
  }

  private looksLikeInvalidNumeric(text: string): boolean {
    // Check if text looks like it was intended to be a numeric literal but is invalid
    return /^(0x[0-9a-fA-F]*[g-zG-Z]|0b[0-9]*[2-9a-zA-Z]|0o[0-9]*[8-9a-zA-Z])/.test(text);
  }

  private parseNumericValue(text: string): number | null {
    if (text.startsWith('0b')) {
      const binaryPart = text.slice(2);
      if (/^[01]+$/.test(binaryPart)) {
        return parseInt(binaryPart, 2);
      }
    } else if (text.startsWith('0x')) {
      const hexPart = text.slice(2);
      if (/^[0-9a-fA-F]+$/.test(hexPart)) {
        return parseInt(hexPart, 16);
      }
    } else if (/^[0-9]+$/.test(text)) {
      return parseInt(text, 10);
    }
    return null;
  }

  private exceedsFieldSize(text: string, value: number, fieldSize: number): boolean {
    // For binary literals, check if the literal has more bits than the field can hold
    if (text.startsWith('0b')) {
      const binaryPart = text.slice(2);
      const bitsInLiteral = binaryPart.length;
      
      // Warning if literal has more bits than the field can hold
      return bitsInLiteral > fieldSize;
    }
    
    // For other numeric values, check if the value exceeds what the field size can represent
    const maxValue = (1 << fieldSize) - 1;
    return value > maxValue;
  }
  
  private getFieldSizeForToken(token: Token, tokens: Token[]): number | null {
    // Look for field definitions and mask assignments to determine context
    const tokenIndex = tokens.indexOf(token);
    
    // Look backward for field assignments like "opcd5=0b1111111"
    for (let i = tokenIndex - 1; i >= 0 && i >= tokenIndex - 10; i--) {
      const prevToken = tokens[i];
      if (!prevToken) continue;
      
      // Check for field assignment pattern: fieldname = value
      if (prevToken.text === '=' && i > 0) {
        const fieldToken = tokens[i - 1];
        if (fieldToken && (fieldToken.type === TokenType.FIELD_REFERENCE || fieldToken.type === TokenType.FIELD_TAG)) {
          // Find the field definition to get bit size
          const fieldSize = this.getFieldBitSize(fieldToken.text, tokens, tokenIndex);
          if (fieldSize) {
            return fieldSize;
          }
        }
      }
    }
    
    return null;
  }
  
  private getFieldBitSize(fieldName: string, tokens: Token[], fromIndex: number): number | null {
    // Look backward for field definitions with bit field specifications
    for (let i = fromIndex - 1; i >= 0; i--) {
      const token = tokens[i];
      if (!token) continue;
      
      // Look for field definitions: fieldname @(bit-range)
      if ((token.type === TokenType.FIELD_TAG || token.type === TokenType.SUBFIELD_TAG) && 
          token.text === fieldName && i + 1 < tokens.length) {
        
        const nextToken = tokens[i + 1];
        if (nextToken && nextToken.type === TokenType.BIT_FIELD) {
          // Parse the bit field to get size
          const bitFieldSize = this.calculateBitFieldSize(nextToken.text);
          if (bitFieldSize > 0) {
            return bitFieldSize;
          }
        }
      }
    }
    
    return null;
  }
  
  private calculateBitFieldSize(bitFieldText: string): number {
    // Parse @(start-end) to calculate bit field size
    const match = bitFieldText.match(/@\((\d+)-(\d+)\)/);
    if (match) {
      const start = parseInt(match[1] || '0');
      const end = parseInt(match[2] || '0');
      return Math.abs(end - start) + 1;
    }
    
    // Single bit @(n)
    const singleMatch = bitFieldText.match(/@\((\d+)\)/);
    if (singleMatch) {
      return 1;
    }
    
    return 0;
  }

  private getRecentTokenContext(tokens: Token[], currentToken: Token): string {
    // Get context from recent tokens (simplified implementation)
    const currentIndex = tokens.indexOf(currentToken);
    const recentTokens = tokens.slice(Math.max(0, currentIndex - 10), currentIndex);
    return recentTokens.map(t => t.text).join(' ');
  }

  private isInvalidSpaceOption(text: string): boolean {
    const validSpaceOptions = ['addr', 'word', 'type', 'align', 'endian'];
    return !validSpaceOptions.includes(text) && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text);
  }

  private isInvalidFieldOption(text: string): boolean {
    const validFieldOptions = ['offset', 'size', 'count', 'reset', 'name', 'descr', 'redirect'];
    return !validFieldOptions.includes(text) && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text);
  }

  private isInvalidBusOption(text: string): boolean {
    const validBusOptions = ['addr', 'ranges', 'prio', 'offset', 'buslen'];
    return !validBusOptions.includes(text) && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text);
  }

  private isInvalidSubfieldOption(text: string): boolean {
    const validSubfieldOptions = ['op', 'descr'];
    return !validSubfieldOptions.includes(text) && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text);
  }

  private isInvalidInstructionOption(text: string): boolean {
    const validInstructionOptions = ['mask', 'descr', 'semantics'];
    return !validInstructionOptions.includes(text) && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text);
  }

  private isInvalidRangeOption(text: string): boolean {
    const validRangeOptions = ['prio', 'offset', 'buslen'];
    return !validRangeOptions.includes(text) && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text);
  }

  private validateFieldNode(node: FieldNode): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Validate space tag exists
    if (!this.symbolTable.hasSymbol(node.spaceTag)) {
      errors.push({
        message: `Undefined space tag: ${node.spaceTag}`,
        location: this.ensureValidRange(node.location),
        severity: 'error',
        code: 'undefined-space',
      });
    }
    
    // Validate redirect references
    if (node.alias) {
      // Breaking change: only support context operator (;) syntax
      if (node.alias.includes('.') && !node.alias.includes(';')) {
        const [fieldName, subfieldName] = node.alias.split('.');
        if (fieldName && subfieldName) {
          errors.push({
            message: `Invalid redirect syntax: '${node.alias}'. Use context operator syntax: '${fieldName};${subfieldName}'`,
            location: this.ensureValidRange(node.location),
            severity: 'error',
            code: 'invalid-syntax',
          });
          return errors; // Don't continue with validation
        }
      }
      
      const redirectParts = node.alias.split(';');
      const redirectName = redirectParts[0];
      const subfieldName = redirectParts[1];
      
      if (redirectName) {
        // Check if base field exists
        const baseField = this.symbolTable.findSymbol(redirectName, node.spaceTag);
        if (!baseField) {
          // Check for array field references like spr1024 when max is spr1023
          if (this.isArrayFieldReference(redirectName, node.spaceTag)) {
            const fieldArrayInfo = this.getFieldArrayInfo(redirectName, node.spaceTag);
            if (fieldArrayInfo) {
              const index = this.extractArrayIndex(redirectName, fieldArrayInfo.baseName);
              if (index !== null && index >= fieldArrayInfo.count) {
                errors.push({
                  message: `Undefined field reference: '${redirectName}'. Array '${fieldArrayInfo.baseName}' has count=${fieldArrayInfo.count}, valid range is ${fieldArrayInfo.baseName}0 to ${fieldArrayInfo.baseName}${fieldArrayInfo.count - 1}`,
                  location: this.ensureValidRange(node.location),
                  severity: 'error',
                  code: 'undefined-field-reference',
                });
              }
            }
          } else {
            errors.push({
              message: `Undefined field in redirect: ${redirectName}`,
              location: this.ensureValidRange(node.location),
              severity: 'error',
              code: 'undefined-redirect',
            });
          }
        }
        
        // Check subfield reference if provided
        if (subfieldName && baseField) {
          const subfieldExists = this.symbolTable.findSubfieldInField(redirectName, subfieldName, node.spaceTag);
          if (!subfieldExists) {
            // Calculate more precise location for the subfield part
            const subfieldLocation = this.calculateSubfieldLocation(node, node.alias!);
            errors.push({
              message: `Undefined subfield '${subfieldName}' in field '${redirectName}'`,
              location: this.ensureValidRange(subfieldLocation || node.location),
              severity: 'error',
              code: 'undefined-subfield',
            });
          }
        }
      }
    }
    
    // Validate bit fields in subfields
    for (const subfield of node.subfields) {
      if (subfield.bitField) {
        const containerSize = this.getContainerSize(node.spaceTag);
        const { errors: bitFieldErrors } = BitFieldParser.parseBitField(
          subfield.bitField.text,
          subfield.bitField.location,
          containerSize
        );
        errors.push(...bitFieldErrors);
      }
    }
    
    return errors;
  }
  
  private isArrayFieldReference(fieldName: string, spaceTag: string): boolean {
    // Check if this looks like an array field reference (e.g., spr1024, r31, etc.)
    const match = fieldName.match(/^([a-zA-Z][a-zA-Z0-9_]*)(\d+)$/);
    if (!match || !match[1]) return false;
    
    const baseName = match[1];
    // Check if there's a field with this base name that has a name pattern
    const baseField = this.symbolTable.findSymbol(baseName, spaceTag);
    return baseField !== undefined;
  }
  
  private getFieldArrayInfo(fieldName: string, spaceTag: string): { baseName: string; count: number } | null {
    const match = fieldName.match(/^([a-zA-Z][a-zA-Z0-9_]*)(\d+)$/);
    if (!match || !match[1]) return null;
    
    const baseName = match[1];
    const baseField = this.symbolTable.findSymbol(baseName, spaceTag);
    
    if (baseField && baseField.definition) {
      const fieldNode = baseField.definition as FieldNode;
      if (fieldNode.count && fieldNode.count > 1) {
        return {
          baseName,
          count: fieldNode.count,
        };
      }
    }
    
    return null;
  }
  
  private extractArrayIndex(fieldName: string, baseName: string): number | null {
    if (!fieldName.startsWith(baseName)) return null;
    
    const indexStr = fieldName.slice(baseName.length);
    const index = parseInt(indexStr);
    return isNaN(index) ? null : index;
  }
  
  private getContainerSizeForToken(token: Token, tokens: Token[]): number {
    // Find the containing space to get container size
    // Look backward in tokens to find the most recent space directive or untagged field definition
    const tokenIndex = tokens.indexOf(token);
    
    for (let i = tokenIndex - 1; i >= 0; i--) {
      const prevToken = tokens[i];
      if (!prevToken) continue;
      
      // Check for untagged field definitions with size
      if (prevToken.type === TokenType.SPACE_DIRECTIVE) {
        const spaceTag = prevToken.text.replace(':', '');
        return this.getContainerSize(spaceTag);
      }
      
      // Check for size specification in current context
      if (prevToken.text === 'size' && i + 2 < tokens.length) {
        const equalsToken = tokens[i + 1];
        const sizeToken = tokens[i + 2];
        if (equalsToken?.text === '=' && sizeToken && sizeToken.type === TokenType.NUMERIC_LITERAL) {
          const size = this.parseNumericValue(sizeToken.text);
          if (size !== null) {
            return size;
          }
        }
      }
    }
    
    return 32; // Default container size
  }
  
  private isValidIdentifier(text: string): boolean {
    // Valid identifier pattern: letters, numbers, hyphens, underscores, periods, question marks
    // Must start with a letter
    // Allow special syntax like OE?o and Rc?.
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]*[?]?[a-zA-Z0-9_.]*$/.test(text)) {
      return false;
    }
    
    // Additional check for specific invalid characters
    const invalidChars = /[\\\/\(\)\[\]{}]/;
    return !invalidChars.test(text);
  }
  
  private isValidOperandReference(operand: string, spaceTag: string): boolean {
    // Handle field;subfield context notation (e.g., "spr22;lsb")
    if (operand.includes(';')) {
      const [fieldName, subfieldName] = operand.split(';');
      if (fieldName && subfieldName) {
        // Only check current space unless explicitly redirected with $space;
        const field = this.symbolTable.findSymbol(fieldName, spaceTag);
        if (field && field.type === 'field') {
          // Check if the subfield exists within this field
          return this.symbolTable.findSubfieldInField(fieldName, subfieldName, spaceTag);
        }
      }
      return false;
    }
    
    // Reject old field.subfield notation - breaking change
    if (operand.includes('.')) {
      const [fieldName, subfieldName] = operand.split('.');
      if (fieldName && subfieldName) {
        // This will be caught as an invalid operand reference
        return false;
      }
    }
    
    // Check if it's a direct field/subfield reference in the current space only
    if (this.symbolTable.hasSymbol(operand, spaceTag)) {
      return true;
    }
    
    // Check if it's a subfield of any field in the current space only
    const fieldsInSpace = this.symbolTable.getSymbolsInScope(spaceTag);
    for (const field of fieldsInSpace) {
      if (field.definition && field.type === 'field') {
        const fieldNode = field.definition as FieldNode;
        // Check if operand is a subfield of this field
        for (const subfield of fieldNode.subfields) {
          if (subfield.tag === operand) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  private validateContextReferences(tokens: Token[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;
      
      // Look for field reference followed by context operator
      if (token.type === TokenType.FIELD_REFERENCE && 
          i + 2 < tokens.length && 
          tokens[i + 1]?.type === TokenType.CONTEXT_OPERATOR &&
          tokens[i + 2]?.type === TokenType.FIELD_REFERENCE) {
        
        const fieldToken = token;
        const subfieldToken = tokens[i + 2];
        if (!subfieldToken) continue;
        
        // Validate the context reference
        if (fieldToken.spaceTag) {
          const field = this.symbolTable.findSymbol(fieldToken.text, fieldToken.spaceTag);
          if (!field) {
            errors.push({
              message: `Undefined field reference: '${fieldToken.text}'`,
              location: this.ensureValidRange(fieldToken.location),
              severity: 'error',
              code: 'undefined-field-reference',
            });
          } else if (field.type === 'field') {
            const subfieldExists = this.symbolTable.findSubfieldInField(fieldToken.text, subfieldToken.text, fieldToken.spaceTag);
            if (!subfieldExists) {
              errors.push({
                message: `Undefined subfield '${subfieldToken.text}' in field '${fieldToken.text}'`,
                location: this.ensureValidRange(subfieldToken.location),
                severity: 'error',
                code: 'undefined-subfield',
              });
            }
          }
        }
        
        // Skip the context operator and subfield tokens in the main loop
        i += 2;
      }
      
      // Handle space indirection with context chains ($space;field;subfield)
      else if (token.type === TokenType.SPACE_INDIRECTION && 
               i + 4 < tokens.length && 
               tokens[i + 1]?.type === TokenType.CONTEXT_OPERATOR &&
               tokens[i + 2]?.type === TokenType.FIELD_REFERENCE &&
               tokens[i + 3]?.type === TokenType.CONTEXT_OPERATOR &&
               tokens[i + 4]?.type === TokenType.FIELD_REFERENCE) {
        
        const spaceToken = token;
        const fieldToken = tokens[i + 2];
        const subfieldToken = tokens[i + 4];
        
        if (!fieldToken || !subfieldToken) continue;
        
        // For space indirection, use the space tag from the space token
        const spaceTag = spaceToken.spaceTag || spaceToken.text.substring(1); // Remove $ prefix
        
        const field = this.symbolTable.findSymbol(fieldToken.text, spaceTag);
        if (!field) {
          errors.push({
            message: `Undefined field reference: '${fieldToken.text}'`,
            location: this.ensureValidRange(fieldToken.location),
            severity: 'error',
            code: 'undefined-field-reference',
          });
        } else if (field.type === 'field') {
          const subfieldExists = this.symbolTable.findSubfieldInField(fieldToken.text, subfieldToken.text, spaceTag);
          if (!subfieldExists) {
            errors.push({
              message: `Undefined subfield '${subfieldToken.text}' in field '${fieldToken.text}'`,
              location: this.ensureValidRange(subfieldToken.location),
              severity: 'error',
              code: 'undefined-subfield',
            });
          }
        }
        
        // Skip all tokens in this context chain
        i += 4;
      }
    }
    
    return errors;
  }

  private isPartOfContextChain(tokens: Token[], index: number): boolean {
    // Check if this field reference is followed by a context operator
    if (index + 1 < tokens.length && tokens[index + 1]?.type === TokenType.CONTEXT_OPERATOR) {
      return true;
    }
    
    // Check if this field reference is preceded by a context operator
    if (index > 0 && tokens[index - 1]?.type === TokenType.CONTEXT_OPERATOR) {
      return true;
    }
    
    // Check if this is part of a space indirection context chain
    if (index > 1 && 
        tokens[index - 1]?.type === TokenType.CONTEXT_OPERATOR &&
        tokens[index - 2]?.type === TokenType.SPACE_INDIRECTION) {
      return true;
    }
    
    return false;
  }
  
  private isCommonKeyword(text: string): boolean {
    const keywords = [
      'ro', 'rw', 'memio', 'register', 'subfields', 'mask', 'offset', 'size', 
      'count', 'name', 'descr', 'redirect', 'addr', 'word', 'type', 'align', 
      'endian', 'big', 'little', 'op', 'r', 'd', 'ranges', 'prio', 'buslen',
      'rc', 'oe', 'ra', 'rb', 'rd', 'pmrn' // Common ISA field names
    ];
    return keywords.includes(text.toLowerCase());
  }
  
  private ensureValidRange(location: any): any {
    // Ensure location ranges have non-zero width
    const ensuredLocation = { ...location };
    if (ensuredLocation.range) {
      if (ensuredLocation.range.start.character === ensuredLocation.range.end.character) {
        ensuredLocation.range.end.character = ensuredLocation.range.start.character + 1;
      }
      if (ensuredLocation.start.character === ensuredLocation.end.character) {
        ensuredLocation.end.character = ensuredLocation.start.character + 1;
      }
    }
    return ensuredLocation;
  }

  private validateInstructionNode(node: InstructionNode): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Validate space tag exists
    if (!this.symbolTable.hasSymbol(node.spaceTag)) {
      errors.push({
        message: `Undefined space tag: ${node.spaceTag}`,
        location: this.ensureValidRange(node.location),
        severity: 'error',
        code: 'undefined-space',
      });
    }
    
    // Validate operand references
    for (const operand of node.operands) {
      // Skip empty operands (from empty parentheses)
      if (!operand || operand.trim() === '') continue;
      
      // Skip space indirection operands (they are validated separately by validateContextReferences)
      if (operand.startsWith('$')) continue;
      
      if (!operand.startsWith('@') && !this.isValidOperandReference(operand, node.spaceTag)) {
        // Calculate precise location of the operand within the instruction line
        const operandLocation = this.calculateOperandLocation(node, operand);
        errors.push({
          message: `Undefined field reference: ${operand}`,
          location: this.ensureValidRange(operandLocation || node.location),
          severity: 'error',
          code: 'undefined-field-reference',
        });
      }
    }
    
    return errors;
  }

  private validateSpaceNode(node: SpaceNode): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Validate addr is a valid number
    if (isNaN(node.addr)) {
      errors.push({
        message: `Invalid addr value: expected number but got '${node.addr}'`,
        location: this.ensureValidRange(node.location),
        severity: 'error',
        code: 'invalid-addr-value',
      });
    }
    
    // Validate word size
    if (isNaN(node.word) || node.word <= 0) {
      errors.push({
        message: `Invalid word size: expected positive number but got '${node.word}'`,
        location: this.ensureValidRange(node.location),
        severity: 'error',
        code: 'invalid-word-size',
      });
    }
    
    // Validate space type
    const validTypes = ['rw', 'ro', 'memio', 'register'];
    if (!validTypes.includes(node.spaceType)) {
      errors.push({
        message: `Invalid space type: '${node.spaceType}'. Valid types are: ${validTypes.join(', ')}`,
        location: this.ensureValidRange(node.location),
        severity: 'error',
        code: 'invalid-space-type',
      });
    }
    
    return errors;
  }

  private validateDirectiveNode(node: any): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (node.directiveType === 'param') {
      // Validate param format should be KEY=VALUE
      if (!node.parameters || Object.keys(node.parameters).length === 0) {
        errors.push({
          message: `Invalid param directive: expected format ':param KEY=VALUE'`,
          location: this.ensureValidRange(node.location),
          severity: 'error',
          code: 'invalid-param-format',
        });
      }
    }
    
    return errors;
  }

  private getContainerSize(spaceTag: string): number {
    const spaceSymbol = this.symbolTable.findSymbol(spaceTag);
    if (spaceSymbol && spaceSymbol.definition) {
      const spaceNode = spaceSymbol.definition as SpaceNode;
      return spaceNode.word;
    }
    return 32; // Default size
  }

  private extractDependencies(ast: ParseNode[]): string[] {
    const dependencies: string[] = [];
    
    for (const node of ast) {
      if (node.type === 'directive') {
        const directiveNode = node as any; // Simplified typing
        if (directiveNode.directiveType === 'include' || directiveNode.directiveType === 'attach') {
          dependencies.push(directiveNode.parameters.path);
        }
      }
    }
    
    return dependencies;
  }

  private validateCrossFileReferences(_uri: string, dependencies: string[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Validate that dependency files exist and are valid
    for (const dep of dependencies) {
      const depContext = this.fileContexts.get(dep);
      if (!depContext) {
        const location = this.ensureValidRange({
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
        });
        errors.push({
          message: `Cannot resolve dependency: ${dep}`,
          location,
          severity: 'error',
          code: 'unresolved-dependency',
        });
      }
    }
    
    return errors;
  }

  private enhanceTokens(tokens: Token[], _uri: string): Token[] {
    // Enhance tokens with semantic information from symbol table
    return tokens.map((token, index) => {
      const enhanced = { ...token };
      
      // Add space tag coloring
      if (token.type === TokenType.SPACE_TAG || token.type === TokenType.SPACE_DIRECTIVE) {
        const spaceName = token.text.replace(':', '');
        enhanced.spaceTag = spaceName;
      }
      
      // Ensure space indirection tokens have proper space tag for coloring
      if (token.type === TokenType.SPACE_INDIRECTION && !enhanced.spaceTag) {
        const spaceName = token.text.replace('$', '');
        enhanced.spaceTag = spaceName;
      }
      
      // Handle context chains: $space;field;subfield
      if (token.type === TokenType.FIELD_REFERENCE) {
        let contextSpaceTag = token.spaceTag;
        
        // Check if this field reference is part of a space indirection context chain
        if (index >= 2 && 
            tokens[index - 1]?.type === TokenType.CONTEXT_OPERATOR &&
            tokens[index - 2]?.type === TokenType.SPACE_INDIRECTION) {
          // Use the space tag from the space indirection token
          const spaceIndirectionToken = tokens[index - 2];
          if (spaceIndirectionToken && spaceIndirectionToken.spaceTag) {
            contextSpaceTag = spaceIndirectionToken.spaceTag;
            enhanced.spaceTag = contextSpaceTag;
          }
        }
        // Check if this is the second field reference in $space;field;subfield
        else if (index >= 4 &&
                 tokens[index - 1]?.type === TokenType.CONTEXT_OPERATOR &&
                 tokens[index - 2]?.type === TokenType.FIELD_REFERENCE &&
                 tokens[index - 3]?.type === TokenType.CONTEXT_OPERATOR &&
                 tokens[index - 4]?.type === TokenType.SPACE_INDIRECTION) {
          // Use the space tag from the space indirection token
          const spaceIndirectionToken = tokens[index - 4];
          if (spaceIndirectionToken && spaceIndirectionToken.spaceTag) {
            contextSpaceTag = spaceIndirectionToken.spaceTag;
            enhanced.spaceTag = contextSpaceTag;
          }
        }
        
        // Only check current space tag - cross-space references require explicit $space; prefix
        const symbol = this.symbolTable.findSymbol(token.text, contextSpaceTag);
        if (!symbol) {
          enhanced.type = TokenType.UNDEFINED_REFERENCE;
        }
      }
      
      return enhanced;
    });
  }

  /**
   * Calculate the precise location of an operand within an instruction line
   * Returns the location that points to just the operand (e.g., "not_def" in ":other invinsn (not_def,AA)")
   */
  private calculateOperandLocation(node: InstructionNode, operand: string): SourceLocation | null {
    if (!node.text || !operand) {
      return null;
    }

    // Find the parentheses that contain the operands
    const parenStart = node.text.indexOf('(');
    if (parenStart === -1) {
      return null;
    }

    // Extract the content within parentheses
    const parenEnd = node.text.indexOf(')', parenStart);
    if (parenEnd === -1) {
      return null;
    }

    const operandsText = node.text.substring(parenStart + 1, parenEnd);
    
    // Split operands and find the index of our target operand
    const operands = operandsText.split(',').map(op => op.trim());
    const operandIndex = operands.findIndex(op => op === operand);
    
    if (operandIndex === -1) {
      return null;
    }

    // Calculate the position by finding where this operand starts within the operands text
    let currentPos = 0;
    for (let i = 0; i < operandIndex; i++) {
      const prevOperand = operands[i];
      if (prevOperand) {
        // Find the actual position of this operand (accounting for whitespace)
        const operandPos = operandsText.indexOf(prevOperand, currentPos);
        if (operandPos !== -1) {
          currentPos = operandPos + prevOperand.length;
          // Skip past the comma and any whitespace
          const commaPos = operandsText.indexOf(',', currentPos);
          if (commaPos !== -1) {
            currentPos = commaPos + 1;
          }
        }
      }
    }

    // Find the actual start position of our target operand
    const operandStartInOperands = operandsText.indexOf(operand, currentPos);
    if (operandStartInOperands === -1) {
      return null;
    }

    // Calculate absolute positions within the line
    const operandStartChar = node.location.start.character + parenStart + 1 + operandStartInOperands;
    const operandEndChar = operandStartChar + operand.length;

    return {
      start: { line: node.location.start.line, character: operandStartChar },
      end: { line: node.location.start.line, character: operandEndChar },
      range: {
        start: { line: node.location.start.line, character: operandStartChar },
        end: { line: node.location.start.line, character: operandEndChar }
      }
    };
  }

  /**
   * Calculate the precise location of a subfield within an alias value
   * Returns the location that points to just the subfield part (e.g., ";lsb" in "spr22;lsb")
   */
  private calculateSubfieldLocation(node: FieldNode, aliasValue: string): SourceLocation | null {
    if (!node.text || !aliasValue.includes(';')) {
      return null;
    }

    // Find the "redirect=" text in the node's text
    const redirectStart = node.text.indexOf('redirect=');
    if (redirectStart === -1) {
      return null;
    }

    // Find the start of the redirect value
    const redirectValueStart = redirectStart + 'redirect='.length;
    
    // Find the semicolon that separates field from subfield
    const separatorIndex = aliasValue.indexOf(';');
    if (separatorIndex === -1) {
      return null;
    }

    // Calculate the character positions for the subfield part (including the separator)
    const subfieldStartInRedirect = separatorIndex; // Start at the separator
    const subfieldEndInRedirect = aliasValue.length; // End at the end of redirect value
    
    // Calculate absolute positions within the line
    const subfieldStartChar = node.location.start.character + redirectValueStart + subfieldStartInRedirect;
    const subfieldEndChar = node.location.start.character + redirectValueStart + subfieldEndInRedirect;

    return {
      start: { line: node.location.start.line, character: subfieldStartChar },
      end: { line: node.location.start.line, character: subfieldEndChar },
      range: {
        start: { line: node.location.start.line, character: subfieldStartChar },
        end: { line: node.location.start.line, character: subfieldEndChar }
      }
    };
  }
}
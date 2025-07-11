/**
 * Tokenizer for ISA language files
 * Provides context-aware tokenization for linting and highlighting
 */

import { Position, Range } from 'vscode-languageserver';
import { Token, TokenType, SourceLocation } from './types';
import { NumericParser } from '../utils/numeric-parser';

export interface TokenizerOptions {
  enableSemanticTokens: boolean;
  spaceTagColors: Record<string, string>;
}

export class ISATokenizer {
  private content: string;
  // private _lines: string[];
  private position: number = 0;
  private line: number = 0;
  private character: number = 0;
  private tokens: Token[] = [];
  // private _options: TokenizerOptions;

  // Context tracking
  private currentSpaceTag: string | null = null;
  private inSubfields: boolean = false;
  // private _inMask: boolean = false;
  private nestingLevel: number = 0;

  constructor(content: string, _options: TokenizerOptions) {
    this.content = content;
    // this._lines = content.split(/\r?\n/);
    // this._options = options;
  }

  /**
   * Tokenize the entire content
   */
  tokenize(): Token[] {
    this.reset();
    
    while (this.position < this.content.length) {
      this.tokenizeNext();
    }
    
    return this.tokens;
  }

  private reset(): void {
    this.position = 0;
    this.line = 0;
    this.character = 0;
    this.tokens = [];
    this.currentSpaceTag = null;
    this.inSubfields = false;
    // this._inMask = false;
    this.nestingLevel = 0;
  }

  private tokenizeNext(): void {
    this.skipWhitespace();
    
    if (this.position >= this.content.length) {
      return;
    }

    const char = this.content[this.position];
    
    // Comments
    if (char === '#') {
      this.tokenizeComment();
      return;
    }
    
    // Directives
    if (char === ':') {
      this.tokenizeDirective();
      return;
    }
    
    // Bit fields
    if (char === '@') {
      this.tokenizeBitField();
      return;
    }
    
    // Quoted strings
    if (char === '"') {
      this.tokenizeQuotedString();
      return;
    }
    
    // Context brackets
    if (char === '{' || char === '}' || char === '(' || char === ')') {
      this.tokenizeContextBracket();
      return;
    }
    
    // Index brackets and range separator
    if (char === '[' || char === ']') {
      this.tokenizeIndexBracket();
      return;
    }
    
    // Range separator (dash) - check if it's in an index context
    if (char === '-' && this.isIndexRangeSeparator()) {
      this.tokenizeIndexRangeSeparator();
      return;
    }
    
    // Equals sign
    if (char === '=') {
      this.tokenizeEqualsSign();
      return;
    }
    
    // Space indirection operation
    if (char === '$') {
      this.tokenizeSpaceIndirection();
      return;
    }
    
    // Context operator (;)
    if (char === ';') {
      this.tokenizeContextOperator();
      return;
    }
    
    // Bus size separator must be checked before alphanumeric to catch _ in bus context
    if (char === '_' && this.isBusSizeSeparator()) {
      this.tokenizeBusSizeSeparator();
      return;
    }
    
    // Bus range operators (--)
    if (char === '-' && this.isBusRangeSeparator()) {
      this.tokenizeBusRangeSeparator();
      return;
    }
    
    // Arrow operator (->) is no longer supported - breaking change
    
    // Numeric literals or identifiers
    if (char && (this.isAlphaNumeric(char) || char === '0')) {
      this.tokenizeAlphaNumeric();
      return;
    }
    
    // Skip other characters (operators, punctuation)
    this.advance();
  }

  private tokenizeComment(): void {
    const start = this.getCurrentPosition();
    const startPos = this.position;
    
    // Find end of line
    while (this.position < this.content.length && this.content[this.position] !== '\n') {
      this.advance();
    }
    
    const text = this.content.slice(startPos, this.position);
    const location = this.createLocation(start, this.getCurrentPosition());
    
    this.addToken(TokenType.COMMENT, text, location);
  }

  private tokenizeDirective(): void {
    const start = this.getCurrentPosition();
    const startPos = this.position;
    this.advance(); // skip ':'
    
    while (this.position < this.content.length && this.content[this.position] && this.isIdentifierChar(this.content[this.position]!)) {
      this.advance();
    }
    
    const directiveName = this.content.slice(startPos + 1, this.position);
    const text = this.content.slice(startPos, this.position);
    const location = this.createLocation(start, this.getCurrentPosition());
    
    // Determine token type based on directive
    if (['param', 'space', 'bus', 'include', 'attach'].includes(directiveName)) {
      this.addToken(TokenType.DIRECTIVE, text, location);
      
      if (directiveName === 'space') {
        this.tokenizeSpaceDirective();
      }
    } else {
      // This is a space directive like :reg, :insn
      this.currentSpaceTag = directiveName;
      this.addToken(TokenType.SPACE_DIRECTIVE, text, location, directiveName);
    }
  }

  private tokenizeSpaceDirective(): void {
    this.skipWhitespace();
    
    // Next token should be the space tag
    const start = this.getCurrentPosition();
    const startPos = this.position;
    
    while (this.position < this.content.length && this.content[this.position] && this.isIdentifierChar(this.content[this.position]!)) {
      this.advance();
    }
    
    const spaceTag = this.content.slice(startPos, this.position);
    const location = this.createLocation(start, this.getCurrentPosition());
    
    this.currentSpaceTag = spaceTag;
    this.addToken(TokenType.SPACE_TAG, spaceTag, location, spaceTag);
  }

  private tokenizeBitField(): void {
    const start = this.getCurrentPosition();
    const startPos = this.position;
    this.advance(); // skip '@'
    
    if (this.content[this.position] === '(') {
      this.advance(); // skip '('
      
      // Find matching closing parenthesis
      let depth = 1;
      while (this.position < this.content.length && depth > 0) {
        const char = this.content[this.position];
        if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
        }
        this.advance();
      }
      
      const text = this.content.slice(startPos, this.position);
      const location = this.createLocation(start, this.getCurrentPosition());
      
      this.addToken(TokenType.BIT_FIELD, text, location);
    }
  }

  private tokenizeQuotedString(): void {
    const start = this.getCurrentPosition();
    const startPos = this.position;
    this.advance(); // skip opening quote
    
    while (this.position < this.content.length) {
      const char = this.content[this.position];
      if (char === '"') {
        this.advance(); // skip closing quote
        break;
      } else if (char === '\\') {
        this.advance(); // skip escape character
        if (this.position < this.content.length) {
          this.advance(); // skip escaped character
        }
      } else {
        this.advance();
      }
    }
    
    const text = this.content.slice(startPos, this.position);
    const location = this.createLocation(start, this.getCurrentPosition());
    
    this.addToken(TokenType.QUOTED_STRING, text, location);
  }

  private tokenizeContextBracket(): void {
    const start = this.getCurrentPosition();
    const bracket = this.content[this.position];
    this.advance();
    
    const location = this.createLocation(start, this.getCurrentPosition());
    
    if (bracket === '{') {
      this.nestingLevel++;
      // Only set inSubfields if we're actually in a subfields context
      const recentContent = this.content.slice(Math.max(0, this.position - 100), this.position);
      if (recentContent.includes('subfields=')) {
        this.inSubfields = true;
      }
    } else if (bracket === '}') {
      this.nestingLevel--;
      if (this.nestingLevel === 0) {
        this.inSubfields = false;
        // this._inMask = false;
      }
    }
    
    if (bracket) {
      this.addToken(TokenType.CONTEXT_BRACKET, bracket, location);
    }
  }

  private tokenizeEqualsSign(): void {
    const start = this.getCurrentPosition();
    this.advance(); // skip '='
    
    const location = this.createLocation(start, this.getCurrentPosition());
    this.addToken(TokenType.EQUALS_SIGN, '=', location);
  }

  private tokenizeSpaceIndirection(): void {
    const start = this.getCurrentPosition();
    const startPos = this.position;
    this.advance(); // skip '$'
    
    // Read the space tag following the $, but stop at separators
    while (this.position < this.content.length && 
           this.content[this.position] && 
           this.content[this.position] !== ';' &&
           this.content[this.position] !== '-' &&
           this.content[this.position] !== '.' &&
           this.isIdentifierChar(this.content[this.position]!)) {
      this.advance();
    }
    
    const text = this.content.slice(startPos, this.position);
    const spaceTag = text.slice(1); // Remove the $ prefix
    const location = this.createLocation(start, this.getCurrentPosition());
    
    // Only create token if we found a space tag
    if (spaceTag.length > 0) {
      this.addToken(TokenType.SPACE_INDIRECTION, text, location, spaceTag);
    } else {
      // Just advance past the $ if no identifier follows
      // This will be treated as a regular character
    }
  }

  private tokenizeContextOperator(): void {
    const start = this.getCurrentPosition();
    this.advance(); // skip ';'
    
    const location = this.createLocation(start, this.getCurrentPosition());
    this.addToken(TokenType.CONTEXT_OPERATOR, ';', location);
  }

  private tokenizeIndexBracket(): void {
    const start = this.getCurrentPosition();
    const bracket = this.content[this.position];
    this.advance();
    
    const location = this.createLocation(start, this.getCurrentPosition());
    
    if (bracket === '[') {
      this.addToken(TokenType.INDEX_BRACKET_OPEN, '[', location);
    } else if (bracket === ']') {
      this.addToken(TokenType.INDEX_BRACKET_CLOSE, ']', location);
    }
  }

  private tokenizeIndexRangeSeparator(): void {
    const start = this.getCurrentPosition();
    this.advance(); // skip '-'
    
    const location = this.createLocation(start, this.getCurrentPosition());
    this.addToken(TokenType.INDEX_RANGE_SEPARATOR, '-', location);
  }

  private isIndexRangeSeparator(): boolean {
    // Check if this dash is between two numeric literals in an index context
    // Look back to see if we recently saw an opening bracket and a number, but NOT a space indirection
    const recentContent = this.content.slice(Math.max(0, this.position - 50), this.position);
    
    // Don't treat as index separator if we're in a space indirection context
    if (recentContent.includes('$')) {
      return false;
    }
    
    const hasOpenBracket = recentContent.includes('[');
    const hasNumericBefore = /\d\s*$/.test(recentContent);
    
    // Look ahead to see if there's a number after the dash
    const remainingContent = this.content.slice(this.position + 1, this.position + 20);
    const hasNumericAfter = /^\s*[0-9]/.test(remainingContent);
    
    // Also check that we have an unclosed bracket (no closing bracket after the opening one)
    const hasUnclosedBracket = hasOpenBracket && !recentContent.slice(recentContent.lastIndexOf('[')).includes(']');
    
    return hasOpenBracket && hasUnclosedBracket && hasNumericBefore && hasNumericAfter;
  }

  private tokenizeBusRangeSeparator(): void {
    const start = this.getCurrentPosition();
    this.advance(); // skip first '-'
    
    // Consume the second '-' for the '--' operator
    if (this.position < this.content.length && this.content[this.position] === '-') {
      this.advance();
    }
    
    const location = this.createLocation(start, this.getCurrentPosition());
    this.addToken(TokenType.BUS_RANGE_SEPARATOR, '--', location);
  }

  private isBusRangeSeparator(): boolean {
    // Check if this is a '--' operator in a bus range context
    // Look for double dash and check we're in a ranges={} context
    if (this.position + 1 < this.content.length && this.content[this.position + 1] === '-') {
      const recentContent = this.content.slice(Math.max(0, this.position - 100), this.position);
      
      // Check if we're in a ranges context and not in an index context
      const inRangesContext = recentContent.includes('ranges={') && !recentContent.includes('}');
      const notInIndexContext = !recentContent.includes('[') || recentContent.includes(']');
      
      // Look for numeric literal before the '--'
      const hasNumericBefore = /[0-9a-fA-FxXbBoO]\s*$/.test(recentContent);
      
      // Look for numeric literal after the '--'
      const remainingContent = this.content.slice(this.position + 2, this.position + 20);
      const hasNumericAfter = /^\s*[0-9a-fA-FxXbBoO]/.test(remainingContent);
      
      return inRangesContext && notInIndexContext && hasNumericBefore && hasNumericAfter;
    }
    
    return false;
  }

  private tokenizeBusSizeSeparator(): void {
    const start = this.getCurrentPosition();
    this.advance(); // skip '_'
    
    const location = this.createLocation(start, this.getCurrentPosition());
    this.addToken(TokenType.BUS_SIZE_SEPARATOR, '_', location);
  }

  private isBusSizeSeparator(): boolean {
    // Check if this '_' is in a bus size context (start_size)
    const recentContent = this.content.slice(Math.max(0, this.position - 100), this.position);
    
    // Check if we're in a ranges context and not in an identifier
    const inRangesContext = recentContent.includes('ranges={') && !recentContent.includes('}');
    
    // Look for numeric literal before the '_'
    const hasNumericBefore = /[0-9a-fA-FxXbBoO]\s*$/.test(recentContent);
    
    // Look for numeric literal after the '_'
    const remainingContent = this.content.slice(this.position + 1, this.position + 20);
    const hasNumericAfter = /^\s*[0-9a-fA-FxXbBoO]/.test(remainingContent);
    
    // Don't treat as bus size separator if this could be part of an identifier
    // Check if there's a letter immediately before or after the underscore
    const letterBefore = /[a-zA-Z]$/.test(recentContent);
    const letterAfter = /^[a-zA-Z]/.test(remainingContent);
    const couldBeIdentifier = letterBefore || letterAfter;
    
    
    return inRangesContext && hasNumericBefore && hasNumericAfter && !couldBeIdentifier;
  }

  private tokenizeAlphaNumeric(): void {
    const start = this.getCurrentPosition();
    
    // Check if this is a numeric literal
    if (this.couldBeNumericLiteral()) {
      const numericToken = this.tryTokenizeNumericLiteral(start);
      if (numericToken) {
        return;
      }
    }
    
    // Otherwise, tokenize as identifier
    this.tokenizeIdentifier(start);
  }

  private couldBeNumericLiteral(): boolean {
    const remaining = this.content.slice(this.position);
    return /^(0x[0-9a-fA-F]+|0b[01]+|0o[0-7]+|[0-9]+)/.test(remaining);
  }

  private tryTokenizeNumericLiteral(start: Position): boolean {
    const savedPosition = this.position;
    const savedLine = this.line;
    const savedChar = this.character;
    
    // Try to parse as numeric literal - first get basic numeric characters
    let text = '';
    while (this.position < this.content.length && this.content[this.position] && this.isNumericChar(this.content[this.position]!)) {
      text += this.content[this.position]!;
      this.advance();
    }
    
    // For hex literals (0x...), include any additional letters that might be invalid hex digits
    // But stop at underscore if we're in a bus range context
    if (text.startsWith('0x') || text.startsWith('0X')) {
      while (this.position < this.content.length && this.content[this.position] && /[a-zA-Z0-9]/.test(this.content[this.position]!)) {
        // Check if this is an underscore in a bus range context
        if (this.content[this.position] === '_' && this.isBusSizeSeparator()) {
          break; // Stop here, let the bus size separator be tokenized separately
        }
        text += this.content[this.position]!;
        this.advance();
      }
    }
    // For binary literals (0b...), include any additional digits that might be invalid
    // But stop at underscore if we're in a bus range context
    else if (text.startsWith('0b') || text.startsWith('0B')) {
      while (this.position < this.content.length && this.content[this.position] && /[0-9a-zA-Z]/.test(this.content[this.position]!)) {
        if (this.content[this.position] === '_' && this.isBusSizeSeparator()) {
          break;
        }
        text += this.content[this.position]!;
        this.advance();
      }
    }
    // For octal literals (0o...), include any additional digits that might be invalid
    // But stop at underscore if we're in a bus range context
    else if (text.startsWith('0o') || text.startsWith('0O')) {
      while (this.position < this.content.length && this.content[this.position] && /[0-9a-zA-Z]/.test(this.content[this.position]!)) {
        if (this.content[this.position] === '_' && this.isBusSizeSeparator()) {
          break;
        }
        text += this.content[this.position]!;
        this.advance();
      }
    }
    
    // Check if this looks like a numeric literal (starts with 0x, 0b, 0o, or digits)
    const looksLikeNumeric = /^(0x[0-9a-fA-F]*|0b[0-9]*|0o[0-9]*|[0-9]+)/.test(text);
    
    if (looksLikeNumeric) {
      const literal = NumericParser.parseNumericLiteral(text);
      const location = this.createLocation(start, this.getCurrentPosition());
      
      if (literal) {
        // Valid numeric literal
        this.addToken(TokenType.NUMERIC_LITERAL, text, location);
      } else {
        // Invalid numeric literal - mark as error token
        this.addToken(TokenType.UNDEFINED_REFERENCE, text, location); // Use undefined reference type to trigger error highlighting
      }
      return true;
    }
    
    // Restore position if not a numeric literal pattern
    this.position = savedPosition;
    this.line = savedLine;
    this.character = savedChar;
    return false;
  }

  private tokenizeIdentifier(start: Position): void {
    const startPos = this.position;
    
    while (this.position < this.content.length && this.content[this.position] && this.isIdentifierChar(this.content[this.position]!)) {
      this.advance();
    }
    
    let text = this.content.slice(startPos, this.position);
    
    // Check if this identifier is followed by an index bracket [
    if (this.position < this.content.length && this.content[this.position] === '[') {
      // This is an indexed field tag - collect the entire [startindex-endindex] part
      const indexStart = this.position;
      this.advance(); // skip '['
      
      // Collect content until closing ']'
      while (this.position < this.content.length && this.content[this.position] !== ']') {
        this.advance();
      }
      
      if (this.position < this.content.length && this.content[this.position] === ']') {
        this.advance(); // skip ']'
        text = this.content.slice(startPos, this.position); // Include the full indexed syntax
        
        const location = this.createLocation(start, this.getCurrentPosition());
        this.addToken(TokenType.INDEXED_FIELD_TAG, text, location, this.currentSpaceTag || undefined);
        return;
      } else {
        // Malformed bracket - reset position and treat as regular identifier
        this.position = indexStart;
      }
    }
    
    const location = this.createLocation(start, this.getCurrentPosition());
    
    // Determine token type based on context
    const tokenType = this.determineIdentifierTokenType(text);
    this.addToken(tokenType, text, location, this.currentSpaceTag || undefined);
  }

  private determineIdentifierTokenType(text: string): TokenType {
    // Check context from recent content to determine type
    const recentContent = this.content.slice(Math.max(0, this.position - 100), this.position);
    
    // Check for directive-specific option tags
    const optionType = this.getDirectiveOptionType(text, recentContent);
    if (optionType) {
      return optionType;
    }
    
    // If we're after a space directive like :reg, :insn, etc., and this is the first identifier,
    // it's likely a field or instruction tag
    const spaceDirectiveMatch = recentContent.match(/:(\w+)\s+$/);
    if (spaceDirectiveMatch && this.currentSpaceTag) {
      return TokenType.FIELD_TAG;
    }
    
    // If we see this identifier in an operand list (inside parentheses) or mask context,
    // it's a field reference
    const inOperandList = recentContent.includes('(') && !recentContent.includes(')');
    const inMaskContext = recentContent.includes('mask={') || recentContent.includes('=');
    
    if (inOperandList || inMaskContext) {
      return TokenType.FIELD_REFERENCE;
    }
    
    // In subfields context, this is likely a subfield tag
    if (this.inSubfields) {
      return TokenType.SUBFIELD_TAG;
    }
    
    // If we're after a space directive and this isn't the first identifier, it's likely a field reference
    if (this.currentSpaceTag) {
      return TokenType.FIELD_REFERENCE;
    }
    
    return TokenType.FIELD_REFERENCE; // Default
  }

  private getDirectiveOptionType(text: string, recentContent: string): TokenType | null {
    // Space options
    const validSpaceOptions = ['addr', 'word', 'type', 'align', 'endian'];
    if (recentContent.includes(':space ') && validSpaceOptions.includes(text)) {
      return TokenType.SPACE_OPTION_TAG;
    }

    // Bus options
    const validBusOptions = ['addr', 'ranges'];
    if (recentContent.includes(':bus ') && validBusOptions.includes(text)) {
      return TokenType.BUS_OPTION_TAG;
    }

    // Subfield options (within subfields={})
    const validSubfieldOptions = ['op', 'descr'];
    const inSubfieldsContext = recentContent.includes('subfields={') && !recentContent.includes('}');
    if (inSubfieldsContext && validSubfieldOptions.includes(text)) {
      return TokenType.SUBFIELD_OPTION_TAG;
    }

    // Range options (within ranges={}) - check this FIRST to take precedence
    const validRangeOptions = ['prio', 'redirect', 'descr', 'device'];
    const inRangesContext = recentContent.includes('ranges={') && !recentContent.includes('}');
    if (inRangesContext && validRangeOptions.includes(text)) {
      return TokenType.RANGE_OPTION_TAG;
    }

    // Instruction options (for instruction definitions with options like mask=)
    const validInstructionOptions = ['mask', 'descr', 'semantics'];
    const instructionPattern = /:(\w+)\s+\w+\s*\([^)]*\)\s/;
    if (instructionPattern.test(recentContent) && validInstructionOptions.includes(text)) {
      return TokenType.INSTRUCTION_OPTION_TAG;
    }

    // Field options (for field definitions like :reg, :insn fieldname options...)
    // Only apply this if we're not in a ranges context
    const validFieldOptions = ['offset', 'size', 'count', 'reset', 'name', 'descr', 'redirect'];
    const fieldDirectivePattern = /:(\w+)\s+\w+\s/;
    if (!inRangesContext && fieldDirectivePattern.test(recentContent) && validFieldOptions.includes(text)) {
      return TokenType.FIELD_OPTION_TAG;
    }

    return null;
  }

  private skipWhitespace(): void {
    while (this.position < this.content.length && this.content[this.position] && this.isWhitespace(this.content[this.position]!)) {
      this.advance();
    }
  }

  private advance(): void {
    if (this.position < this.content.length) {
      if (this.content[this.position] === '\n') {
        this.line++;
        this.character = 0;
      } else {
        this.character++;
      }
      this.position++;
    }
  }


  private getCurrentPosition(): Position {
    return Position.create(this.line, this.character);
  }

  private createLocation(start: Position, end: Position): SourceLocation {
    return {
      start,
      end,
      range: Range.create(start, end),
    };
  }

  private addToken(type: TokenType, text: string, location: SourceLocation, spaceTag?: string): void {
    const token: Token = {
      type,
      text,
      location,
    };
    
    if (spaceTag) {
      token.spaceTag = spaceTag;
    }
    
    this.tokens.push(token);
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  private isAlphaNumeric(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  private isIdentifierChar(char: string): boolean {
    return /[a-zA-Z0-9_.-]/.test(char);
  }

  private isNumericChar(char: string): boolean {
    return /[0-9a-fA-FxXbBoO]/.test(char);
  }
}
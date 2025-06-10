/**
 * Core types for the ISA language parser
 */

import { Range, Position } from 'vscode-languageserver';

export interface SourceLocation {
  start: Position;
  end: Position;
  range: Range;
}

export interface ParseNode {
  type: string;
  location: SourceLocation;
  text: string;
}

// Token types for semantic highlighting
export enum TokenType {
  // Directives
  DIRECTIVE = 'directive',
  SPACE_DIRECTIVE = 'spaceDirective',
  
  // Identifiers
  SPACE_TAG = 'spaceTag',
  FIELD_TAG = 'fieldTag',
  SUBFIELD_TAG = 'subfieldTag',
  INSTRUCTION_TAG = 'instructionTag',
  
  // Option parameters (all get same blue color)
  SPACE_OPTION_TAG = 'spaceOptionTag',
  FIELD_OPTION_TAG = 'fieldOptionTag',
  BUS_OPTION_TAG = 'busOptionTag',
  SUBFIELD_OPTION_TAG = 'subfieldOptionTag', 
  INSTRUCTION_OPTION_TAG = 'instructionOptionTag',
  RANGE_OPTION_TAG = 'rangeOptionTag',
  EQUALS_SIGN = 'equalsSign',
  
  // Literals
  NUMERIC_LITERAL = 'numericLiteral',
  BIT_FIELD = 'bitField',
  QUOTED_STRING = 'quotedString',
  
  // Operational semantics
  SOURCE_OPERAND = 'sourceOperand',
  TARGET_OPERAND = 'targetOperand',
  FUNC_FIELD = 'funcField',
  IMM_FIELD = 'immField',
  
  // References
  FIELD_REFERENCE = 'fieldReference',
  UNDEFINED_REFERENCE = 'undefinedReference',
  ALIAS_REFERENCE = 'aliasReference',
  
  // Space indirection operations
  SPACE_INDIRECTION = 'spaceIndirection',
  INDIRECTION_ARROW = 'indirectionArrow',
  
  // Context indicators
  CONTEXT_BRACKET = 'contextBracket',
  COMMENT = 'comment',
}

export interface Token {
  type: TokenType;
  text: string;
  location: SourceLocation;
  spaceTag?: string | undefined; // For space-specific coloring
  modifiers?: string[] | undefined;
}

// AST Node types
export interface DirectiveNode extends ParseNode {
  type: 'directive';
  directiveType: string;
  name?: string;
  parameters: Record<string, string | number>;
}

export interface SpaceNode extends ParseNode {
  type: 'space';
  tag: string;
  addr: number;
  word: number;
  spaceType: 'rw' | 'ro' | 'memio' | 'register';
  align?: number | undefined;
  endian?: 'big' | 'little' | undefined;
}

export interface FieldNode extends ParseNode {
  type: 'field';
  spaceTag: string;
  fieldTag?: string;
  offset?: number;
  size?: number;
  count?: number;
  reset?: number;
  name?: string;
  description?: string;
  alias?: string;
  subfields: SubfieldNode[];
}

export interface SubfieldNode extends ParseNode {
  type: 'subfield';
  tag: string;
  postfix?: string;
  bitField: BitFieldNode;
  operations: string[];
  description?: string;
}

export interface InstructionNode extends ParseNode {
  type: 'instruction';
  spaceTag: string;
  tag: string;
  operands: string[];
  mask: Record<string, number>;
  description?: string;
  semantics?: string;
}

export interface BitFieldNode extends ParseNode {
  type: 'bitField';
  specification: BitSpec[];
}

export interface BitSpec {
  type: 'range' | 'index' | 'literal' | 'signExtension';
  start?: number;
  end?: number;
  value?: string;
  signBit?: '0' | '1';
}

export interface BusNode extends ParseNode {
  type: 'bus';
  tag: string;
  addr: number;
  ranges: RangeDefinition[];
}

export interface RangeDefinition {
  busAddress: number;
  spaceTag: string;
  priority?: number;
  offset?: number;
  busLength?: number;
}

// Numeric literal types
export interface NumericLiteral {
  value: number;
  base: 'decimal' | 'hexadecimal' | 'binary' | 'octal';
  text: string;
}

// Validation error types
export interface ValidationError {
  message: string;
  location: SourceLocation;
  severity: 'error' | 'warning' | 'info';
  code?: string;
}

// File context types
export interface FileContext {
  uri: string;
  content: string;
  ast?: ParseNode[];
  tokens?: Token[];
  errors?: ValidationError[];
  lastModified: number;
}

// Symbol table types
export interface Symbol {
  name: string;
  type: 'space' | 'field' | 'subfield' | 'instruction' | 'bus';
  location: SourceLocation;
  fileUri: string;
  spaceTag?: string; // For fields and subfields
  definition?: ParseNode;
}

export interface SymbolTable {
  symbols: Map<string, Symbol>;
  scopes: Map<string, Set<string>>; // spaceTag -> field names
}

// Language server configuration
export interface ISALanguageServerConfig {
  maxProblems: number;
  enableValidation: boolean;
  colorScheme: {
    autoAssign: boolean;
    spaceColors: Record<string, string>;
  };
  includePaths: string[];
}
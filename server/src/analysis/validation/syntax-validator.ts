/**
 * Syntax validation for ISA language
 */

import { ValidationError, ParseNode, DirectiveNode, SourceLocation } from '../../parser/types';
import { NumericParser } from '../../utils/numeric-parser';

export class SyntaxValidator {
  /**
   * Validate syntax of parsed nodes
   */
  static validate(nodes: ParseNode[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const node of nodes) {
      errors.push(...this.validateNode(node));
    }
    
    return errors;
  }

  private static validateNode(node: ParseNode): ValidationError[] {
    const errors: ValidationError[] = [];
    
    switch (node.type) {
      case 'directive':
        errors.push(...this.validateDirective(node as DirectiveNode));
        break;
      case 'space':
        errors.push(...this.validateSpaceNode(node as any));
        break;
      case 'field':
        errors.push(...this.validateFieldNode(node as any));
        break;
      case 'instruction':
        errors.push(...this.validateInstructionNode(node as any));
        break;
    }
    
    return errors;
  }

  private static validateDirective(node: DirectiveNode): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Validate required parameters for different directive types
    switch (node.directiveType) {
      case 'param':
        if (!node.name || !node.parameters.value) {
          errors.push({
            message: 'Parameter directive requires name and value',
            location: node.location,
            severity: 'error',
            code: 'missing-param-value',
          });
        }
        break;
        
      case 'space':
        if (!node.parameters.addr || !node.parameters.word || !node.parameters.type) {
          errors.push({
            message: 'Space directive requires addr, word, and type parameters',
            location: node.location,
            severity: 'error',
            code: 'missing-space-params',
          });
        }
        break;
    }
    
    return errors;
  }

  private static validateSpaceNode(node: any): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Validate address size is reasonable
    if (node.addr < 1 || node.addr > 128) {
      errors.push({
        message: 'Address size must be between 1 and 128 bits',
        location: node.location,
        severity: 'error',
        code: 'invalid-addr-size',
      });
    }
    
    // Validate word size is reasonable
    if (node.word < 1 || node.word > 512) {
      errors.push({
        message: 'Word size must be between 1 and 512 bits',
        location: node.location,
        severity: 'error',
        code: 'invalid-word-size',
      });
    }
    
    // Validate space type
    const validTypes = ['rw', 'ro', 'memio', 'register'];
    if (!validTypes.includes(node.spaceType)) {
      errors.push({
        message: `Invalid space type: ${node.spaceType}. Must be one of: ${validTypes.join(', ')}`,
        location: node.location,
        severity: 'error',
        code: 'invalid-space-type',
      });
    }
    
    return errors;
  }

  private static validateFieldNode(node: any): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Validate field size
    if (node.size !== undefined && (node.size < 1 || node.size > 512)) {
      errors.push({
        message: 'Field size must be between 1 and 512 bits',
        location: node.location,
        severity: 'error',
        code: 'invalid-field-size',
      });
    }
    
    // Validate count
    if (node.count !== undefined && node.count < 1) {
      errors.push({
        message: 'Field count must be at least 1',
        location: node.location,
        severity: 'error',
        code: 'invalid-field-count',
      });
    }
    
    // Validate that alias is mutually exclusive with other options
    if (node.alias && (node.offset !== undefined || node.size !== undefined || node.count !== undefined)) {
      errors.push({
        message: 'Alias fields cannot have offset, size, or count options',
        location: node.location,
        severity: 'error',
        code: 'alias-with-options',
      });
    }
    
    return errors;
  }

  private static validateInstructionNode(node: any): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Validate that instruction has operands or mask
    if (node.operands.length === 0 && Object.keys(node.mask).length === 0) {
      errors.push({
        message: 'Instruction must have either operands or mask specification',
        location: node.location,
        severity: 'warning',
        code: 'empty-instruction',
      });
    }
    
    return errors;
  }

  /**
   * Validate numeric literals
   */
  static validateNumericLiteral(text: string, location: SourceLocation): ValidationError[] {
    const errors: ValidationError[] = [];
    
    const literal = NumericParser.parseNumericLiteral(text);
    if (!literal) {
      errors.push({
        message: `Invalid numeric literal: ${text}`,
        location,
        severity: 'error',
        code: 'invalid-numeric-literal',
      });
    }
    
    return errors;
  }

  /**
   * Validate identifier names
   */
  static validateIdentifier(name: string, location: SourceLocation, type: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check identifier format
    if (!/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(name)) {
      errors.push({
        message: `Invalid ${type} name: ${name}. Must start with letter or underscore, contain only letters, numbers, underscores, dots, and hyphens`,
        location,
        severity: 'error',
        code: 'invalid-identifier',
      });
    }
    
    // Check for reserved keywords
    const reserved = ['param', 'space', 'bus', 'include', 'attach'];
    if (reserved.includes(name)) {
      errors.push({
        message: `${type} name cannot be a reserved keyword: ${name}`,
        location,
        severity: 'error',
        code: 'reserved-keyword',
      });
    }
    
    return errors;
  }
}
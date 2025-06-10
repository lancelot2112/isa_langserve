/**
 * Specialized parser for bit field specifications @(...)
 */

import { BitFieldNode, BitSpec, SourceLocation, ValidationError } from './types';
import { NumericParser } from '../utils/numeric-parser';

export class BitFieldParser {
  /**
   * Parse a bit field specification string like "@(16-20|11-15|0b00)"
   */
  static parseBitField(text: string, location: SourceLocation, containerSize: number): {
    bitField: BitFieldNode;
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];
    
    // Remove @( and )
    if (!text.startsWith('@(') || !text.endsWith(')')) {
      errors.push({
        message: 'Bit field must be enclosed in @(...)',
        location,
        severity: 'error',
        code: 'invalid-bitfield-syntax',
      });
      return {
        bitField: { type: 'bitField', location, text, specification: [] },
        errors,
      };
    }
    
    const inner = text.slice(2, -1).trim();
    const specification: BitSpec[] = [];
    
    // Split by | for concatenation
    const parts = this.splitBitFieldParts(inner);
    
    for (const part of parts) {
      const spec = this.parseBitFieldPart(part.trim(), containerSize);
      if (spec.error) {
        const errorCode = spec.error.includes('out of range') ? 'bit-index-out-of-range' : 'invalid-bitfield-part';
        errors.push({
          message: spec.error,
          location,
          severity: 'error',
          code: errorCode,
        });
      } else if (spec.bitSpec) {
        specification.push(spec.bitSpec);
      }
    }
    
    // Validate bit indices are within container size
    const validationErrors = this.validateBitIndices(specification, containerSize, location);
    errors.push(...validationErrors);
    
    return {
      bitField: {
        type: 'bitField',
        location,
        text,
        specification,
      },
      errors,
    };
  }

  /**
   * Split bit field parts by | while respecting nested structures
   */
  private static splitBitFieldParts(text: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (char === '(' || char === '[') {
        depth++;
      } else if (char === ')' || char === ']') {
        depth--;
      } else if (char === '|' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      parts.push(current.trim());
    }
    
    return parts;
  }

  /**
   * Parse a single bit field part
   */
  private static parseBitFieldPart(part: string, containerSize: number): {
    bitSpec?: BitSpec;
    error?: string;
  } {
    // Check for invalid characters first
    if (part.includes('&')) {
      return { error: `Invalid character '&' in bit field: ${part}` };
    }
    
    // Check for space after @ (common error)
    if (part.includes(' ')) {
      return { error: `Invalid space character in bit field: ${part}` };
    }
    
    // Sign extension: ?0 or ?1
    if (part.match(/^\?[01]$/)) {
      return {
        bitSpec: {
          type: 'signExtension',
          signBit: part[1] as '0' | '1',
        },
      };
    }
    
    // Invalid sign extension
    if (part.startsWith('?')) {
      if (part.length === 1) {
        return { error: `Incomplete sign extension: ${part}` };
      }
      const signChar = part[1];
      if (signChar !== '0' && signChar !== '1') {
        return { error: `Invalid sign extension option '${signChar}': must be 0 or 1` };
      }
    }
    
    // Binary literal: 0b...
    if (part.startsWith('0b')) {
      if (!/^0b[01]+$/.test(part)) {
        return { error: `Invalid binary literal: ${part}` };
      }
      return {
        bitSpec: {
          type: 'literal',
          value: part,
        },
      };
    }
    
    // Check for invalid range syntax
    if (part.includes('-')) {
      // Check for double dashes
      if (part.includes('--')) {
        return { error: `Invalid double dash in bit range: ${part}` };
      }
      
      // Check for invalid underscore instead of dash
      if (part.includes('_')) {
        return { error: `Invalid underscore in bit range: ${part}. Use dash (-) instead.` };
      }
      
      const dashIndex = part.indexOf('-');
      const startStr = part.slice(0, dashIndex).trim();
      const endStr = part.slice(dashIndex + 1).trim();
      
      const start = NumericParser.extractValue(startStr);
      const end = NumericParser.extractValue(endStr);
      
      if (start === null || end === null) {
        return { error: `Invalid bit range: ${part}` };
      }
      
      if (start < 0 || end < 0 || start >= containerSize || end >= containerSize) {
        return { error: `Bit index out of range (0-${containerSize - 1}): ${part}` };
      }
      
      // MSB 0 convention: start should be <= end for a valid range
      if (start > end) {
        return { error: `Invalid bit range (start > end): ${part}` };
      }
      
      return {
        bitSpec: {
          type: 'range',
          start,
          end,
        },
      };
    }
    
    // Check for double pipes
    if (part.includes('||')) {
      return { error: `Invalid double pipe in bit field: ${part}` };
    }
    
    // Single bit index
    const index = NumericParser.extractValue(part);
    if (index !== null) {
      if (index < 0 || index >= containerSize) {
        return { error: `Bit index out of range (0-${containerSize - 1}): ${part}` };
      }
      
      return {
        bitSpec: {
          type: 'index',
          start: index,
        },
      };
    }
    
    return { error: `Invalid bit field specification: ${part}` };
  }

  /**
   * Validate that bit indices are within the container size
   */
  private static validateBitIndices(
    specification: BitSpec[],
    containerSize: number,
    location: SourceLocation
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const spec of specification) {
      if (spec.type === 'range') {
        if (spec.start! >= containerSize || spec.end! >= containerSize) {
          errors.push({
            message: `Bit range ${spec.start}-${spec.end} exceeds container size (${containerSize} bits)`,
            location,
            severity: 'error',
            code: 'bit-index-out-of-range',
          });
        }
      } else if (spec.type === 'index') {
        if (spec.start! >= containerSize) {
          errors.push({
            message: `Bit index ${spec.start} exceeds container size (${containerSize} bits)`,
            location,
            severity: 'error',
            code: 'bit-index-out-of-range',
          });
        }
      }
    }
    
    return errors;
  }

  /**
   * Calculate the total width of a bit field specification
   */
  static calculateBitWidth(specification: BitSpec[]): number {
    let totalWidth = 0;
    
    for (const spec of specification) {
      switch (spec.type) {
        case 'range':
          totalWidth += Math.abs(spec.end! - spec.start!) + 1;
          break;
        case 'index':
          totalWidth += 1;
          break;
        case 'literal':
          if (spec.value?.startsWith('0b')) {
            totalWidth += spec.value.length - 2; // Remove '0b' prefix
          }
          break;
        case 'signExtension':
          // Sign extension doesn't add to the field width itself
          break;
      }
    }
    
    return totalWidth;
  }

  /**
   * Extract bit values from a container using the bit field specification
   */
  static extractBits(specification: BitSpec[], containerValue: number): number {
    let result = 0;
    let bitPosition = 0;
    
    for (const spec of specification) {
      switch (spec.type) {
        case 'range': {
          const start = spec.start!;
          const end = spec.end!;
          const width = Math.abs(end - start) + 1;
          
          // Extract bits from container (MSB 0 convention)
          const mask = ((1 << width) - 1) << (32 - end - 1);
          const extracted = (containerValue & mask) >>> (32 - end - 1);
          
          result |= extracted << bitPosition;
          bitPosition += width;
          break;
        }
        case 'index': {
          const index = spec.start!;
          const bit = (containerValue >>> (32 - index - 1)) & 1;
          result |= bit << bitPosition;
          bitPosition += 1;
          break;
        }
        case 'literal': {
          if (spec.value?.startsWith('0b')) {
            const literalValue = parseInt(spec.value.slice(2), 2);
            const width = spec.value.length - 2;
            result |= literalValue << bitPosition;
            bitPosition += width;
          }
          break;
        }
        case 'signExtension': {
          // Apply sign extension if the sign bit is set
          const signBit = spec.signBit === '1';
          if (signBit && bitPosition > 0) {
            // Check if the MSB of the current result is set
            const msb = (result >>> (bitPosition - 1)) & 1;
            if (msb) {
              // Sign extend to 32 bits
              const signExtMask = ~((1 << bitPosition) - 1);
              result |= signExtMask;
            }
          }
          break;
        }
      }
    }
    
    return result;
  }

  /**
   * Format a bit field specification for display
   */
  static formatBitField(specification: BitSpec[]): string {
    const parts = specification.map(spec => {
      switch (spec.type) {
        case 'range':
          return `${spec.start}-${spec.end}`;
        case 'index':
          return `${spec.start}`;
        case 'literal':
          return spec.value!;
        case 'signExtension':
          return `?${spec.signBit}`;
        default:
          return '';
      }
    });
    
    return `@(${parts.join('|')})`;
  }
}
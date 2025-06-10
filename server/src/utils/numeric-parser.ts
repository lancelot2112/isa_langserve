/**
 * Numeric literal parsing utilities
 */

import { NumericLiteral } from '../parser/types';

export class NumericParser {
  /**
   * Parse a numeric literal string into a NumericLiteral object
   */
  static parseNumericLiteral(text: string): NumericLiteral | null {
    const trimmed = text.trim();
    
    // Hexadecimal: 0x...
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      const hexPart = trimmed.slice(2);
      if (/^[0-9a-fA-F]+$/.test(hexPart)) {
        return {
          value: parseInt(hexPart, 16),
          base: 'hexadecimal',
          text: trimmed,
        };
      }
      return null;
    }
    
    // Binary: 0b...
    if (trimmed.startsWith('0b') || trimmed.startsWith('0B')) {
      const binPart = trimmed.slice(2);
      if (/^[01]+$/.test(binPart)) {
        return {
          value: parseInt(binPart, 2),
          base: 'binary',
          text: trimmed,
        };
      }
      return null;
    }
    
    // Octal: 0o...
    if (trimmed.startsWith('0o') || trimmed.startsWith('0O')) {
      const octPart = trimmed.slice(2);
      if (/^[0-7]+$/.test(octPart)) {
        return {
          value: parseInt(octPart, 8),
          base: 'octal',
          text: trimmed,
        };
      }
      return null;
    }
    
    // Decimal: plain digits
    if (/^[0-9]+$/.test(trimmed)) {
      return {
        value: parseInt(trimmed, 10),
        base: 'decimal',
        text: trimmed,
      };
    }
    
    return null;
  }

  /**
   * Validate that a numeric literal fits within a given bit width
   */
  static validateBitWidth(literal: NumericLiteral, bitWidth: number): boolean {
    const maxValue = (1 << bitWidth) - 1;
    return literal.value >= 0 && literal.value <= maxValue;
  }

  /**
   * Convert a numeric literal to a specific base
   */
  static convertToBase(
    literal: NumericLiteral, 
    targetBase: 'decimal' | 'hexadecimal' | 'binary' | 'octal'
  ): string {
    switch (targetBase) {
      case 'decimal':
        return literal.value.toString(10);
      case 'hexadecimal':
        return '0x' + literal.value.toString(16).toUpperCase();
      case 'binary':
        return '0b' + literal.value.toString(2);
      case 'octal':
        return '0o' + literal.value.toString(8);
      default:
        return literal.text;
    }
  }

  /**
   * Format a numeric literal for display with appropriate separators
   */
  static formatForDisplay(literal: NumericLiteral): string {
    switch (literal.base) {
      case 'hexadecimal':
        // Add underscores every 4 digits for readability
        const hex = literal.value.toString(16).toUpperCase();
        return '0x' + hex.replace(/(.{4})/g, '$1_').replace(/_$/, '');
      case 'binary':
        // Add underscores every 4 bits for readability
        const bin = literal.value.toString(2);
        return '0b' + bin.replace(/(.{4})/g, '$1_').replace(/_$/, '');
      case 'decimal':
        // Add commas for thousands separator
        return literal.value.toLocaleString();
      case 'octal':
        return '0o' + literal.value.toString(8);
      default:
        return literal.text;
    }
  }

  /**
   * Check if a string could be a numeric literal (for completion)
   */
  static isNumericLiteralPrefix(text: string): boolean {
    return /^(0x[0-9a-fA-F]*|0b[01]*|0o[0-7]*|[0-9]*)$/.test(text);
  }

  /**
   * Extract the numeric value from various formats, returning null if invalid
   */
  static extractValue(text: string): number | null {
    const literal = this.parseNumericLiteral(text);
    return literal ? literal.value : null;
  }
}
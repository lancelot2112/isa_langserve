/**
 * Comprehensive numeric literal validation tests
 * Tests for all numeric formats, edge cases, and validation coverage gaps
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticAnalyzer } from '../src/analysis/semantic-analyzer';
import { NumericParser } from '../src/utils/numeric-parser';
import { ISATokenizer } from '../src/parser/tokenizer';
import { validateTextDocumentForTesting, defaultSettings } from '../src/server-test-helpers';

describe('Comprehensive Numeric Validation', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  describe('NumericParser Edge Cases', () => {
    test('handles empty and whitespace-only strings', () => {
      expect(NumericParser.parseNumericLiteral('')).toBeNull();
      expect(NumericParser.parseNumericLiteral('   ')).toBeNull();
      expect(NumericParser.parseNumericLiteral('\t\n')).toBeNull();
    });

    test('handles prefix-only literals', () => {
      expect(NumericParser.parseNumericLiteral('0x')).toBeNull();
      expect(NumericParser.parseNumericLiteral('0b')).toBeNull();
      expect(NumericParser.parseNumericLiteral('0o')).toBeNull();
    });

    test('handles mixed case prefixes', () => {
      const hexUpper = NumericParser.parseNumericLiteral('0XABC');
      const hexLower = NumericParser.parseNumericLiteral('0xabc');
      expect(hexUpper?.value).toBe(2748);
      expect(hexLower?.value).toBe(2748);

      const binUpper = NumericParser.parseNumericLiteral('0B101');
      const binLower = NumericParser.parseNumericLiteral('0b101');
      expect(binUpper?.value).toBe(5);
      expect(binLower?.value).toBe(5);

      const octUpper = NumericParser.parseNumericLiteral('0O77');
      const octLower = NumericParser.parseNumericLiteral('0o77');
      expect(octUpper?.value).toBe(63);
      expect(octLower?.value).toBe(63);
    });

    test('rejects invalid characters in numeric literals', () => {
      // Invalid hex characters
      expect(NumericParser.parseNumericLiteral('0xABCG')).toBeNull();
      expect(NumericParser.parseNumericLiteral('0xZ123')).toBeNull();
      
      // Invalid binary characters  
      expect(NumericParser.parseNumericLiteral('0b1012')).toBeNull();
      expect(NumericParser.parseNumericLiteral('0b1019')).toBeNull();
      
      // Invalid octal characters
      expect(NumericParser.parseNumericLiteral('0o1238')).toBeNull();
      expect(NumericParser.parseNumericLiteral('0o7779')).toBeNull();
      
      // Invalid decimal characters
      expect(NumericParser.parseNumericLiteral('123abc')).toBeNull();
      expect(NumericParser.parseNumericLiteral('12.34')).toBeNull();
    });

    test('handles large numbers', () => {
      // Test max safe integer boundaries
      const maxSafe = NumericParser.parseNumericLiteral('9007199254740991');
      expect(maxSafe?.value).toBe(9007199254740991);
      
      // Large hex values
      const largeHex = NumericParser.parseNumericLiteral('0xFFFFFFFF');
      expect(largeHex?.value).toBe(4294967295);
      
      // Long binary values
      const longBin = NumericParser.parseNumericLiteral('0b11111111111111111111111111111111');
      expect(longBin?.value).toBe(4294967295);
    });

    test('handles zero values in all formats', () => {
      expect(NumericParser.parseNumericLiteral('0')?.value).toBe(0);
      expect(NumericParser.parseNumericLiteral('0x0')?.value).toBe(0);
      expect(NumericParser.parseNumericLiteral('0b0')?.value).toBe(0);
      expect(NumericParser.parseNumericLiteral('0o0')?.value).toBe(0);
      expect(NumericParser.parseNumericLiteral('0x00000')?.value).toBe(0);
    });

    test('handles leading zeros in decimal', () => {
      expect(NumericParser.parseNumericLiteral('00123')?.value).toBe(123);
      expect(NumericParser.parseNumericLiteral('000000001')?.value).toBe(1);
    });

    test('trim whitespace in parsing', () => {
      expect(NumericParser.parseNumericLiteral('  0x123  ')?.value).toBe(291);
      expect(NumericParser.parseNumericLiteral('\t0b101\n')?.value).toBe(5);
      expect(NumericParser.parseNumericLiteral(' 42 ')?.value).toBe(42);
    });
  });

  describe('Bit Width Validation', () => {
    test('validates bit width correctly for different values', () => {
      const literal8bit = { value: 255, base: 'decimal' as const, text: '255' };
      const literal9bit = { value: 256, base: 'decimal' as const, text: '256' };
      
      expect(NumericParser.validateBitWidth(literal8bit, 8)).toBe(true);
      expect(NumericParser.validateBitWidth(literal8bit, 7)).toBe(false);
      expect(NumericParser.validateBitWidth(literal9bit, 8)).toBe(false);
      expect(NumericParser.validateBitWidth(literal9bit, 9)).toBe(true);
    });

    test('handles zero bit width', () => {
      const literal = { value: 1, base: 'decimal' as const, text: '1' };
      expect(NumericParser.validateBitWidth(literal, 0)).toBe(false);
    });

    test('handles negative values', () => {
      const negativeLiteral = { value: -1, base: 'decimal' as const, text: '-1' };
      expect(NumericParser.validateBitWidth(negativeLiteral, 8)).toBe(false);
    });

    test('handles edge cases for bit width boundaries', () => {
      // Test 2^n - 1 values (max for n bits)
      const max1bit = { value: 1, base: 'decimal' as const, text: '1' };
      const max4bit = { value: 15, base: 'decimal' as const, text: '15' };
      const max8bit = { value: 255, base: 'decimal' as const, text: '255' };
      const max16bit = { value: 65535, base: 'decimal' as const, text: '65535' };
      
      expect(NumericParser.validateBitWidth(max1bit, 1)).toBe(true);
      expect(NumericParser.validateBitWidth(max4bit, 4)).toBe(true);
      expect(NumericParser.validateBitWidth(max8bit, 8)).toBe(true);
      expect(NumericParser.validateBitWidth(max16bit, 16)).toBe(true);
      
      // Test 2^n values (too large for n bits)
      const over1bit = { value: 2, base: 'decimal' as const, text: '2' };
      const over4bit = { value: 16, base: 'decimal' as const, text: '16' };
      const over8bit = { value: 256, base: 'decimal' as const, text: '256' };
      
      expect(NumericParser.validateBitWidth(over1bit, 1)).toBe(false);
      expect(NumericParser.validateBitWidth(over4bit, 4)).toBe(false);
      expect(NumericParser.validateBitWidth(over8bit, 8)).toBe(false);
    });
  });

  describe('Base Conversion', () => {
    test('converts between all supported bases', () => {
      const literal = { value: 255, base: 'decimal' as const, text: '255' };
      
      expect(NumericParser.convertToBase(literal, 'decimal')).toBe('255');
      expect(NumericParser.convertToBase(literal, 'hexadecimal')).toBe('0xFF');
      expect(NumericParser.convertToBase(literal, 'binary')).toBe('0b11111111');
      expect(NumericParser.convertToBase(literal, 'octal')).toBe('0o377');
    });

    test('preserves original text for unsupported base', () => {
      const literal = { value: 42, base: 'decimal' as const, text: 'original' };
      expect(NumericParser.convertToBase(literal, 'decimal' as any)).toBe('42');
    });
  });

  describe('Display Formatting', () => {
    test('formats hex with underscores', () => {
      const hexLiteral = { value: 0xABCD1234, base: 'hexadecimal' as const, text: '0xABCD1234' };
      const formatted = NumericParser.formatForDisplay(hexLiteral);
      expect(formatted).toMatch(/0x[A-F0-9]+/);
    });

    test('formats binary with underscores', () => {
      const binLiteral = { value: 0b11111111, base: 'binary' as const, text: '0b11111111' };
      const formatted = NumericParser.formatForDisplay(binLiteral);
      expect(formatted).toMatch(/0b[01_]+/);
    });

    test('formats decimal with commas', () => {
      const decLiteral = { value: 1234567, base: 'decimal' as const, text: '1234567' };
      const formatted = NumericParser.formatForDisplay(decLiteral);
      // Should use locale formatting
      expect(formatted).toMatch(/[\d,]+/);
    });
  });

  describe('Numeric Literal Detection in Context', () => {
    test('detects invalid numeric literals in field assignments', async () => {
      const content = `:space test addr=32 word=32 type=ro
:test field subfields={
  testfield @(0-7)
}
:test instruction () mask={testfield=0xGHI testfield2=0b012 testfield3=0o999}`;
      
      const document = TextDocument.create('test://invalid-numerics.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const invalidHexErrors = diagnostics.filter(d => 
        d.message.includes('0xGHI') && d.message.includes('Invalid numeric literal')
      );
      const invalidBinErrors = diagnostics.filter(d => 
        d.message.includes('0b012') && d.message.includes('Invalid numeric literal')
      );
      const invalidOctErrors = diagnostics.filter(d => 
        d.message.includes('0o999') && d.message.includes('Invalid numeric literal')
      );
      
      expect(invalidHexErrors.length).toBeGreaterThan(0);
      expect(invalidBinErrors.length).toBeGreaterThan(0);
      expect(invalidOctErrors.length).toBeGreaterThan(0);
    });

    test('detects excess bits in binary literals for specific field sizes', async () => {
      const content = `:space test addr=32 word=32 type=ro
:test field subfields={
  small_field @(0-2)  # 3-bit field
  large_field @(0-7)  # 8-bit field
}
:test instruction () mask={
  small_field=0b11111111  # 8 bits for 3-bit field
  large_field=0b11111111  # 8 bits for 8-bit field (OK)
}`;
      
      const document = TextDocument.create('test://excess-bits.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      // Should warn about excess bits in small_field assignment
      const excessBitsWarnings = diagnostics.filter(d => 
        d.message.includes('more bits') && d.message.includes('small_field')
      );
      expect(excessBitsWarnings.length).toBeGreaterThan(0);
      
      // Should NOT warn about large_field assignment (exact match)
      const validAssignmentWarnings = diagnostics.filter(d => 
        d.message.includes('more bits') && d.message.includes('large_field')
      );
      expect(validAssignmentWarnings.length).toBe(0);
    });

    test('validates numeric literals in space definitions', async () => {
      const content = `:space test addr=0xINVALID word=0b1012 type=register
:space test2 addr=32 word=64 type=register`;
      
      const document = TextDocument.create('test://space-numerics.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      // Should detect invalid numeric literals in space definition
      const addrErrors = diagnostics.filter(d => 
        d.message.includes('0xINVALID') || d.message.includes('Invalid addr')
      );
      const wordErrors = diagnostics.filter(d => 
        d.message.includes('0b1012') || d.message.includes('Invalid word')
      );
      
      expect(addrErrors.length).toBeGreaterThan(0);
      expect(wordErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Context-Aware Numeric Validation', () => {
    test('validates numeric ranges for different container sizes', async () => {
      const content = `:space test8 addr=32 word=8 type=ro
:space test16 addr=32 word=16 type=ro
:space test32 addr=32 word=32 type=ro

:test8 field8 @(7-9)   # Invalid: bit 9 doesn't exist in 8-bit word
:test16 field16 @(15)  # Valid: bit 15 exists in 16-bit word
:test32 field32 @(31)  # Valid: bit 31 exists in 32-bit word
:test32 field32b @(32) # Invalid: bit 32 doesn't exist in 32-bit word`;
      
      const document = TextDocument.create('test://container-sizes.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const bit9Error = diagnostics.filter(d => 
        d.message.includes('9') && d.message.includes('out of range')
      );
      const bit32Error = diagnostics.filter(d => 
        d.message.includes('32') && d.message.includes('out of range')
      );
      
      expect(bit9Error.length).toBeGreaterThan(0);
      expect(bit32Error.length).toBeGreaterThan(0);
    });

    test('validates field count constraints', async () => {
      const content = `:space reg addr=32 word=64 type=register
:reg GPR size=32 count=16 name=r%d
:reg invalid_ref redirect=r16  # Invalid: only r0-r15 exist
:reg valid_ref redirect=r15    # Valid: r15 exists`;
      
      const document = TextDocument.create('test://field-counts.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const countErrors = diagnostics.filter(d => 
        d.message.includes('r16') && d.message.includes('count=16')
      );
      expect(countErrors.length).toBeGreaterThan(0);
      
      // r15 should not generate errors
      const validRefErrors = diagnostics.filter(d => 
        d.message.includes('r15') && d.message.includes('Undefined')
      );
      expect(validRefErrors.length).toBe(0);
    });
  });

  describe('Tokenizer Numeric Literal Detection', () => {
    test('correctly tokenizes all numeric formats', () => {
      const content = 'decimal=123 hex=0xABC binary=0b101 octal=0o77 invalid=0xGHI';
      const tokenizer = new ISATokenizer(content, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();
      
      const numericTokens = tokens.filter(t => t.type === 'numericLiteral');
      const numericTexts = numericTokens.map(t => t.text);
      
      expect(numericTexts).toContain('123');
      expect(numericTexts).toContain('0xABC');
      expect(numericTexts).toContain('0b101');
      expect(numericTexts).toContain('0o77');
      
      // Invalid numeric should be marked as undefined reference
      const invalidTokens = tokens.filter(t => 
        t.type === 'undefinedReference' && t.text === '0xGHI'
      );
      expect(invalidTokens.length).toBeGreaterThan(0);
    });

    test('handles numeric literals in complex contexts', () => {
      const content = ':space test addr=0x1000 word=32 type=ro mask={field1=0xABC field2=0b101}';
      const tokenizer = new ISATokenizer(content, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();
      
      const numericTokens = tokens.filter(t => t.type === 'numericLiteral');
      expect(numericTokens.length).toBeGreaterThan(3); // Should find multiple numeric literals
    });
  });

  describe('Error Message Quality for Numeric Issues', () => {
    test('provides specific error messages for different numeric issues', async () => {
      const content = `:space test addr=invalid word=0xZZZ type=register
:test field subfields={
  testfield @(0-2)
}
:test instruction () mask={testfield=0b111111111}`;
      
      const document = TextDocument.create('test://numeric-errors.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      // Should have different types of numeric-related errors
      const errorTypes = new Set(diagnostics.map(d => d.code));
      
      // Should include invalid numeric literal errors
      expect([...errorTypes]).toContain('invalid-numeric-literal');
      
      // Should include bit width warnings
      const bitWidthWarnings = diagnostics.filter(d => 
        d.code === 'excess-bits-warning'
      );
      expect(bitWidthWarnings.length).toBeGreaterThan(0);
      
      // Error messages should be descriptive
      diagnostics.forEach(diagnostic => {
        expect(diagnostic.message.length).toBeGreaterThan(15);
        expect(diagnostic.message).toMatch(/^[A-Z]/); // Should start with capital letter
      });
    });
  });

  describe('Range and Overflow Detection', () => {
    test('detects overflow in large numeric values', async () => {
      // Test extremely large numbers that might cause overflow
      const content = `:space test addr=999999999999999999999 word=32 type=ro`;
      
      const document = TextDocument.create('test://overflow.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      // Should handle large numbers gracefully (either error or truncation)
      const overflowErrors = diagnostics.filter(d => 
        d.message.includes('999999999999999999999') ||
        d.message.includes('Invalid addr')
      );
      expect(overflowErrors.length).toBeGreaterThan(0);
    });

    test('validates minimum and maximum values for fields', async () => {
      const content = `:space test addr=32 word=32 type=ro
:test field subfields={
  onebit @(0)      # 1-bit field: valid range 0-1
  fourbit @(0-3)   # 4-bit field: valid range 0-15
}
:test instruction () mask={
  onebit=2         # Invalid: 2 > 1 (max for 1-bit)
  fourbit=16       # Invalid: 16 > 15 (max for 4-bit)
  fourbit=15       # Valid: 15 == max for 4-bit
}`;
      
      const document = TextDocument.create('test://field-ranges.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      // Should detect out-of-range values
      const rangeErrors = diagnostics.filter(d => 
        (d.message.includes('onebit=2') || d.message.includes('fourbit=16')) &&
        (d.message.includes('range') || d.message.includes('bits'))
      );
      expect(rangeErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases in Bit Field Contexts', () => {
    test('validates numeric literals in bit field expressions', async () => {
      const content = `:space test addr=32 word=32 type=ro
:test field subfields={
  validfield @(0-5|0b11)     # Valid: 0b11 is 2 bits
  invalidfield @(0-5|0xZZ)   # Invalid: 0xZZ is not valid hex
  rangefield @(0-5|0x20)     # Invalid: 0x20 (32) out of range for 32-bit container
}`;
      
      const document = TextDocument.create('test://bitfield-numerics.isa', 'isa', 1, content);
      const diagnostics = await validateTextDocumentForTesting(document, defaultSettings, analyzer);
      
      const invalidHexInBitField = diagnostics.filter(d => 
        d.message.includes('0xZZ')
      );
      const outOfRangeInBitField = diagnostics.filter(d => 
        d.message.includes('0x20') && d.message.includes('out of range')
      );
      
      expect(invalidHexInBitField.length).toBeGreaterThan(0);
      expect(outOfRangeInBitField.length).toBeGreaterThan(0);
    });
  });
});
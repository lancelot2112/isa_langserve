/**
 * Tests for ISA language parser components
 */

import { NumericParser } from '../src/utils/numeric-parser';
import { ISATokenizer } from '../src/parser/tokenizer';
import { BitFieldParser } from '../src/parser/bit-field-parser';
import { TokenType } from '../src/parser/types';

describe('NumericParser', () => {
  test('parses hexadecimal literals', () => {
    const result = NumericParser.parseNumericLiteral('0xABCD');
    expect(result).toEqual({
      value: 43981,
      base: 'hexadecimal',
      text: '0xABCD',
    });
  });

  test('parses binary literals', () => {
    const result = NumericParser.parseNumericLiteral('0b1010');
    expect(result).toEqual({
      value: 10,
      base: 'binary',
      text: '0b1010',
    });
  });

  test('parses octal literals', () => {
    const result = NumericParser.parseNumericLiteral('0o777');
    expect(result).toEqual({
      value: 511,
      base: 'octal',
      text: '0o777',
    });
  });

  test('parses decimal literals', () => {
    const result = NumericParser.parseNumericLiteral('123');
    expect(result).toEqual({
      value: 123,
      base: 'decimal',
      text: '123',
    });
  });

  test('returns null for invalid literals', () => {
    expect(NumericParser.parseNumericLiteral('0xGHI')).toBeNull();
    expect(NumericParser.parseNumericLiteral('0b012')).toBeNull();
    expect(NumericParser.parseNumericLiteral('0o999')).toBeNull();
    expect(NumericParser.parseNumericLiteral('abc')).toBeNull();
  });
});

describe('ISATokenizer', () => {
  test('tokenizes basic directive', () => {
    const content = ':param ENDIAN=big';
    const tokenizer = new ISATokenizer(content, {
      enableSemanticTokens: true,
      spaceTagColors: {},
    });
    const tokens = tokenizer.tokenize();
    
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0]?.type).toBe(TokenType.DIRECTIVE);
    expect(tokens[0]?.text).toBe(':param');
  });

  test('tokenizes space directive', () => {
    const content = ':space reg addr=32 word=64 type=register';
    const tokenizer = new ISATokenizer(content, {
      enableSemanticTokens: true,
      spaceTagColors: {},
    });
    const tokens = tokenizer.tokenize();
    
    const directiveToken = tokens.find(t => t.type === TokenType.DIRECTIVE);
    const spaceTagToken = tokens.find(t => t.type === TokenType.SPACE_TAG);
    
    expect(directiveToken?.text).toBe(':space');
    expect(spaceTagToken?.text).toBe('reg');
  });

  test('tokenizes field directive', () => {
    const content = ':reg GPR size=32 count=32';
    const tokenizer = new ISATokenizer(content, {
      enableSemanticTokens: true,
      spaceTagColors: {},
    });
    const tokens = tokenizer.tokenize();
    
    const spaceDirectiveToken = tokens.find(t => t.type === TokenType.SPACE_DIRECTIVE);
    expect(spaceDirectiveToken?.text).toBe(':reg');
  });

  test('tokenizes bit fields', () => {
    const content = '@(16-20|11-15)';
    const tokenizer = new ISATokenizer(content, {
      enableSemanticTokens: true,
      spaceTagColors: {},
    });
    const tokens = tokenizer.tokenize();
    
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.BIT_FIELD);
    expect(tokens[0]?.text).toBe('@(16-20|11-15)');
  });

  test('tokenizes comments', () => {
    const content = '# This is a comment';
    const tokenizer = new ISATokenizer(content, {
      enableSemanticTokens: true,
      spaceTagColors: {},
    });
    const tokens = tokenizer.tokenize();
    
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.COMMENT);
    expect(tokens[0]?.text).toBe('# This is a comment');
  });

  test('tokenizes quoted strings', () => {
    const content = 'descr="This is a description"';
    const tokenizer = new ISATokenizer(content, {
      enableSemanticTokens: true,
      spaceTagColors: {},
    });
    const tokens = tokenizer.tokenize();
    
    const quotedToken = tokens.find(t => t.type === TokenType.QUOTED_STRING);
    expect(quotedToken?.text).toBe('"This is a description"');
  });
});

describe('BitFieldParser', () => {
  test('parses simple bit range', () => {
    const result = BitFieldParser.parseBitField('@(16-20)', {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 8 },
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 8 },
      },
    }, 32);
    
    expect(result.errors).toHaveLength(0);
    expect(result.bitField.specification).toHaveLength(1);
    expect(result.bitField.specification[0]).toEqual({
      type: 'range',
      start: 16,
      end: 20,
    });
  });

  test('parses bit concatenation', () => {
    const result = BitFieldParser.parseBitField('@(16-20|11-15)', {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 14 },
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 14 },
      },
    }, 32);
    
    expect(result.errors).toHaveLength(0);
    expect(result.bitField.specification).toHaveLength(2);
    expect(result.bitField.specification[0]).toEqual({
      type: 'range',
      start: 16,
      end: 20,
    });
    expect(result.bitField.specification[1]).toEqual({
      type: 'range',
      start: 11,
      end: 15,
    });
  });

  test('parses bit literal', () => {
    const result = BitFieldParser.parseBitField('@(16-20|0b00)', {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 13 },
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 13 },
      },
    }, 32);
    
    expect(result.errors).toHaveLength(0);
    expect(result.bitField.specification).toHaveLength(2);
    expect(result.bitField.specification[1]).toEqual({
      type: 'literal',
      value: '0b00',
    });
  });

  test('detects out of range bit indices', () => {
    const result = BitFieldParser.parseBitField('@(35-40)', {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 8 },
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 8 },
      },
    }, 32);
    
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.code).toBe('bit-index-out-of-range');
  });

  test('calculates bit width correctly', () => {
    const specification = [
      { type: 'range' as const, start: 16, end: 20 },
      { type: 'range' as const, start: 11, end: 15 },
      { type: 'literal' as const, value: '0b00' },
    ];
    
    const width = BitFieldParser.calculateBitWidth(specification);
    expect(width).toBe(12); // 5 + 5 + 2
  });
});
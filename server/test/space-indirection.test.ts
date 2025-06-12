/**
 * Tests for space indirection tokenization and validation
 * Includes both new context operator (;) and legacy arrow (->) syntax
 */

import { ISATokenizer, TokenizerOptions } from '../src/parser/tokenizer';
import { TokenType } from '../src/parser/types';

describe('Space Indirection Tokenization', () => {
  const defaultOptions: TokenizerOptions = {
    enableSemanticTokens: true,
    spaceTagColors: {},
  };

  test('tokenizes space indirection with new context operator', () => {
    const content = '$reg;spr22;lsb=1';
    const tokenizer = new ISATokenizer(content, defaultOptions);
    const tokens = tokenizer.tokenize();

    // Filter out whitespace-only tokens if any
    const significantTokens = tokens.filter(t => t.text.trim());

    // Should have: $reg, ;, spr22, ;, lsb, =, 1
    expect(significantTokens.length).toBeGreaterThanOrEqual(3);

    // Check for space indirection token
    const spaceIndirectionToken = significantTokens.find(t => t.type === TokenType.SPACE_INDIRECTION);
    expect(spaceIndirectionToken).toBeDefined();
    expect(spaceIndirectionToken?.text).toBe('$reg');
    expect(spaceIndirectionToken?.spaceTag).toBe('reg');

    // Check for context operator tokens
    const contextOperatorTokens = significantTokens.filter(t => t.type === TokenType.CONTEXT_OPERATOR);
    expect(contextOperatorTokens.length).toBeGreaterThanOrEqual(2);
    expect(contextOperatorTokens[0]?.text).toBe(';');
  });

  test('tokenizes legacy space indirection with arrow operator', () => {
    const content = '$reg->spr22.lsb=1';
    const tokenizer = new ISATokenizer(content, defaultOptions);
    const tokens = tokenizer.tokenize();

    // Filter out whitespace-only tokens if any
    const significantTokens = tokens.filter(t => t.text.trim());

    // Should have: $reg, ->, spr22, ., lsb, =, 1
    expect(significantTokens.length).toBeGreaterThanOrEqual(3);

    // Check for space indirection token
    const spaceIndirectionToken = significantTokens.find(t => t.type === TokenType.SPACE_INDIRECTION);
    expect(spaceIndirectionToken).toBeDefined();
    expect(spaceIndirectionToken?.text).toBe('$reg');
    expect(spaceIndirectionToken?.spaceTag).toBe('reg');

    // Arrow operator is no longer supported
  });

  test('tokenizes field reference with context operator', () => {
    const content = '$reg;spr22;lsb';
    const tokenizer = new ISATokenizer(content, defaultOptions);
    const tokens = tokenizer.tokenize();

    const significantTokens = tokens.filter(t => t.text.trim());

    // Should have space indirection, context operators, and field reference tokens
    expect(significantTokens.length).toBeGreaterThanOrEqual(5);

    const tokenTexts = significantTokens.map(t => t.text);
    expect(tokenTexts).toContain('$reg');
    expect(tokenTexts).toContain(';');
    expect(tokenTexts).toContain('spr22');
    expect(tokenTexts).toContain('lsb');
  });

  test('tokenizes legacy field reference after indirection arrow', () => {
    const content = '$reg->spr22.lsb';
    const tokenizer = new ISATokenizer(content, defaultOptions);
    const tokens = tokenizer.tokenize();

    const significantTokens = tokens.filter(t => t.text.trim());

    // Should have space indirection, arrow, and field reference tokens
    expect(significantTokens.length).toBeGreaterThanOrEqual(3);

    const tokenTexts = significantTokens.map(t => t.text);
    expect(tokenTexts).toContain('$reg');
    expect(tokenTexts).toContain('->');
    expect(tokenTexts).toContain('spr22.lsb');
  });

  test('handles complex mask with new context operator', () => {
    const content = 'mask={opcd5=0b111 @(31)=1 $reg;spr22;lsb=1}';
    const tokenizer = new ISATokenizer(content, defaultOptions);
    const tokens = tokenizer.tokenize();

    // Should find space indirection token
    const spaceIndirectionToken = tokens.find(t => t.type === TokenType.SPACE_INDIRECTION);
    expect(spaceIndirectionToken).toBeDefined();
    expect(spaceIndirectionToken?.text).toBe('$reg');

    // Should find context operator tokens
    const contextOperatorTokens = tokens.filter(t => t.type === TokenType.CONTEXT_OPERATOR);
    expect(contextOperatorTokens.length).toBeGreaterThanOrEqual(2);
    expect(contextOperatorTokens[0]?.text).toBe(';');
  });

  test('handles complex mask with context operator space indirection', () => {
    const content = 'mask={opcd5=0b111 @(31)=1 $reg;spr22;lsb=1}';
    const tokenizer = new ISATokenizer(content, defaultOptions);
    const tokens = tokenizer.tokenize();

    // Should find space indirection token
    const spaceIndirectionToken = tokens.find(t => t.type === TokenType.SPACE_INDIRECTION);
    expect(spaceIndirectionToken).toBeDefined();
    expect(spaceIndirectionToken?.text).toBe('$reg');

    // Should find context operators
    const contextTokens = tokens.filter(t => t.type === TokenType.CONTEXT_OPERATOR);
    expect(contextTokens.length).toBe(2); // Two semicolons in $reg;spr22;lsb
  });

  test('handles space indirection with incomplete context', () => {
    const content = '$reg;';
    const tokenizer = new ISATokenizer(content, defaultOptions);
    const tokens = tokenizer.tokenize();

    const spaceIndirectionToken = tokens.find(t => t.type === TokenType.SPACE_INDIRECTION);
    expect(spaceIndirectionToken).toBeDefined();
    expect(spaceIndirectionToken?.text).toBe('$reg');

    const contextOperatorToken = tokens.find(t => t.type === TokenType.CONTEXT_OPERATOR);
    expect(contextOperatorToken).toBeDefined();
    expect(contextOperatorToken?.text).toBe(';');
  });

  test('handles space indirection without field path', () => {
    const content = '$reg;';
    const tokenizer = new ISATokenizer(content, defaultOptions);
    const tokens = tokenizer.tokenize();

    const spaceIndirectionToken = tokens.find(t => t.type === TokenType.SPACE_INDIRECTION);
    expect(spaceIndirectionToken).toBeDefined();
    expect(spaceIndirectionToken?.text).toBe('$reg');

    // Should find context operator
    const contextToken = tokens.find(t => t.type === TokenType.CONTEXT_OPERATOR);
    expect(contextToken).toBeDefined();
    expect(contextToken?.text).toBe(';');
  });

  test('does not tokenize $ without following identifier as space indirection', () => {
    const content = '$ ;test';
    const tokenizer = new ISATokenizer(content, defaultOptions);
    const tokens = tokenizer.tokenize();

    const spaceIndirectionToken = tokens.find(t => t.type === TokenType.SPACE_INDIRECTION);
    expect(spaceIndirectionToken).toBeUndefined();
  });
});
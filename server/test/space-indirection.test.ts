/**
 * Tests for space indirection tokenization and validation
 */

import { ISATokenizer, TokenizerOptions } from '../src/parser/tokenizer';
import { TokenType } from '../src/parser/types';

describe('Space Indirection Tokenization', () => {
  const defaultOptions: TokenizerOptions = {
    enableSemanticTokens: true,
    spaceTagColors: {},
  };

  test('tokenizes space indirection with $ prefix', () => {
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

    // Check for indirection arrow token
    const arrowToken = significantTokens.find(t => t.type === TokenType.INDIRECTION_ARROW);
    expect(arrowToken).toBeDefined();
    expect(arrowToken?.text).toBe('->');
  });

  test('tokenizes field reference after indirection arrow', () => {
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

  test('handles complex mask with space indirection', () => {
    const content = 'mask={opcd5=0b111 @(31)=1 $reg->spr22.lsb=1}';
    const tokenizer = new ISATokenizer(content, defaultOptions);
    const tokens = tokenizer.tokenize();

    // Should find space indirection token
    const spaceIndirectionToken = tokens.find(t => t.type === TokenType.SPACE_INDIRECTION);
    expect(spaceIndirectionToken).toBeDefined();
    expect(spaceIndirectionToken?.text).toBe('$reg');

    // Should find indirection arrow
    const arrowToken = tokens.find(t => t.type === TokenType.INDIRECTION_ARROW);
    expect(arrowToken).toBeDefined();
    expect(arrowToken?.text).toBe('->');
  });

  test('handles space indirection without field path', () => {
    const content = '$reg->';
    const tokenizer = new ISATokenizer(content, defaultOptions);
    const tokens = tokenizer.tokenize();

    const spaceIndirectionToken = tokens.find(t => t.type === TokenType.SPACE_INDIRECTION);
    expect(spaceIndirectionToken).toBeDefined();
    expect(spaceIndirectionToken?.text).toBe('$reg');

    const arrowToken = tokens.find(t => t.type === TokenType.INDIRECTION_ARROW);
    expect(arrowToken).toBeDefined();
    expect(arrowToken?.text).toBe('->');
  });

  test('does not tokenize $ without following identifier as space indirection', () => {
    const content = '$ ->test';
    const tokenizer = new ISATokenizer(content, defaultOptions);
    const tokens = tokenizer.tokenize();

    const spaceIndirectionToken = tokens.find(t => t.type === TokenType.SPACE_INDIRECTION);
    expect(spaceIndirectionToken).toBeUndefined();
  });
});
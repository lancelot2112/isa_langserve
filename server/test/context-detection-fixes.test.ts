/**
 * Tests for context detection fixes
 * Validates instruction tags with periods and field redirects with special characters
 */

import { ISATokenizer } from '../src/parser/tokenizer';
import { TokenType } from '../src/parser/types';

describe('Context Detection Fixes', () => {
  describe('Instruction tags with periods', () => {
    test('instruction with period should be tokenized as instructionTag when followed by operands', () => {
      const content = ':other insn32bit. (overlap,AA) mask={opcd5=0b111}';
      const tokenizer = new ISATokenizer(content, { enableSemanticTokens: true, spaceTagColors: {} });
      const tokens = tokenizer.tokenize();
      
      const instructionToken = tokens.find(t => t.text === 'insn32bit.');
      expect(instructionToken?.type).toBe(TokenType.INSTRUCTION_TAG);
    });

    test('instruction with multiple periods should be tokenized correctly', () => {
      const content = ':other test.insn.v2. (operand) mask={}';
      const tokenizer = new ISATokenizer(content, { enableSemanticTokens: true, spaceTagColors: {} });
      const tokens = tokenizer.tokenize();
      
      const instructionToken = tokens.find(t => t.text === 'test.insn.v2.');
      expect(instructionToken?.type).toBe(TokenType.INSTRUCTION_TAG);
    });

    test('field with period should remain as fieldTag when not followed by operands', () => {
      const content = ':other field.name size=32';
      const tokenizer = new ISATokenizer(content, { enableSemanticTokens: true, spaceTagColors: {} });
      const tokens = tokenizer.tokenize();
      
      const fieldToken = tokens.find(t => t.text === 'field.name');
      expect(fieldToken?.type).toBe(TokenType.FIELD_TAG);
    });

    test('explicit instruction directive with period should work', () => {
      const content = ':insn add.w mask={opcode=0x12}';
      const tokenizer = new ISATokenizer(content, { enableSemanticTokens: true, spaceTagColors: {} });
      const tokens = tokenizer.tokenize();
      
      const instructionToken = tokens.find(t => t.text === 'add.w');
      expect(instructionToken?.type).toBe(TokenType.INSTRUCTION_TAG);
    });
  });

  describe('Field redirects with special characters', () => {
    test('field redirect with periods and hyphens should be parsed correctly', () => {
      const content = ':reg FIELD redirect=Te-S_T.;F';
      const tokenizer = new ISATokenizer(content, { enableSemanticTokens: true, spaceTagColors: {} });
      const tokens = tokenizer.tokenize();
      
      const fieldRefToken = tokens.find(t => t.text === 'Te-S_T.');
      expect(fieldRefToken?.type).toBe(TokenType.FIELD_REFERENCE);
      expect(fieldRefToken?.text).toBe('Te-S_T.');
      
      const subfieldToken = tokens.find(t => t.text === 'F');
      expect(subfieldToken?.type).toBe(TokenType.FIELD_REFERENCE);
    });

    test('complex field names with underscores and periods should work', () => {
      const content = ':reg test redirect=My_Field.Sub_2.;subfld';
      const tokenizer = new ISATokenizer(content, { enableSemanticTokens: true, spaceTagColors: {} });
      const tokens = tokenizer.tokenize();
      
      const fieldRefToken = tokens.find(t => t.text === 'My_Field.Sub_2.');
      expect(fieldRefToken?.type).toBe(TokenType.FIELD_REFERENCE);
      expect(fieldRefToken?.text).toBe('My_Field.Sub_2.');
    });
  });

  describe('Context detection edge cases', () => {
    test('instruction detection should work with extra whitespace', () => {
      const content = ':other  insn.test   (op1, op2)   mask={}';
      const tokenizer = new ISATokenizer(content, { enableSemanticTokens: true, spaceTagColors: {} });
      const tokens = tokenizer.tokenize();
      
      const instructionToken = tokens.find(t => t.text === 'insn.test');
      expect(instructionToken?.type).toBe(TokenType.INSTRUCTION_TAG);
    });

    test('field definition should not be confused with instruction', () => {
      const content = ':reg field.name size=16 subfields={}';
      const tokenizer = new ISATokenizer(content, { enableSemanticTokens: true, spaceTagColors: {} });
      const tokens = tokenizer.tokenize();
      
      const fieldToken = tokens.find(t => t.text === 'field.name');
      expect(fieldToken?.type).toBe(TokenType.FIELD_TAG);
    });

    test('indexed field with periods should work correctly', () => {
      const content = ':reg SPR.test[0-1023] offset=0x1000';
      const tokenizer = new ISATokenizer(content, { enableSemanticTokens: true, spaceTagColors: {} });
      const tokens = tokenizer.tokenize();
      
      const fieldToken = tokens.find(t => t.text === 'SPR.test');
      expect(fieldToken?.type).toBe(TokenType.FIELD_TAG);
    });
  });
});
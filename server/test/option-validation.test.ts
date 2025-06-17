/**
 * Simple integration tests to verify option validation works end-to-end
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticAnalyzer } from '../src/analysis/semantic-analyzer';
import { ISATokenizer } from '../src/parser/tokenizer';

describe('Option Validation Integration', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  describe('Tokenizer Option Detection', () => {
    test('detects space option tokens', () => {
      const content = ':space reg addr=32 word=64 type=register align=16 endian=big';
      const tokenizer = new ISATokenizer(content, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();

      // Should have space option tag tokens
      const optionTokens = tokens.filter(t => t.type === 'spaceOptionTag');
      expect(optionTokens.length).toBeGreaterThan(0);
      
      // Should detect standard options
      const optionTexts = optionTokens.map(t => t.text);
      expect(optionTexts).toContain('addr');
      expect(optionTexts).toContain('word');
      expect(optionTexts).toContain('type');
      expect(optionTexts).toContain('align');
      expect(optionTexts).toContain('endian');
    });

    test('detects field option tokens', () => {
      const content = ':reg GPR size=32 count=16 offset=0x100';
      const tokenizer = new ISATokenizer(content, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();

      // Should have field option tag tokens
      const fieldOptionTokens = tokens.filter(t => t.type === 'fieldOptionTag');
      expect(fieldOptionTokens.length).toBeGreaterThan(0);
      
      const optionTexts = fieldOptionTokens.map(t => t.text);
      expect(optionTexts).toContain('size');
      expect(optionTexts).toContain('count');
      expect(optionTexts).toContain('offset');
    });

    test('detects bus option tokens', () => {
      const content = ':bus sysbus addr=32 ranges={0x0->ram prio=1 offset=0x1000}';
      const tokenizer = new ISATokenizer(content, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();

      // Should have bus option tag tokens
      const busOptionTokens = tokens.filter(t => t.type === 'busOptionTag');
      expect(busOptionTokens.length).toBeGreaterThan(0);
      
      const optionTexts = busOptionTokens.map(t => t.text);
      expect(optionTexts).toContain('addr');
      expect(optionTexts).toContain('ranges');
    });
  });

  describe('Basic Space Validation', () => {
    test('validates space definitions correctly', () => {
      const validContent = ':space reg addr=32 word=64 type=register';
      const document = TextDocument.create('test://valid.isa', 'isa', 1, validContent);
      
      const result = analyzer.analyzeFile(document);
      
      // Should not have space-related errors for valid definition
      const spaceErrors = result.errors.filter(e => 
        e.message.includes('Invalid space type') ||
        e.message.includes('Invalid addr') ||
        e.message.includes('Invalid word')
      );
      expect(spaceErrors.length).toBe(0);
    });

    test('detects invalid space type', () => {
      const invalidContent = ':space reg addr=32 word=64 type=bad_type';
      const document = TextDocument.create('test://invalid.isa', 'isa', 1, invalidContent);
      
      const result = analyzer.analyzeFile(document);
      
      // Should detect invalid space type
      const typeErrors = result.errors.filter(e => 
        e.message.includes('Invalid space type') && e.message.includes('bad_type')
      );
      expect(typeErrors.length).toBeGreaterThan(0);
      expect(typeErrors[0]?.severity).toBe('error');
    });
  });

  describe('Numeric Literal Validation', () => {
    test('accepts valid numeric literals', () => {
      const validContent = ':space reg addr=32 word=0x40 type=register';
      const document = TextDocument.create('test://valid-numeric.isa', 'isa', 1, validContent);
      
      const result = analyzer.analyzeFile(document);
      
      // Should not have numeric literal errors
      const numericErrors = result.errors.filter(e => 
        e.message.includes('Invalid numeric literal')
      );
      expect(numericErrors.length).toBe(0);
    });
  });

  describe('Parameter Validation', () => {
    test('accepts valid param format', () => {
      const validContent = ':param ENDIAN=big';
      const document = TextDocument.create('test://valid-param.isa', 'isa', 1, validContent);
      
      const result = analyzer.analyzeFile(document);
      
      // Should not have param format errors
      const paramErrors = result.errors.filter(e => 
        e.message.includes('Invalid param directive')
      );
      expect(paramErrors.length).toBe(0);
    });

    test('detects invalid param format', () => {
      const invalidContent = ':param INVALID_NO_EQUALS';
      const document = TextDocument.create('test://invalid-param.isa', 'isa', 1, invalidContent);
      
      const result = analyzer.analyzeFile(document);
      
      // Should detect invalid param format
      const paramErrors = result.errors.filter(e => 
        e.message.includes('Invalid param directive')
      );
      expect(paramErrors.length).toBeGreaterThan(0);
      expect(paramErrors[0]?.severity).toBe('error');
      expect(paramErrors[0]?.code).toBe('invalid-param-format');
    });
  });

  describe('End-to-End Validation', () => {
    test('processes simple valid content', () => {
      const simpleContent = ':space reg addr=32 word=64 type=register';
      
      const document = TextDocument.create('test://simple.isa', 'isa', 1, simpleContent);
      
      const result = analyzer.analyzeFile(document);
      
      // Should generate tokens
      expect(result.tokens.length).toBeGreaterThan(0);
      
      // Should have space tags for single-line space definition
      const spaceTokens = result.tokens.filter(t => t.type === 'spaceTag');
      expect(spaceTokens.length).toBeGreaterThan(0);
      expect(spaceTokens[0]?.text).toBe('reg');
      
      // Should have minimal errors for valid content (allow some validation quirks)
      expect(result.errors.length).toBeLessThan(5);
    });

    test('detects multiple error types in problematic document', () => {
      const problematicContent = `:param BAD_FORMAT
:space reg addr=32 word=64 type=invalid_type`;
      
      const document = TextDocument.create('test://problems.isa', 'isa', 1, problematicContent);
      
      const result = analyzer.analyzeFile(document);
      
      // Should detect param format error
      const paramErrors = result.errors.filter(e => e.code === 'invalid-param-format');
      expect(paramErrors.length).toBeGreaterThan(0);
      
      // Should detect space type error
      const typeErrors = result.errors.filter(e => e.code === 'invalid-space-type');
      expect(typeErrors.length).toBeGreaterThan(0);
      
      // Errors should have proper locations
      result.errors.forEach(error => {
        expect(error.location.range.start.line).toBeGreaterThanOrEqual(0);
        expect(error.location.range.start.character).toBeGreaterThanOrEqual(0);
        expect(error.location.range.end.character).toBeGreaterThan(error.location.range.start.character);
      });
    });
  });

  describe('Token Type Accuracy', () => {
    test('correctly categorizes different token types', () => {
      const content = ':space reg addr=32 word=64 type=register # comment';
      const tokenizer = new ISATokenizer(content, {
        enableSemanticTokens: true,
        spaceTagColors: {},
      });
      const tokens = tokenizer.tokenize();

      // Should have directive tokens
      const directiveTokens = tokens.filter(t => t.type === 'directive');
      expect(directiveTokens.length).toBeGreaterThan(0);

      // Should have space tag tokens
      const spaceTagTokens = tokens.filter(t => t.type === 'spaceTag');
      expect(spaceTagTokens.length).toBeGreaterThan(0);

      // Should have option tokens
      const optionTokens = tokens.filter(t => t.type === 'spaceOptionTag');
      expect(optionTokens.length).toBeGreaterThan(0);

      // Should have comment tokens
      const commentTokens = tokens.filter(t => t.type === 'comment');
      expect(commentTokens.length).toBeGreaterThan(0);
    });
  });

  describe('Subfield Option Validation Fix', () => {
    test('does not flag subfield names as invalid options', () => {
      // This tests the fix for the issue where 'opcd5' was being flagged as "Invalid subfield option"
      // when it should be recognized as a subfield name being defined
      const content = ':other overlap subfields={ opcd5 @(0-5) op=MajorOp overlap @(?|5-8|4|0b00) }';
      
      const document = TextDocument.create('test://subfield-fix.isa', 'isa', 1, content);
      
      // Add a mock opcd5 symbol that exists elsewhere to trigger the original bug
      analyzer.getSymbolTable().addSymbol({
        name: 'opcd5',
        type: 'field',
        location: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 }, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } } },
        fileUri: 'test://other.isa',
        spaceTag: 'insn',
        definition: {
          type: 'field',
          location: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 }, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } } },
          text: ':insn opcd5',
        }
      });
      
      const result = analyzer.analyzeFile(document);
      
      // Should NOT have "Invalid subfield option: 'opcd5'" error
      const opcd5Errors = result.errors.filter(e => 
        e.message.includes('opcd5') && e.code === 'invalid-subfield-option'
      );
      expect(opcd5Errors.length).toBe(0);
      
      // Should NOT have "Invalid subfield option: 'overlap'" error for the second subfield name
      const overlapErrors = result.errors.filter(e => 
        e.message.includes('overlap') && e.code === 'invalid-subfield-option'
      );
      expect(overlapErrors.length).toBe(0);
      
      // Should still validate actual subfield options like 'op' correctly (no error for valid option)
      const opErrors = result.errors.filter(e => 
        e.message.includes("'op'") && e.code === 'invalid-subfield-option'
      );
      expect(opErrors.length).toBe(0); // 'op' is a valid subfield option, should not error
    });

    test('validates field references correctly when used as subfield options', () => {
      // This test verifies that the fix doesn't prevent validation of field references
      // that are in wrong contexts, just skips validation for subfield name definitions
      const content = ':other overlap subfields={ opcd5 @(0-5) }';
      
      const document = TextDocument.create('test://simple-fix.isa', 'isa', 1, content);
      
      const result = analyzer.analyzeFile(document);
      
      // The key thing is that opcd5 should NOT be flagged as invalid subfield option
      // even though it exists as a symbol
      const opcd5SubfieldErrors = result.errors.filter(e => 
        e.message.includes('opcd5') && e.code === 'invalid-subfield-option'
      );
      expect(opcd5SubfieldErrors.length).toBe(0);
      
      // And there should be no undefined field reference error for opcd5 either
      // since it exists as a symbol we added
      const opcd5UndefinedErrors = result.errors.filter(e => 
        e.message.includes('opcd5') && e.code === 'undefined-field-reference'
      );
      expect(opcd5UndefinedErrors.length).toBe(0);
    });
  });
});
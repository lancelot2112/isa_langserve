/**
 * Tests for the new context operator (;) functionality
 * 
 * This test suite verifies that the new semicolon context operator
 * works correctly for field;subfield and $space;field;subfield syntax.
 */

import { SemanticAnalyzer } from '../src/analysis/semantic-analyzer';
import { ISATokenizer, TokenizerOptions } from '../src/parser/tokenizer';
import { TokenType } from '../src/parser/types';
import { TextDocument } from 'vscode-languageserver-textdocument';

describe('Context Operator Tests', () => {
  let analyzer: SemanticAnalyzer;
  const defaultOptions: TokenizerOptions = {
    enableSemanticTokens: true,
    spaceTagColors: {},
  };

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  describe('Tokenization Tests', () => {
    test('tokenizes semicolon as context operator', () => {
      const content = 'field;subfield';
      const tokenizer = new ISATokenizer(content, defaultOptions);
      const tokens = tokenizer.tokenize();

      const contextOperatorTokens = tokens.filter(t => t.type === TokenType.CONTEXT_OPERATOR);
      expect(contextOperatorTokens.length).toBe(1);
      expect(contextOperatorTokens[0]?.text).toBe(';');
    });

    test('tokenizes complex context chain', () => {
      const content = '$reg;field;subfield';
      const tokenizer = new ISATokenizer(content, defaultOptions);
      const tokens = tokenizer.tokenize();

      const spaceIndirectionToken = tokens.find(t => t.type === TokenType.SPACE_INDIRECTION);
      expect(spaceIndirectionToken).toBeDefined();
      expect(spaceIndirectionToken?.text).toBe('$reg');

      const contextOperatorTokens = tokens.filter(t => t.type === TokenType.CONTEXT_OPERATOR);
      expect(contextOperatorTokens.length).toBe(2);
      expect(contextOperatorTokens[0]?.text).toBe(';');
      expect(contextOperatorTokens[1]?.text).toBe(';');
    });

    test('tokenizes mixed context in mask assignment', () => {
      const content = 'mask={field1=0b101 $space;field2;sub=1}';
      const tokenizer = new ISATokenizer(content, defaultOptions);
      const tokens = tokenizer.tokenize();

      const spaceIndirectionToken = tokens.find(t => t.type === TokenType.SPACE_INDIRECTION);
      expect(spaceIndirectionToken).toBeDefined();
      expect(spaceIndirectionToken?.text).toBe('$space');

      const contextOperatorTokens = tokens.filter(t => t.type === TokenType.CONTEXT_OPERATOR);
      expect(contextOperatorTokens.length).toBe(2);
    });
  });

  describe('Validation Tests', () => {
    test('validates field;subfield redirect references', () => {
      const content = `:space reg addr=32 word=64 type=register

:reg SPR size=64 count=1024 name="spr%d"
subfields={
    msb @(0-31)
    lsb @(32-63)
}

:reg CONTEXT_REDIRECT redirect=spr22;lsb`;

      const document = TextDocument.create('test://context-alias.isa', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);

      // Should pass without errors
      
      // Should not have any errors for valid context reference
      const undefinedErrors = result.errors.filter(e => 
        e.code === 'undefined-field-reference' || e.code === 'undefined-subfield'
      );
      expect(undefinedErrors.length).toBe(0);
    });

    test('validates $space;field;subfield references', () => {
      const content = `:space reg addr=32 word=64 type=register
:space insn addr=32 word=32 type=rw

:reg SPR size=64 count=1024 name="spr%d"
subfields={
    msb @(0-31)
    lsb @(32-63)
}

:insn testinsn () mask={$reg;spr22;lsb=1}`;

      const document = TextDocument.create('test://context-space.isa', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);

      // Should pass without errors

      // Should not have any errors for valid space context reference
      const undefinedErrors = result.errors.filter(e => 
        e.code === 'undefined-field-reference' || e.code === 'undefined-subfield'
      );
      expect(undefinedErrors.length).toBe(0);
    });

    test('detects undefined field in context chain', () => {
      const content = `:space reg addr=32 word=64 type=register

:reg SPR size=64 count=1024 name="spr%d"
subfields={
    msb @(0-31)
    lsb @(32-63)
}

:reg BAD_REDIRECT redirect=undefined_field;lsb`;

      const document = TextDocument.create('test://context-undefined.isa', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);

      // Should have an error for undefined field
      const undefinedFieldErrors = result.errors.filter(e => 
        e.code === 'undefined-field-reference' && e.message.includes('undefined_field')
      );
      expect(undefinedFieldErrors.length).toBeGreaterThan(0);
    });

    test('detects undefined subfield in context chain', () => {
      const content = `:space reg addr=32 word=64 type=register

:reg SPR size=64 count=1024 name="spr%d"
subfields={
    msb @(0-31)
    lsb @(32-63)
}

:reg BAD_REDIRECT redirect=spr22;undefined_sub`;

      const document = TextDocument.create('test://context-undefined-sub.isa', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);

      // Should have an error for undefined subfield
      const undefinedSubfieldErrors = result.errors.filter(e => 
        e.code === 'undefined-subfield' && e.message.includes('undefined_sub')
      );
      expect(undefinedSubfieldErrors.length).toBeGreaterThan(0);
    });

    test('validates context operator in instruction operands', () => {
      const content = `:space reg addr=32 word=64 type=register
:space insn addr=32 word=32 type=rw

:reg SPR size=64 count=1024 name="spr%d"
subfields={
    msb @(0-31)
    lsb @(32-63)
}

:insn move_insn ($reg;spr22;lsb, dest)`;

      const document = TextDocument.create('test://context-operand.isa', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);

      // Should not have errors for valid space-redirected context reference
      const undefinedErrors = result.errors.filter(e => 
        e.code === 'undefined-field-reference' && e.message.includes('spr22')
      );
      expect(undefinedErrors.length).toBe(0);
    });
  });

  describe('Breaking Change Tests', () => {
    test('rejects legacy period syntax with clear error', () => {
      const content = `:space reg addr=32 word=64 type=register

:reg SPR size=64 count=1024 name="spr%d"
subfields={
    msb @(0-31)
    lsb @(32-63)
}

:reg LEGACY_REDIRECT redirect=spr22.lsb`;

      const document = TextDocument.create('test://legacy-rejected.isa', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);

      // Should have syntax errors for legacy syntax
      const syntaxErrors = result.errors.filter(e => 
        e.code === 'invalid-syntax'
      );
      expect(syntaxErrors.length).toBeGreaterThan(0);
    });

    test('rejects legacy arrow syntax completely', () => {
      const content = `:space reg addr=32 word=64 type=register
:space insn addr=32 word=32 type=rw

:reg SPR size=64 count=1024 name="spr%d"
subfields={
    msb @(0-31)
    lsb @(32-63)
}

:insn legacy_insn () mask={$reg->spr22=1}`;

      const document = TextDocument.create('test://legacy-arrow-rejected.isa', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);

      // Should have undefined reference errors (arrow operator no longer supported)
      const undefinedErrors = result.errors.filter(e => 
        e.code === 'undefined-field-reference' && e.message.includes('spr22')
      );
      expect(undefinedErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Grammar Tests', () => {
    test('parses context operator in operation types', () => {
      const content = `:space reg addr=32 word=64 type=register
:space insn addr=32 word=32 type=rw

:reg GPR count=32 name=r%d

:insn subfields={
    rA @(11-15) op=reg;GPR
}`;

      const document = TextDocument.create('test://context-op-type.isa', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);

      // Should parse without syntax errors
      const syntaxErrors = result.errors.filter(e => 
        e.severity === 'error' && e.message.includes('syntax')
      );
      expect(syntaxErrors.length).toBe(0);
    });
  });
});
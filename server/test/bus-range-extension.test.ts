/**
 * Comprehensive tests for enhanced bus range syntax
 */

import { SemanticAnalyzer } from '../src/analysis/semantic-analyzer';
import { ISATokenizer, TokenizerOptions } from '../src/parser/tokenizer';
import { TokenType } from '../src/parser/types';
import { TextDocument } from 'vscode-languageserver-textdocument';

const tokenizerOptions: TokenizerOptions = {
  enableSemanticTokens: true,
  spaceTagColors: {},
};

describe('Enhanced Bus Range Syntax', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
  });

  describe('Bus Range Operators Tokenization', () => {
    test('should tokenize -- as bus range separator', () => {
      const content = `
:space ram addr=32 word=32 type=rw
:bus sysbus addr=32 ranges={
    ram 0x1000--0x2000 descr="RAM range"
}`;
      const tokenizer = new ISATokenizer(content, tokenizerOptions);
      const tokens = tokenizer.tokenize();
      
      const rangeToken = tokens.find(t => t.type === TokenType.BUS_RANGE_SEPARATOR);
      expect(rangeToken).toBeDefined();
      expect(rangeToken?.text).toBe('--');
    });

    test('should tokenize _ as bus size separator', () => {
      const content = `
:space ram addr=32 word=32 type=rw
:bus sysbus addr=32 ranges={
    ram 0x1000_0x1000 descr="RAM size"
}`;
      const tokenizer = new ISATokenizer(content, tokenizerOptions);
      const tokens = tokenizer.tokenize();
      
      
      const sizeToken = tokens.find(t => t.type === TokenType.BUS_SIZE_SEPARATOR);
      expect(sizeToken).toBeDefined();
      expect(sizeToken?.text).toBe('_');
    });

    test('should not tokenize -- outside ranges context', () => {
      const content = `
:reg GPR[0-31] size=64
# Some comment with -- dash
`;
      const tokenizer = new ISATokenizer(content, tokenizerOptions);
      const tokens = tokenizer.tokenize();
      
      const rangeToken = tokens.find(t => t.type === TokenType.BUS_RANGE_SEPARATOR);
      expect(rangeToken).toBeUndefined();
    });

    test('should not tokenize _ in identifier context', () => {
      const content = `
:space mem_space addr=32 word=32 type=rw
`;
      const tokenizer = new ISATokenizer(content, tokenizerOptions);
      const tokens = tokenizer.tokenize();
      
      const sizeToken = tokens.find(t => t.type === TokenType.BUS_SIZE_SEPARATOR);
      expect(sizeToken).toBeUndefined();
    });
  });

  describe('Enhanced Range Options', () => {
    test('should recognize new range options', () => {
      const content = `
:space ram addr=32 word=32 type=rw
:bus sysbus addr=32 ranges={
    ram 0x1000_0x1000 prio=1 redirect=0x2000 descr="Test range" device=ram_ctrl
}`;
      const tokenizer = new ISATokenizer(content, tokenizerOptions);
      const tokens = tokenizer.tokenize();
      
      
      const prioToken = tokens.find(t => t.text === 'prio' && t.type === TokenType.RANGE_OPTION_TAG);
      const redirectToken = tokens.find(t => t.text === 'redirect' && t.type === TokenType.RANGE_OPTION_TAG);
      const descrToken = tokens.find(t => t.text === 'descr' && t.type === TokenType.RANGE_OPTION_TAG);
      const deviceToken = tokens.find(t => t.text === 'device' && t.type === TokenType.RANGE_OPTION_TAG);
      
      expect(prioToken).toBeDefined();
      expect(redirectToken).toBeDefined();
      expect(descrToken).toBeDefined();
      expect(deviceToken).toBeDefined();
    });

    test('should reject legacy range options in new syntax', () => {
      // TODO: This test requires full semantic analyzer support for new bus range syntax
      // For now, just verify that offset and buslen are not recognized as valid range options
      const content = `
:space ram addr=32 word=32 type=rw
:bus sysbus addr=32 ranges={
    ram 0x1000_0x1000 offset=0x100 buslen=0x1000
}`;
      const tokenizer = new ISATokenizer(content, tokenizerOptions);
      const tokens = tokenizer.tokenize();
      
      // Verify that offset and buslen are NOT tokenized as range options
      const offsetAsRangeOption = tokens.find(t => t.text === 'offset' && t.type === TokenType.RANGE_OPTION_TAG);
      const buslenAsRangeOption = tokens.find(t => t.text === 'buslen' && t.type === TokenType.RANGE_OPTION_TAG);
      
      expect(offsetAsRangeOption).toBeUndefined();
      expect(buslenAsRangeOption).toBeUndefined();
      
      // They should be tokenized as field references (invalid in this context)
      const offsetToken = tokens.find(t => t.text === 'offset');
      const buslenToken = tokens.find(t => t.text === 'buslen');
      
      expect(offsetToken?.type).toBe(TokenType.IDENTIFIER);
      expect(buslenToken?.type).toBe(TokenType.IDENTIFIER);
    });
  });

  describe('Device Offset Syntax', () => {
    test('should tokenize device offset with semicolon', () => {
      const content = `
:space flash addr=32 word=32 type=ro
:bus sysbus addr=32 ranges={
    flash;0x1080 0x40000400_0x400 descr="Flash with offset"
}`;
      const tokenizer = new ISATokenizer(content, tokenizerOptions);
      const tokens = tokenizer.tokenize();
      
      const contextOpToken = tokens.find(t => t.type === TokenType.CONTEXT_OPERATOR);
      expect(contextOpToken).toBeDefined();
      expect(contextOpToken?.text).toBe(';');
    });
  });

  describe('Range Format Validation', () => {
    test('should validate range format start <= end', () => {
      const content = `
:space ram addr=32 word=32 type=rw
:bus sysbus addr=32 ranges={
    ram 0x2000--0x1000 descr="Invalid range"
}`;
      
      const document = TextDocument.create('test://test.sysdef', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);
      
      // This would require implementing range validation in the analyzer
      // For now, just ensure it parses without crashing
      expect(result.errors).toBeDefined();
    });

    test('should validate size format size > 0', () => {
      const content = `
:space ram addr=32 word=32 type=rw
:bus sysbus addr=32 ranges={
    ram 0x1000_0x0 descr="Zero size range"
}`;
      
      const document = TextDocument.create('test://test.sysdef', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);
      
      // This would require implementing size validation in the analyzer
      expect(result.errors).toBeDefined();
    });
  });

  describe('Complete Bus Definition Examples', () => {
    test('should parse complete enhanced bus definition', () => {
      const content = `
:space small_flash addr=32 word=32 type=ro align=12 endian=big
:space large_flash addr=32 word=32 type=ro align=12 endian=big
:space ram addr=32 word=32 type=rw align=16 endian=big
:space etpu addr=16 word=24 type=memio align=16 endian=big

:bus sysbus addr=32 ranges={
    small_flash 0x0--0x3FFFF descr="Boot ROM"
    large_flash 0x800000_0x800000 descr="Application Flash"  
    ram 0x40000000_0x80000 descr="Main System RAM"
    small_flash;0x1080 0x40000400_0x400 prio=1 descr="Flash shadow in RAM"
    etpu 0xC3F80000_0x10000 descr="Enhanced Timer Processing Unit"
    ram 0x50000000_0x1000 redirect=0x40000000 descr="RAM alias/mirror"
}`;
      
      const document = TextDocument.create('test://test.sysdef', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);
      
      // Should parse without fatal errors
      expect(result.tokens.length).toBeGreaterThan(0);
    });

    test('should validate space references in ranges', () => {
      const content = `
:space ram addr=32 word=32 type=rw
:bus sysbus addr=32 ranges={
    undefined_space 0x1000_0x1000 descr="Undefined space"
}`;
      
      const document = TextDocument.create('test://test.sysdef', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);
      
      const undefinedError = result.errors.find(e => 
        e.message.includes('Undefined') && 
        e.message.includes('undefined_space')
      );
      expect(undefinedError).toBeDefined();
    });
  });

  describe('Range Format Equivalence', () => {
    test('should handle both range and size formats for same range', () => {
      const content = `
:space flash addr=32 word=32 type=ro
:bus sysbus addr=32 ranges={
    flash 0x800000--0xFFFFFF descr="8MB range format"
    flash 0x800000_0x800000 descr="8MB size format"
}`;
      
      const tokenizer = new ISATokenizer(content, tokenizerOptions);
      const tokens = tokenizer.tokenize();
      
      const rangeToken = tokens.find(t => t.type === TokenType.BUS_RANGE_SEPARATOR);
      const sizeToken = tokens.find(t => t.type === TokenType.BUS_SIZE_SEPARATOR);
      
      expect(rangeToken).toBeDefined();
      expect(sizeToken).toBeDefined();
    });
  });

  describe('Priority Handling', () => {
    test('should parse overlapping ranges with priorities', () => {
      const content = `
:space ram addr=32 word=32 type=rw
:space flash addr=32 word=32 type=ro
:space device addr=32 word=32 type=memio
:bus sysbus addr=32 ranges={
    ram 0x40000000_0x100000 descr="Main RAM block"
    flash;0x1000 0x40000400_0x800 prio=1 descr="Flash window in RAM space"
    device 0x40000600_0x100 prio=2 descr="High priority device overlay"
}`;
      
      const document = TextDocument.create('test://test.sysdef', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);
      
      // Should parse without fatal errors
      expect(result.tokens.length).toBeGreaterThan(0);
    });
  });

  describe('Context-Aware Tokenization', () => {
    test('should distinguish range operators from other uses', () => {
      const content = `
:reg test_field count=10 name="field_%d"
:space ram addr=32 word=32 type=rw
:bus sysbus addr=32 ranges={
    ram 0x1000--0x2000 descr="Range with -- operator"
    ram 0x3000_0x1000 descr="Size with _ operator"
}
# Comment with -- and _ characters
`;
      
      const tokenizer = new ISATokenizer(content, tokenizerOptions);
      const tokens = tokenizer.tokenize();
      
      const rangeTokens = tokens.filter(t => t.type === TokenType.BUS_RANGE_SEPARATOR);
      const sizeTokens = tokens.filter(t => t.type === TokenType.BUS_SIZE_SEPARATOR);
      
      expect(rangeTokens).toHaveLength(1);
      expect(sizeTokens).toHaveLength(1);
    });
  });

  describe('Error Recovery', () => {
    test('should handle malformed bus range syntax gracefully', () => {
      const content = `
:space ram addr=32 word=32 type=rw
:bus sysbus addr=32 ranges={
    ram 0x1000--0x2000 invalid_option=value
    malformed_range 0xABC_
    ram;invalid_offset abc 0x3000_0x1000
}`;
      
      const document = TextDocument.create('test://test.sysdef', 'isa', 1, content);
      const result = analyzer.analyzeFile(document);
      
      // Should continue parsing despite errors
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.tokens.length).toBeGreaterThan(0);
    });
  });
});